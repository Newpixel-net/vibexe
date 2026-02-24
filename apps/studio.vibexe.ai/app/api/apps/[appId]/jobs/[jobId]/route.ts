/**
 * Single Job API — GET + PUT + DELETE
 *
 * GET    /api/apps/{appId}/jobs/{jobId}  — Get job details + recent runs summary
 * PUT    /api/apps/{appId}/jobs/{jobId}  — Update job
 * DELETE /api/apps/{appId}/jobs/{jobId}  — Delete job (cascades to runs)
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

async function resolveAppDb(appDbId: number) {
	const appDb = await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, appDbId),
	});
	if (!appDb || appDb.status !== "active") return null;
	return appDb;
}

/**
 * GET — Get job details + recent runs summary
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, jobId } = await params;
		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const appDb = await resolveAppDb(ctx.app.dbId);
		if (!appDb) {
			return NextResponse.json({ error: "App database not found" }, { status: 404 });
		}

		const jobs = await executeQuery<Record<string, unknown>>(
			appDb.databaseName,
			`SELECT * FROM _app_scheduled_jobs WHERE id = $1`,
			[Number.parseInt(jobId, 10)],
		);

		if (jobs.length === 0) {
			return NextResponse.json({ error: "Job not found" }, { status: 404 });
		}

		// Get recent runs summary
		const recentRuns = await executeQuery<Record<string, unknown>>(
			appDb.databaseName,
			`SELECT id, status, started_at, completed_at, duration_ms, error, attempt, manual
			 FROM _app_job_runs WHERE job_id = $1
			 ORDER BY started_at DESC LIMIT 10`,
			[Number.parseInt(jobId, 10)],
		);

		return NextResponse.json({
			data: {
				...jobs[0],
				recentRuns,
			},
		});
	} catch (error) {
		console.error("[Jobs API] GET single error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * PUT — Update job
 * Body: { cronExpression?, enabled?, retryPolicy?, timeoutMs?, description?, functionName? }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, jobId } = await params;
		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const appDb = await resolveAppDb(ctx.app.dbId);
		if (!appDb) {
			return NextResponse.json({ error: "App database not found" }, { status: 404 });
		}

		const body = await request.json();
		const sets: string[] = [];
		const values: unknown[] = [];
		let paramIdx = 1;

		if (body.cronExpression !== undefined) {
			const cronParts = body.cronExpression.trim().split(/\s+/);
			if (cronParts.length !== 5) {
				return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
			}
			sets.push(`cron_expression = $${paramIdx++}`);
			values.push(body.cronExpression);
		}

		if (body.enabled !== undefined) {
			sets.push(`enabled = $${paramIdx++}`);
			values.push(body.enabled);
		}

		if (body.retryPolicy !== undefined) {
			sets.push(`retry_policy = $${paramIdx++}::jsonb`);
			values.push(JSON.stringify(body.retryPolicy));
		}

		if (body.timeoutMs !== undefined) {
			sets.push(`timeout_ms = $${paramIdx++}`);
			values.push(Math.min(body.timeoutMs, 30000));
		}

		if (body.description !== undefined) {
			sets.push(`description = $${paramIdx++}`);
			values.push(body.description);
		}

		if (body.functionName !== undefined) {
			sets.push(`function_name = $${paramIdx++}`);
			values.push(body.functionName);
		}

		if (body.timezone !== undefined) {
			sets.push(`timezone = $${paramIdx++}`);
			values.push(body.timezone);
		}

		if (sets.length === 0) {
			return NextResponse.json({ error: "No fields to update" }, { status: 400 });
		}

		sets.push("updated_at = NOW()");
		values.push(Number.parseInt(jobId, 10));

		const rows = await executeQuery<Record<string, unknown>>(
			appDb.databaseName,
			`UPDATE _app_scheduled_jobs SET ${sets.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
			values,
		);

		if (rows.length === 0) {
			return NextResponse.json({ error: "Job not found" }, { status: 404 });
		}

		return NextResponse.json({ data: rows[0] });
	} catch (error) {
		console.error("[Jobs API] PUT error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * DELETE — Delete job (cascades to runs via FK constraint)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, jobId } = await params;
		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const appDb = await resolveAppDb(ctx.app.dbId);
		if (!appDb) {
			return NextResponse.json({ error: "App database not found" }, { status: 404 });
		}

		const rows = await executeQuery<{ id: number }>(
			appDb.databaseName,
			`DELETE FROM _app_scheduled_jobs WHERE id = $1 RETURNING id`,
			[Number.parseInt(jobId, 10)],
		);

		if (rows.length === 0) {
			return NextResponse.json({ error: "Job not found" }, { status: 404 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Jobs API] DELETE error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
