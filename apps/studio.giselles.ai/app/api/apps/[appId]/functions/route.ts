/**
 * Functions Registration API
 *
 * GET  /api/apps/{appId}/functions     — List registered functions
 * POST /api/apps/{appId}/functions     — Register a new function
 *
 * Auth: X-Vibexe-Api-Key header (app builder/admin only).
 */

import { eq, and } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppFunctions,
} from "@/db/schema";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

async function resolveApp(appId: string, request: NextRequest) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});
	if (!app) return { error: "App not found", status: 404 } as const;

	// Check API key first
	const apiKey = request.headers.get("x-vibexe-api-key");
	if (apiKey) {
		const valid = await verifyApiKey(app.dbId, apiKey);
		if (!valid) return { error: "Invalid API key", status: 401 } as const;
		return { app };
	}

	// Builder session fallback — verify builder owns this app via team membership
	try {
		await verifyAppAccess(appId);
		return { app };
	} catch {
		// Not a builder session or no access
	}

	return { error: "API key required", status: 401 } as const;
}

/**
 * GET — List all registered functions for the app.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const functions = await db.query.builderAppFunctions.findMany({
			where: eq(builderAppFunctions.appDbId, ctx.app.dbId),
		});

		return NextResponse.json({
			data: functions.map((f) => ({
				name: f.name,
				filePath: f.filePath,
				triggerType: f.triggerType,
				triggerConfig: f.triggerConfig,
				enabled: f.enabled,
				timeoutMs: f.timeoutMs,
				lastRunAt: f.lastRunAt,
				runCount: f.runCount,
				errorCount: f.errorCount,
				lastError: f.lastError,
				createdAt: f.createdAt,
			})),
		});
	} catch (error) {
		console.error("[Functions API] GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST — Register a new function.
 * Body: { name, filePath, triggerType, triggerConfig?, timeoutMs? }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;

		// Rate limit: 10 function registrations per IP per minute
		const ip = getClientIp(request);
		const rateCheck = checkRateLimit("fn-register", `${appId}:${ip}`, 10, 60 * 1000);
		if (!rateCheck.allowed) {
			return NextResponse.json(
				{ error: "Too many requests. Please try again later." },
				{ status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)) } },
			);
		}

		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const body = await request.json();
		const { name, filePath, triggerType, triggerConfig, timeoutMs } = body;

		if (!name || typeof name !== "string") {
			return NextResponse.json({ error: "name is required" }, { status: 400 });
		}
		if (!filePath || typeof filePath !== "string") {
			return NextResponse.json({ error: "filePath is required" }, { status: 400 });
		}
		if (!["http", "entity_hook", "scheduled"].includes(triggerType)) {
			return NextResponse.json(
				{ error: "triggerType must be 'http', 'entity_hook', or 'scheduled'" },
				{ status: 400 },
			);
		}

		// Validate cron schedule for scheduled triggers
		if (triggerType === "scheduled") {
			const schedule = triggerConfig?.schedule;
			if (!schedule || typeof schedule !== "string") {
				return NextResponse.json(
					{ error: "scheduled functions require triggerConfig.schedule (cron expression)" },
					{ status: 400 },
				);
			}
			// Basic cron validation: must have 5 fields (minute hour day month weekday)
			const cronParts = schedule.trim().split(/\s+/);
			if (cronParts.length !== 5) {
				return NextResponse.json(
					{ error: "Invalid cron expression: must have exactly 5 fields (minute hour day month weekday)" },
					{ status: 400 },
				);
			}
			// Minimum interval: reject sub-5-minute frequencies
			// Block "* * * * *" (every minute), "*/1 * * * *", "*/2 * * * *", etc.
			const minuteField = cronParts[0];
			let tooFrequent = false;
			if (minuteField === "*") {
				// "* ..." = every minute
				tooFrequent = true;
			} else if (minuteField.startsWith("*/")) {
				// "*/N ..." = every N minutes — must be >= 5
				const interval = Number.parseInt(minuteField.slice(2), 10);
				if (Number.isNaN(interval) || interval < 1) {
					return NextResponse.json(
						{ error: `Invalid cron minute field: '${minuteField}'. Use */N where N is a positive integer (e.g. '*/5')` },
						{ status: 400 },
					);
				}
				if (interval < 5) {
					tooFrequent = true;
				}
			} else if (minuteField.includes(",")) {
				// "0,1,2,3,4 ..." = multiple minute marks — check spacing
				const minutes = minuteField.split(",").map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
				if (minutes.length > 12) {
					// More than 12 runs per hour = avg less than 5 min apart
					tooFrequent = true;
				}
			}
			if (tooFrequent) {
				return NextResponse.json(
					{ error: "Cron schedule too frequent: minimum interval is every 5 minutes (e.g. '*/5 * * * *')" },
					{ status: 400 },
				);
			}
		}

		// Upsert: if function with same name exists, update it
		const existing = await db.query.builderAppFunctions.findFirst({
			where: and(
				eq(builderAppFunctions.appDbId, ctx.app.dbId),
				eq(builderAppFunctions.name, name),
			),
		});

		if (existing) {
			await db
				.update(builderAppFunctions)
				.set({
					filePath,
					triggerType,
					triggerConfig: triggerConfig ?? {},
					timeoutMs: Math.min(timeoutMs ?? 10000, 30000),
				})
				.where(eq(builderAppFunctions.dbId, existing.dbId));

			return NextResponse.json({ data: { name, filePath, triggerType, updated: true } });
		}

		await db.insert(builderAppFunctions).values({
			appDbId: ctx.app.dbId,
			name,
			filePath,
			triggerType,
			triggerConfig: triggerConfig ?? {},
			timeoutMs: Math.min(timeoutMs ?? 10000, 30000),
		});

		return NextResponse.json({ data: { name, filePath, triggerType } }, { status: 201 });
	} catch (error) {
		console.error("[Functions API] POST error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
