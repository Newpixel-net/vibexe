/**
 * Function Execution API (HTTP Trigger)
 *
 * POST /api/apps/{appId}/functions/{name}  — Execute function with body
 * GET  /api/apps/{appId}/functions/{name}  — Execute function (read-only)
 *
 * Auth: X-Vibexe-Api-Key header OR Bearer token.
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
import { resolveAppUser } from "@/lib/app-database/rls";
import { executeFunction, loadFunctionSource } from "@/lib/app-functions/runner";

interface RouteParams {
	params: Promise<{ appId: string; name: string }>;
}

async function resolveContext(appId: string, fnName: string, request: NextRequest) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});
	if (!app) return { error: "App not found", status: 404 } as const;

	const appDb = await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, app.dbId),
	});
	if (!appDb || appDb.status !== "active") {
		return { error: "App database not available", status: 503 } as const;
	}

	// Auth: API key, builder session (team ownership), or Bearer token (app user)
	let user = null;
	const apiKey = request.headers.get("x-vibexe-api-key");
	if (apiKey) {
		const valid = await verifyApiKey(app.dbId, apiKey);
		if (!valid) return { error: "Invalid API key", status: 401 } as const;
	} else {
		// Try builder session first (team ownership check)
		let isBuilder = false;
		try {
			const { verifyAppAccess } = await import("@/lib/auth/verify-app-access");
			await verifyAppAccess(appId);
			isBuilder = true;
		} catch {
			// Not a builder session or no access
		}

		// If not a builder, try app user Bearer token
		if (!isBuilder) {
			user = await resolveAppUser(appDb.databaseName, request);
		}
	}

	// Load function metadata
	const fn = await db.query.builderAppFunctions.findFirst({
		where: and(
			eq(builderAppFunctions.appDbId, app.dbId),
			eq(builderAppFunctions.name, fnName),
		),
	});
	if (!fn) return { error: `Function '${fnName}' not found`, status: 404 } as const;
	if (!fn.enabled) return { error: `Function '${fnName}' is disabled`, status: 403 } as const;

	return { app, appDb, fn, user };
}

async function executeFn(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, name: fnName } = await params;
		const ctx = await resolveContext(appId, fnName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		// Load function source
		const source = await loadFunctionSource(ctx.app.dbId, ctx.fn.filePath);
		if (!source) {
			return NextResponse.json(
				{ error: `Function file '${ctx.fn.filePath}' not found` },
				{ status: 404 },
			);
		}

		// Build request context
		const url = new URL(request.url);
		const query: Record<string, string> = {};
		for (const [key, value] of url.searchParams) {
			query[key] = value;
		}

		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			// Don't expose auth headers to user code
			if (key !== "authorization" && key !== "x-vibexe-api-key") {
				headers[key] = value;
			}
		});

		let body: unknown = null;
		if (request.method === "POST" || request.method === "PUT") {
			try {
				body = await request.json();
			} catch {
				body = null;
			}
		}

		// Execute
		const result = await executeFunction({
			appId,
			appDbId: ctx.app.dbId,
			databaseName: ctx.appDb.databaseName,
			source,
			timeoutMs: ctx.fn.timeoutMs ?? 10000,
			user: ctx.user,
			request: {
				body,
				headers,
				query,
				method: request.method,
			},
		});

		// Update run stats (fire-and-forget)
		db.update(builderAppFunctions)
			.set({
				lastRunAt: new Date(),
				runCount: (ctx.fn.runCount ?? 0) + 1,
				lastError: null,
			})
			.where(eq(builderAppFunctions.dbId, ctx.fn.dbId))
			.catch(() => {});

		return NextResponse.json({
			data: result.result,
			logs: result.logs,
			durationMs: result.durationMs,
		});
	} catch (error) {
		const errMsg = error instanceof Error ? error.message : "Function execution failed";

		// Try to update error stats
		try {
			const { appId, name: fnName } = await params;
			const app = await db.query.builderApps.findFirst({
				where: eq(builderApps.id, appId as BuilderAppId),
				columns: { dbId: true },
			});
			if (app) {
				const fn = await db.query.builderAppFunctions.findFirst({
					where: and(
						eq(builderAppFunctions.appDbId, app.dbId),
						eq(builderAppFunctions.name, fnName),
					),
				});
				if (fn) {
					db.update(builderAppFunctions)
						.set({
							lastRunAt: new Date(),
							errorCount: (fn.errorCount ?? 0) + 1,
							lastError: errMsg,
						})
						.where(eq(builderAppFunctions.dbId, fn.dbId))
						.catch(() => {});
				}
			}
		} catch {}

		console.error("[Functions API] Execute error:", error);
		return NextResponse.json({ error: errMsg }, { status: 500 });
	}
}

export async function POST(request: NextRequest, routeParams: RouteParams) {
	return executeFn(request, routeParams);
}

export async function GET(request: NextRequest, routeParams: RouteParams) {
	return executeFn(request, routeParams);
}
