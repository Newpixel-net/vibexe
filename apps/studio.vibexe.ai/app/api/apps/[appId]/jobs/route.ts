/**
 * Background Jobs API — List + Create
 *
 * GET  /api/apps/{appId}/jobs     — List scheduled jobs
 * POST /api/apps/{appId}/jobs     — Create a new scheduled job
 *
 * Auth: X-Vibexe-Api-Key header or builder session.
 */

import { eq, and } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppDatabases,
	builderAppFunctions,
} from "@/db/schema";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { executeQuery } from "@/lib/app-database/pool-manager";
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

	const apiKey = request.headers.get("x-vibexe-api-key");
	if (apiKey) {
		const valid = await verifyApiKey(app.dbId, apiKey);
		if (!valid) return { error: "Invalid API key", status: 401 } as const;
		return { app };
	}

	try {
		await verifyAppAccess(appId);
		return { app };
	} catch {
		// Not a builder session
	}

	return { error: "API key required", status: 401 } as const;
}

async function resolveAppDb(appDbId: number) {
	const appDb = await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, appDbId),
	});
	if (!appDb || appDb.status !== "active") return null;
	return appDb;
}

/**
 * Calculate next run from cron expression (reused from cron endpoint).
 */
function parseCronField(field: string, min: number, max: number): Set<number> | null {
	if (field === "*") return null;
	const values = new Set<number>();
	for (const part of field.split(",")) {
		const trimmed = part.trim();
		if (trimmed.includes("/")) {
			const [rangeStr, stepStr] = trimmed.split("/");
			const step = Number.parseInt(stepStr, 10);
			if (Number.isNaN(step) || step <= 0) continue;
			let start = min;
			let end = max;
			if (rangeStr !== "*") {
				if (rangeStr.includes("-")) {
					const [a, b] = rangeStr.split("-");
					start = Number.parseInt(a, 10);
					end = Number.parseInt(b, 10);
				} else {
					start = Number.parseInt(rangeStr, 10);
				}
			}
			for (let i = start; i <= end; i += step) values.add(i);
		} else if (trimmed.includes("-")) {
			const [a, b] = trimmed.split("-");
			const rangeStart = Number.parseInt(a, 10);
			const rangeEnd = Number.parseInt(b, 10);
			for (let i = rangeStart; i <= rangeEnd; i++) values.add(i);
		} else {
			const v = Number.parseInt(trimmed, 10);
			if (!Number.isNaN(v)) values.add(v);
		}
	}
	return values.size > 0 ? values : null;
}

function calculateNextRun(cronExpression: string): Date {
	const now = new Date();
	const parts = cronExpression.split(" ");
	if (parts.length !== 5) return new Date(now.getTime() + 3600_000);

	const minuteSet = parseCronField(parts[0], 0, 59);
	const hourSet = parseCronField(parts[1], 0, 23);
	const domSet = parseCronField(parts[2], 1, 31);
	const monthSet = parseCronField(parts[3], 1, 12);
	const dowSet = parseCronField(parts[4], 0, 6);

	const candidate = new Date(now);
	candidate.setSeconds(0);
	candidate.setMilliseconds(0);
	candidate.setMinutes(candidate.getMinutes() + 1);

	const maxIterations = 400 * 24 * 60;
	for (let i = 0; i < maxIterations; i++) {
		const m = candidate.getMinutes();
		const h = candidate.getHours();
		const dom = candidate.getDate();
		const month = candidate.getMonth() + 1;
		const dow = candidate.getDay();

		if (
			(minuteSet === null || minuteSet.has(m)) &&
			(hourSet === null || hourSet.has(h)) &&
			(domSet === null || domSet.has(dom)) &&
			(monthSet === null || monthSet.has(month)) &&
			(dowSet === null || dowSet.has(dow))
		) {
			return candidate;
		}
		candidate.setMinutes(candidate.getMinutes() + 1);
	}
	return new Date(now.getTime() + 3600_000);
}

/**
 * GET — List all scheduled jobs for the app.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const appDb = await resolveAppDb(ctx.app.dbId);
		if (!appDb) {
			return NextResponse.json({ error: "App database not found" }, { status: 404 });
		}

		const url = new URL(request.url);
		const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10));
		const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10)));
		const offset = (page - 1) * limit;

		const jobs = await executeQuery<{
			id: number;
			name: string;
			description: string;
			function_name: string;
			cron_expression: string;
			timezone: string;
			enabled: boolean;
			retry_policy: unknown;
			timeout_ms: number;
			last_run_at: string | null;
			next_run_at: string | null;
			run_count: number;
			error_count: number;
			created_at: string;
			updated_at: string;
		}>(
			appDb.databaseName,
			`SELECT * FROM _app_scheduled_jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
			[limit, offset],
		);

		const countResult = await executeQuery<{ cnt: string }>(
			appDb.databaseName,
			`SELECT COUNT(*)::text AS cnt FROM _app_scheduled_jobs`,
		);
		const total = Number.parseInt(countResult[0]?.cnt ?? "0", 10);

		return NextResponse.json({
			data: jobs,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("[Jobs API] GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST — Create a new scheduled job.
 * Body: { name, functionName, cronExpression, timezone?, description?, retryPolicy?, timeoutMs? }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const ip = getClientIp(request);
		const rateCheck = checkRateLimit("job-create", `${appId}:${ip}`, 10, 60 * 1000);
		if (!rateCheck.allowed) {
			return NextResponse.json(
				{ error: "Too many requests" },
				{ status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)) } },
			);
		}

		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const appDb = await resolveAppDb(ctx.app.dbId);
		if (!appDb) {
			return NextResponse.json({ error: "App database not found" }, { status: 404 });
		}

		const body = await request.json();
		const { name, functionName, cronExpression, timezone, description, retryPolicy, timeoutMs } = body;

		if (!name || typeof name !== "string") {
			return NextResponse.json({ error: "name is required" }, { status: 400 });
		}
		if (!functionName || typeof functionName !== "string") {
			return NextResponse.json({ error: "functionName is required" }, { status: 400 });
		}
		if (!cronExpression || typeof cronExpression !== "string") {
			return NextResponse.json({ error: "cronExpression is required" }, { status: 400 });
		}

		// Validate cron expression
		const cronParts = cronExpression.trim().split(/\s+/);
		if (cronParts.length !== 5) {
			return NextResponse.json(
				{ error: "Invalid cron expression: must have exactly 5 fields" },
				{ status: 400 },
			);
		}

		// Validate minimum interval (5 min)
		const minuteField = cronParts[0];
		if (minuteField === "*" || (minuteField.startsWith("*/") && Number.parseInt(minuteField.slice(2), 10) < 5)) {
			return NextResponse.json(
				{ error: "Minimum interval is every 5 minutes (e.g. '*/5 * * * *')" },
				{ status: 400 },
			);
		}

		// Verify function exists
		const fn = await db.query.builderAppFunctions.findFirst({
			where: and(
				eq(builderAppFunctions.appDbId, ctx.app.dbId),
				eq(builderAppFunctions.name, functionName),
			),
		});
		if (!fn) {
			return NextResponse.json(
				{ error: `Function '${functionName}' not found. Register it first in the Functions panel.` },
				{ status: 400 },
			);
		}

		const nextRun = calculateNextRun(cronExpression);
		const retryPolicyJson = retryPolicy ? JSON.stringify(retryPolicy) : '{"maxRetries":3,"initialDelayMs":5000,"maxDelayMs":300000,"backoffMultiplier":2}';

		const rows = await executeQuery<{ id: number }>(
			appDb.databaseName,
			`INSERT INTO _app_scheduled_jobs (name, description, function_name, cron_expression, timezone, retry_policy, timeout_ms, next_run_at)
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
			 ON CONFLICT (name) DO UPDATE SET
			   function_name = EXCLUDED.function_name,
			   cron_expression = EXCLUDED.cron_expression,
			   timezone = EXCLUDED.timezone,
			   retry_policy = EXCLUDED.retry_policy,
			   timeout_ms = EXCLUDED.timeout_ms,
			   next_run_at = EXCLUDED.next_run_at,
			   description = EXCLUDED.description,
			   updated_at = NOW()
			 RETURNING id`,
			[
				name,
				description ?? "",
				functionName,
				cronExpression,
				timezone ?? "UTC",
				retryPolicyJson,
				Math.min(timeoutMs ?? 30000, 30000),
				nextRun.toISOString(),
			],
		);

		return NextResponse.json({
			data: {
				id: rows[0]?.id,
				name,
				functionName,
				cronExpression,
				nextRunAt: nextRun.toISOString(),
			},
		}, { status: 201 });
	} catch (error) {
		console.error("[Jobs API] POST error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
