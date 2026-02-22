/**
 * Dynamic Data API — Entity List & Create
 *
 * GET  /api/apps/{appId}/data/{entity}     — List rows (paginated, filterable, sortable)
 * POST /api/apps/{appId}/data/{entity}     — Create a new row
 *
 * Auth: X-Vibexe-Api-Key header OR Bearer token (end-user).
 * RLS: API keys bypass RLS. Bearer token auth enforces entity access policies.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import { logAppEvent } from "@/lib/app-database/app-logger";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { emitDataEvent } from "@/lib/realtime/event-bus";
import { executeQuery } from "@/lib/app-database/pool-manager";
import { resolveAppUser, getEntityPolicy, enforceRLS } from "@/lib/app-database/rls";
import type { AppSchema } from "@/lib/app-database/schema-types";
import { runEntityHook } from "@/lib/app-functions/hooks";

interface RouteParams {
	params: Promise<{ appId: string; entity: string }>;
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

/**
 * Resolve app + database + validate entity.
 * Returns `apiKeyValid` and `isInternal` flags for RLS decisions.
 */
async function resolveContext(appId: string, entityName: string, request: NextRequest) {
	// Look up app
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});
	if (!app) return { error: "App not found", status: 404 } as const;

	// Look up app database
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

	// Validate entity exists in schema
	const schema = appDb.schemaJson as AppSchema | null;
	if (!schema?.entities?.length) {
		return { error: "No entities defined", status: 404 } as const;
	}

	const entity = schema.entities.find((e) => e.tableName === entityName);
	if (!entity) {
		return {
			error: `Entity '${entityName}' not found. Available: ${schema.entities.map((e) => e.tableName).join(", ")}`,
			status: 404,
		} as const;
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
 * GET — List rows with pagination, filtering, and sorting.
 *
 * Query params:
 *   ?page=1&limit=20&sort=created_at&order=desc&filter[status]=active
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, entity: entityName } = await params;
		const ctx = await resolveContext(appId, entityName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const url = new URL(request.url);
		const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10));
		const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10)));
		const sort = url.searchParams.get("sort") || "created_at";
		const order = url.searchParams.get("order") === "asc" ? "ASC" : "DESC";
		const offset = (page - 1) * limit;

		// Build WHERE clause from filter params
		const filters: string[] = [];
		const filterParams: unknown[] = [];
		let paramIndex = 1;

		for (const [key, value] of url.searchParams) {
			const match = key.match(/^filter\[(\w+)\]$/);
			if (match) {
				const fieldName = match[1];
				// Validate field exists in entity
				const fieldExists =
					ctx.entity.fields.some((f) => f.name === fieldName) ||
					["id", "created_at", "updated_at"].includes(fieldName);
				if (fieldExists) {
					filters.push(`"${fieldName}" = $${paramIndex}`);
					filterParams.push(value);
					paramIndex++;
				}
			}
		}

		// RLS enforcement (skip for API key auth and internal tables)
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

			// Append RLS WHERE clauses
			for (const clause of rls.whereClauses) {
				filters.push(clause);
			}
			filterParams.push(...rls.whereParams);
			paramIndex += rls.whereParams.length;
		}

		const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

		// Validate sort column
		const validColumns = [
			"id",
			"created_at",
			"updated_at",
			...ctx.entity.fields.map((f) => f.name),
		];
		const safeSort = validColumns.includes(sort) ? sort : "created_at";

		// Count total
		const countResult = await executeQuery<{ count: string }>(
			ctx.databaseName,
			`SELECT COUNT(*) as count FROM "${ctx.entity.tableName}" ${whereClause}`,
			filterParams,
		);
		const total = Number.parseInt(countResult[0]?.count || "0", 10);

		// Fetch rows
		const rows = await executeQuery(
			ctx.databaseName,
			`SELECT * FROM "${ctx.entity.tableName}" ${whereClause} ORDER BY "${safeSort}" ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
			[...filterParams, limit, offset],
		);

		// Log the query (fire-and-forget, don't await)
		logAppEvent(ctx.databaseName, {
			level: "info",
			category: "entity",
			eventType: "app.entity.query",
			message: `Listed ${entityName}: ${rows.length} rows returned`,
		});

		return NextResponse.json({
			data: rows,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		console.error("[Data API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * POST — Create a new row.
 *
 * Body: JSON object with field values.
 * Returns the created row.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, entity: entityName } = await params;
		const ctx = await resolveContext(appId, entityName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const body = await request.json();
		if (!body || typeof body !== "object") {
			return NextResponse.json(
				{ error: "Request body must be a JSON object" },
				{ status: 400 },
			);
		}

		// RLS enforcement (skip for API key auth and internal tables)
		let rlsAutoFields: Record<string, unknown> = {};
		if (!ctx.apiKeyValid && !ctx.isInternal) {
			const user = await resolveAppUser(ctx.databaseName, request);
			const policy = await getEntityPolicy(ctx.appDb.appDbId, entityName);
			const entityFields = ctx.entity.fields.map((f) => f.name);
			const rls = enforceRLS({
				policy,
				operation: "write",
				user,
				paramOffset: 0,
				entityFields,
			});

			if (!rls.allowed) {
				return NextResponse.json({ error: rls.error }, { status: rls.status });
			}

			rlsAutoFields = rls.autoFields;
		}

		// Run beforeCreate hook (can modify body or abort)
		let hookBody = body;
		if (!ctx.isInternal) {
			const hookResult = await runEntityHook({
				databaseName: ctx.databaseName,
				appDbId: ctx.appDb.appDbId,
				appId,
				entity: entityName,
				hookType: "beforeCreate",
				data: body,
				user: await resolveAppUser(ctx.databaseName, request).catch(() => null),
			});
			if (hookResult.abort) {
				return NextResponse.json({ error: hookResult.abort }, { status: 400 });
			}
			if (hookResult.data) hookBody = hookResult.data;
		}

		// Filter to only known fields
		const fieldMap = new Map(ctx.entity.fields.map((f) => [f.name, f]));
		const fields: string[] = [];
		const values: unknown[] = [];
		const placeholders: string[] = [];
		let paramIndex = 1;

		// First, inject RLS auto-fields (e.g. owner field)
		// Always inject — the builder configured this field in the security policy,
		// and the column exists in the DB even if not in schema_json.
		for (const [key, value] of Object.entries(rlsAutoFields)) {
			fields.push(`"${key}"`);
			values.push(value);
			placeholders.push(`$${paramIndex}`);
			paramIndex++;
		}

		for (const [key, value] of Object.entries(hookBody)) {
			// Skip fields already set by RLS (prevent client from overriding owner)
			if (key in rlsAutoFields) continue;

			const field = fieldMap.get(key);
			if (field) {
				// Coerce empty strings to null for non-text types
				const coerced =
					value === "" && field.type !== "text" ? null : value;
				fields.push(`"${key}"`);
				values.push(coerced);
				placeholders.push(`$${paramIndex}`);
				paramIndex++;
			}
		}

		if (fields.length === 0) {
			return NextResponse.json(
				{ error: "No valid fields provided" },
				{ status: 400 },
			);
		}

		const rows = await executeQuery(
			ctx.databaseName,
			`INSERT INTO "${ctx.entity.tableName}" (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
			values,
		);

		// Log the creation (fire-and-forget, don't await)
		logAppEvent(ctx.databaseName, {
			level: "info",
			category: "entity",
			eventType: "app.entity.create",
			message: `Created row in ${entityName}`,
			metadata: { entityName },
		});

		// Emit real-time event
		emitDataEvent(appId, { entity: entityName, action: "created", record: rows[0] as Record<string, unknown> });

		// Run afterCreate hook (fire-and-forget)
		if (!ctx.isInternal) {
			runEntityHook({
				databaseName: ctx.databaseName,
				appDbId: ctx.appDb.appDbId,
				appId,
				entity: entityName,
				hookType: "afterCreate",
				data: rows[0] as Record<string, unknown>,
				user: await resolveAppUser(ctx.databaseName, request).catch(() => null),
			}).catch(() => {});
		}

		return NextResponse.json({ data: rows[0] }, { status: 201 });
	} catch (error) {
		console.error("[Data API] POST error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
