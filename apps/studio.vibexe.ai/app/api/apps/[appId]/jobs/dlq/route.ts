/**
 * Dead Letter Queue API
 *
 * GET  /api/apps/{appId}/jobs/dlq   — List unacknowledged DLQ entries
 * POST /api/apps/{appId}/jobs/dlq   — Acknowledge a DLQ entry
 *
 * Auth: X-Vibexe-Api-Key header or builder session.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppDatabases,
} from "@/db/schema";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { executeQuery } from "@/lib/app-database/pool-manager";

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

/**
 * GET — List DLQ entries (unacknowledged by default)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const appDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, ctx.app.dbId),
		});
		if (!appDb || appDb.status !== "active") {
			return NextResponse.json({ error: "App database not found" }, { status: 404 });
		}

		const url = new URL(request.url);
		const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10));
		const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10)));
		const offset = (page - 1) * limit;
		const showAll = url.searchParams.get("all") === "true";

		const whereClause = showAll ? "" : "WHERE acknowledged = false";

		const entries = await executeQuery<Record<string, unknown>>(
			appDb.databaseName,
			`SELECT * FROM _app_job_dlq ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
			[limit, offset],
		);

		const countResult = await executeQuery<{ cnt: string }>(
			appDb.databaseName,
			`SELECT COUNT(*)::text AS cnt FROM _app_job_dlq ${whereClause}`,
		);
		const total = Number.parseInt(countResult[0]?.cnt ?? "0", 10);

		return NextResponse.json({
			data: entries,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("[Jobs DLQ API] GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST — Acknowledge a DLQ entry
 * Body: { dlqId: number }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const appDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, ctx.app.dbId),
		});
		if (!appDb || appDb.status !== "active") {
			return NextResponse.json({ error: "App database not found" }, { status: 404 });
		}

		const body = await request.json();
		const { dlqId } = body;

		if (!dlqId || typeof dlqId !== "number") {
			return NextResponse.json({ error: "dlqId (number) is required" }, { status: 400 });
		}

		const rows = await executeQuery<{ id: number }>(
			appDb.databaseName,
			`UPDATE _app_job_dlq SET acknowledged = true WHERE id = $1 RETURNING id`,
			[dlqId],
		);

		if (rows.length === 0) {
			return NextResponse.json({ error: "DLQ entry not found" }, { status: 404 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Jobs DLQ API] POST error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
