/**
 * Manual Job Trigger API
 *
 * POST /api/apps/{appId}/jobs/{jobId}/trigger — Immediately execute a job
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
} from "@/db/schema";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { executeQuery } from "@/lib/app-database/pool-manager";
import { runJobWithRetries, parseRetryPolicy, type ScheduledJob } from "@/lib/app-functions/job-runner";

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
 * POST — Manually trigger a job immediately (bypasses cron schedule)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

		// Get job details from per-app DB
		const jobs = await executeQuery<{
			id: number;
			name: string;
			function_name: string;
			timeout_ms: number;
			retry_policy: unknown;
		}>(
			appDb.databaseName,
			`SELECT id, name, function_name, timeout_ms, retry_policy
			 FROM _app_scheduled_jobs WHERE id = $1`,
			[Number.parseInt(jobId, 10)],
		);

		if (jobs.length === 0) {
			return NextResponse.json({ error: "Job not found" }, { status: 404 });
		}

		const jobRow = jobs[0];
		const retryPolicy = parseRetryPolicy(jobRow.retry_policy);

		const job: ScheduledJob = {
			id: jobRow.id,
			name: jobRow.name,
			functionName: jobRow.function_name,
			timeoutMs: jobRow.timeout_ms ?? 30000,
			retryPolicy,
		};

		const result = await runJobWithRetries({
			appId,
			appDbId: ctx.app.dbId,
			databaseName: appDb.databaseName,
			job,
			manual: true,
		});

		return NextResponse.json({
			data: {
				status: result.status,
				durationMs: result.durationMs,
				runId: result.runId,
				error: result.error,
			},
		});
	} catch (error) {
		console.error("[Jobs API] Trigger error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
