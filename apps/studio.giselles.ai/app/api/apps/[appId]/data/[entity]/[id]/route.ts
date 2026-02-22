/**
 * Dynamic Data API — Single Row Operations
 *
 * GET    /api/apps/{appId}/data/{entity}/{id}  — Get a single row
 * PUT    /api/apps/{appId}/data/{entity}/{id}  — Update a row
 * DELETE /api/apps/{appId}/data/{entity}/{id}  — Delete a row
 *
 * Auth: X-Vibexe-Api-Key header OR Bearer token (end-user).
 * RLS: API keys bypass RLS. Bearer token auth enforces entity access policies.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { executeQuery } from "@/lib/app-database/pool-manager";
import { emitDataEvent } from "@/lib/realtime/event-bus";
import { resolveAppUser, getEntityPolicy, enforceRLS } from "@/lib/app-database/rls";
import type { AppSchema } from "@/lib/app-database/schema-types";

interface RouteParams {
	params: Promise<{ appId: string; entity: string; id: string }>;
}

/** Internal auth tables that exist in every app database */
const INTERNAL_TABLES: Record<string, { name: string; tableName: string; fields: Array<{ name: string; type: string; required?: boolean }> }> = {
	_app_users: {
		name: "AppUser",
		tableName: "_app_users",
		fields: [
			{ name: "email", type: "text", required: true },
			{ name: "password_hash", type: "text", required: true },
			{ name: "display_name", type: "text" },
			{ name: "role", type: "text" },
			{ name: "status", type: "text" },
			{ name: "email_verified", type: "boolean" },
			{ name: "last_login_at", type: "date" },
		],
	},
	_app_sessions: {
		name: "AppSession",
		tableName: "_app_sessions",
		fields: [
			{ name: "user_id", type: "number", required: true },
			{ name: "expires_at", type: "date", required: true },
		],
	},
};

async function resolveContext(appId: string, entityName: string, request: NextRequest) {
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

	// Check API key once
	let apiKeyValid = false;
	const apiKey = request.headers.get("x-vibexe-api-key");
	if (apiKey) {
		apiKeyValid = await verifyApiKey(app.dbId, apiKey);
		if (!apiKeyValid) return { error: "Invalid API key", status: 401 } as const;
	}

	// Check internal tables first (e.g. _app_users, _app_sessions)
	const internalTable = INTERNAL_TABLES[entityName];
	if (internalTable) {
		return {
			app,
			appDb,
			entity: internalTable,
			databaseName: appDb.databaseName,
			apiKeyValid,
			isInternal: true as const,
		};
	}

	const schema = appDb.schemaJson as AppSchema | null;
	if (!schema?.entities?.length) {
		return { error: "No entities defined", status: 404 } as const;
	}

	const entity = schema.entities.find((e) => e.tableName === entityName);
	if (!entity) {
		return { error: `Entity '${entityName}' not found`, status: 404 } as const;
	}

	return {
		app,
		appDb,
		entity,
		databaseName: appDb.databaseName,
		apiKeyValid,
		isInternal: false as const,
	};
}

/**
 * GET — Get a single row by ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, entity: entityName, id } = await params;
		const ctx = await resolveContext(appId, entityName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const rowId = Number.parseInt(id, 10);
		if (Number.isNaN(rowId)) {
			return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
		}

		// RLS enforcement
		let rlsActive = false;
		const whereClauses = [`id = $1`];
		const queryParams: unknown[] = [rowId];
		let paramIndex = 2;

		if (!ctx.apiKeyValid && !ctx.isInternal) {
			const user = await resolveAppUser(ctx.databaseName, request);
			const policy = await getEntityPolicy(ctx.appDb.appDbId, entityName);
			const entityFields = ctx.entity.fields.map((f) => f.name);
			const rls = enforceRLS({
				policy,
				operation: "read",
				user,
				paramOffset: paramIndex - 1,
				entityFields,
			});

			if (!rls.allowed) {
				return NextResponse.json({ error: rls.error }, { status: rls.status });
			}

			if (rls.whereClauses.length > 0) {
				rlsActive = true;
				whereClauses.push(...rls.whereClauses);
				queryParams.push(...rls.whereParams);
				paramIndex += rls.whereParams.length;
			}
		}

		const rows = await executeQuery(
			ctx.databaseName,
			`SELECT * FROM "${ctx.entity.tableName}" WHERE ${whereClauses.join(" AND ")}`,
			queryParams,
		);

		if (rows.length === 0) {
			return NextResponse.json(
				{ error: rlsActive ? "Access denied" : "Not found" },
				{ status: rlsActive ? 403 : 404 },
			);
		}

		return NextResponse.json({ data: rows[0] });
	} catch (error) {
		console.error("[Data API] GET single error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * PUT — Update a row by ID.
 * Body: JSON object with fields to update.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, entity: entityName, id } = await params;
		const ctx = await resolveContext(appId, entityName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const rowId = Number.parseInt(id, 10);
		if (Number.isNaN(rowId)) {
			return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
		}

		const body = await request.json();
		if (!body || typeof body !== "object") {
			return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
		}

		const fieldMap = new Map(ctx.entity.fields.map((f) => [f.name, f]));
		const setClauses: string[] = [];
		const values: unknown[] = [];
		let paramIndex = 1;

		for (const [key, value] of Object.entries(body)) {
			const field = fieldMap.get(key);
			if (field) {
				// Coerce empty strings to null for non-text types
				const coerced =
					value === "" && field.type !== "text" ? null : value;
				setClauses.push(`"${key}" = $${paramIndex}`);
				values.push(coerced);
				paramIndex++;
			}
		}

		if (setClauses.length === 0) {
			return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
		}

		// Always update updated_at
		setClauses.push(`"updated_at" = NOW()`);

		// Build WHERE clause: id = $N + optional RLS clauses
		const whereClauses = [`id = $${paramIndex}`];
		values.push(rowId);
		paramIndex++;

		let rlsActive = false;
		if (!ctx.apiKeyValid && !ctx.isInternal) {
			const user = await resolveAppUser(ctx.databaseName, request);
			const policy = await getEntityPolicy(ctx.appDb.appDbId, entityName);
			const entityFields = ctx.entity.fields.map((f) => f.name);
			const rls = enforceRLS({
				policy,
				operation: "write",
				user,
				paramOffset: paramIndex - 1,
				entityFields,
			});

			if (!rls.allowed) {
				return NextResponse.json({ error: rls.error }, { status: rls.status });
			}

			if (rls.whereClauses.length > 0) {
				rlsActive = true;
				whereClauses.push(...rls.whereClauses);
				values.push(...rls.whereParams);
				paramIndex += rls.whereParams.length;
			}
		}

		const rows = await executeQuery(
			ctx.databaseName,
			`UPDATE "${ctx.entity.tableName}" SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")} RETURNING *`,
			values,
		);

		if (rows.length === 0) {
			return NextResponse.json(
				{ error: rlsActive ? "Access denied" : "Not found" },
				{ status: rlsActive ? 403 : 404 },
			);
		}

		// Emit real-time event
		emitDataEvent(appId, { entity: entityName, action: "updated", record: rows[0] as Record<string, unknown> });

		return NextResponse.json({ data: rows[0] });
	} catch (error) {
		console.error("[Data API] PUT error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * DELETE — Delete a row by ID.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, entity: entityName, id } = await params;
		const ctx = await resolveContext(appId, entityName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const rowId = Number.parseInt(id, 10);
		if (Number.isNaN(rowId)) {
			return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
		}

		// Build WHERE clause: id = $1 + optional RLS clauses
		const whereClauses = [`id = $1`];
		const queryParams: unknown[] = [rowId];
		let paramIndex = 2;

		let rlsActive = false;
		if (!ctx.apiKeyValid && !ctx.isInternal) {
			const user = await resolveAppUser(ctx.databaseName, request);
			const policy = await getEntityPolicy(ctx.appDb.appDbId, entityName);
			const entityFields = ctx.entity.fields.map((f) => f.name);
			const rls = enforceRLS({
				policy,
				operation: "delete",
				user,
				paramOffset: paramIndex - 1,
				entityFields,
			});

			if (!rls.allowed) {
				return NextResponse.json({ error: rls.error }, { status: rls.status });
			}

			if (rls.whereClauses.length > 0) {
				rlsActive = true;
				whereClauses.push(...rls.whereClauses);
				queryParams.push(...rls.whereParams);
				paramIndex += rls.whereParams.length;
			}
		}

		const rows = await executeQuery(
			ctx.databaseName,
			`DELETE FROM "${ctx.entity.tableName}" WHERE ${whereClauses.join(" AND ")} RETURNING id`,
			queryParams,
		);

		if (rows.length === 0) {
			return NextResponse.json(
				{ error: rlsActive ? "Access denied" : "Not found" },
				{ status: rlsActive ? 403 : 404 },
			);
		}

		// Emit real-time event
		emitDataEvent(appId, { entity: entityName, action: "deleted", record: { id: rowId } });

		return NextResponse.json({ success: true, deleted: rowId });
	} catch (error) {
		console.error("[Data API] DELETE error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
