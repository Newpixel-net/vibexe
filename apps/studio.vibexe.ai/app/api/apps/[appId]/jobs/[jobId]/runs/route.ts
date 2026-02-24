/**
 * Job Run History API
 *
 * GET /api/apps/{appId}/jobs/{jobId}/runs — Paginated list of run history
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
	params: Promise<{ appId: string; jobId: string }>;
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
 * GET — Paginated run history for a job.
 * Query params: ?page=1&limit=20&status=failed
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, jobId } = await params;
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
		const statusFilter = url.searchParams.get("status");

		const jobIdNum = Number.parseInt(jobId, 10);

		let query = `SELECT * FROM _app_job_runs WHERE job_id = $1`;
		let countQuery = `SELECT COUNT(*)::text AS cnt FROM _app_job_runs WHERE job_id = $1`;
		const queryParams: unknown[] = [jobIdNum];
		const countParams: unknown[] = [jobIdNum];

		if (statusFilter) {
			query += ` AND status = $2`;
			countQuery += ` AND status = $2`;
			queryParams.push(statusFilter);
			countParams.push(statusFilter);
		}

		query += ` ORDER BY started_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
		queryParams.push(limit, offset);

		const runs = await executeQuery<Record<string, unknown>>(appDb.databaseName, query, queryParams);
		const countResult = await executeQuery<{ cnt: string }>(appDb.databaseName, countQuery, countParams);
		const total = Number.parseInt(countResult[0]?.cnt ?? "0", 10);

		return NextResponse.json({
			data: runs,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("[Jobs API] Runs GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
