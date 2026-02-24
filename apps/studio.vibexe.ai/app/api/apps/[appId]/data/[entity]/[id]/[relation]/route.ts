/**
 * Reverse Relation Routes — Child access via parent
 *
 * GET  /api/apps/{appId}/data/{entity}/{id}/{relation}  — List children of a parent
 * POST /api/apps/{appId}/data/{entity}/{id}/{relation}  — Create a child under a parent
 *
 * Example: GET /api/apps/xxx/data/posts/1/comments → all comments where post_id = 1
 *          POST /api/apps/xxx/data/posts/1/comments → create comment with post_id = 1
 *
 * Auth: X-Vibexe-Api-Key header OR Bearer token (end-user).
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { executeQuery } from "@/lib/app-database/pool-manager";
import { emitDataEvent } from "@/lib/realtime/event-bus";
import { resolveAppUser, getEntityPolicy, enforceRLS } from "@/lib/app-database/rls";
import type { AppSchema, EntityDefinition } from "@/lib/app-database/schema-types";
import { findOneToManyForCreate } from "@/lib/app-database/relation-resolver";
import { runEntityHook } from "@/lib/app-functions/hooks";
import { dispatchWebhooks } from "@/lib/app-webhooks/dispatcher";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";
import { logAppEvent } from "@/lib/app-database/app-logger";

const DATA_CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Vibexe-Api-Key",
	"Access-Control-Max-Age": "86400",
} as const;

export function OPTIONS() {
	return new Response(null, { status: 204, headers: DATA_CORS_HEADERS });
}

interface RouteParams {
	params: Promise<{ appId: string; entity: string; id: string; relation: string }>;
}

/**
 * Resolve the parent entity, relation target entity, and FK column.
 */
async function resolveRelationContext(
	appId: string,
	entityName: string,
	relationName: string,
	request: NextRequest,
) {
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

	// Check API key
	let apiKeyValid = false;
	const apiKey = request.headers.get("x-vibexe-api-key");
	if (apiKey) {
		apiKeyValid = !!(await verifyApiKey(app.dbId, apiKey));
		if (!apiKeyValid) return { error: "Invalid API key", status: 401 } as const;
	}

	// Builder session fallback
	if (!apiKeyValid) {
		try {
			await verifyAppAccess(appId);
			apiKeyValid = true;
		} catch {
			// continue with end-user auth
		}
	}

	const schema = appDb.schemaJson as AppSchema | null;
	if (!schema?.entities?.length) {
		return { error: "No entities defined", status: 404 } as const;
	}

	// Find parent entity
	const parentEntity = schema.entities.find((e) => e.tableName === entityName);
	if (!parentEntity) {
		return { error: `Entity '${entityName}' not found`, status: 404 } as const;
	}

	// Find the one-to-many relation matching the relation name
	const relMatch = findOneToManyForCreate(schema, parentEntity, relationName);
	if (!relMatch) {
		return { error: `Relation '${relationName}' not found on '${entityName}'`, status: 404 } as const;
	}

	return {
		app,
		appDb,
		parentEntity,
		targetEntity: relMatch.targetEntity,
		fkColumn: relMatch.fkColumn,
		databaseName: appDb.databaseName,
		apiKeyValid,
		schema,
	};
}

/**
 * GET — List children of a parent record via a one-to-many relation.
 *
 * Query params: ?page=1&limit=20&sort=created_at&order=desc&filter[status]=active
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, entity: entityName, id, relation: relationName } = await params;
		const ctx = await resolveRelationContext(appId, entityName, relationName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const parentId = Number.parseInt(id, 10);
		if (Number.isNaN(parentId)) {
			return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
		}

		// Verify parent exists
		const parentRows = await executeQuery(
			ctx.databaseName,
			`SELECT id FROM "${ctx.parentEntity.tableName}" WHERE id = $1`,
			[parentId],
		);
		if (parentRows.length === 0) {
			return NextResponse.json({ error: "Parent record not found" }, { status: 404 });
		}

		const url = new URL(request.url);
		const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10));
		const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10)));
		const sort = url.searchParams.get("sort") || "created_at";
		const order = url.searchParams.get("order") === "asc" ? "ASC" : "DESC";
		const offset = (page - 1) * limit;

		// Build WHERE clause starting with FK filter
		const filters: string[] = [`"${ctx.fkColumn}" = $1`];
		const filterParams: unknown[] = [parentId];
		let paramIndex = 2;

		// Parse additional filters
		const filterRegex = /^filter\[(\w+)\]$/;
		for (const [key, value] of url.searchParams) {
			const match = key.match(filterRegex);
			if (!match) continue;
			const fieldName = match[1];
			const validFields = new Set([
				"id", "created_at", "updated_at",
				...ctx.targetEntity.fields.map((f) => f.name),
			]);
			if (!validFields.has(fieldName)) continue;
			filters.push(`"${fieldName}" = $${paramIndex}`);
			filterParams.push(value);
			paramIndex++;
		}

		// RLS enforcement on target entity
		if (!ctx.apiKeyValid) {
			const user = await resolveAppUser(ctx.databaseName, request);
			const policy = await getEntityPolicy(ctx.appDb.appDbId, ctx.targetEntity.tableName);
			const entityFields = ctx.targetEntity.fields.map((f) => f.name);
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

			for (const clause of rls.whereClauses) {
				filters.push(clause);
			}
			filterParams.push(...rls.whereParams);
			paramIndex += rls.whereParams.length;
		}

		const whereClause = `WHERE ${filters.join(" AND ")}`;

		// Validate sort column
		const validColumns = [
			"id", "created_at", "updated_at",
			...ctx.targetEntity.fields.map((f) => f.name),
		];
		const safeSort = validColumns.includes(sort) ? sort : "created_at";

		// Count total
		const countResult = await executeQuery<{ count: string }>(
			ctx.databaseName,
			`SELECT COUNT(*) as count FROM "${ctx.targetEntity.tableName}" ${whereClause}`,
			filterParams,
		);
		const total = Number.parseInt(countResult[0]?.count || "0", 10);

		// Fetch rows
		const rows = await executeQuery(
			ctx.databaseName,
			`SELECT * FROM "${ctx.targetEntity.tableName}" ${whereClause} ORDER BY "${safeSort}" ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
			[...filterParams, limit, offset],
		);

		logAppEvent(ctx.databaseName, {
			level: "info",
			category: "entity",
			eventType: "app.entity.query",
			message: `Listed ${relationName} for ${entityName}/${id}: ${rows.length} rows`,
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
		console.error("[Data API] GET relation error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST — Create a child record under a parent, auto-injecting the parent FK.
 *
 * Body: JSON object with child field values (parent FK is auto-set).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, entity: entityName, id, relation: relationName } = await params;
		const ctx = await resolveRelationContext(appId, entityName, relationName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		// Rate limit writes for end-users
		if (!ctx.apiKeyValid) {
			const ip = getClientIp(request);
			const rateCheck = checkRateLimit("data-write", `${appId}:${ip}`, 60, 60_000);
			if (!rateCheck.allowed) {
				return NextResponse.json(
					{ error: "Too many write requests. Please try again later." },
					{ status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)) } },
				);
			}
		}

		const parentId = Number.parseInt(id, 10);
		if (Number.isNaN(parentId)) {
			return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
		}

		// Verify parent exists
		const parentRows = await executeQuery(
			ctx.databaseName,
			`SELECT id FROM "${ctx.parentEntity.tableName}" WHERE id = $1`,
			[parentId],
		);
		if (parentRows.length === 0) {
			return NextResponse.json({ error: "Parent record not found" }, { status: 404 });
		}

		const body = await request.json();
		if (!body || typeof body !== "object") {
			return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
		}

		// RLS enforcement on target entity
		let rlsAutoFields: Record<string, unknown> = {};
		if (!ctx.apiKeyValid) {
			const user = await resolveAppUser(ctx.databaseName, request);
			const policy = await getEntityPolicy(ctx.appDb.appDbId, ctx.targetEntity.tableName);
			const entityFields = ctx.targetEntity.fields.map((f) => f.name);
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

		// Run beforeCreate hook
		let hookBody = body;
		const hookResult = await runEntityHook({
			databaseName: ctx.databaseName,
			appDbId: ctx.appDb.appDbId,
			appId,
			entity: ctx.targetEntity.tableName,
			hookType: "beforeCreate",
			data: { ...body, [ctx.fkColumn]: parentId },
			user: await resolveAppUser(ctx.databaseName, request).catch(() => null),
		});
		if (hookResult.abort) {
			return NextResponse.json({ error: hookResult.abort }, { status: 400 });
		}
		if (hookResult.data) hookBody = hookResult.data;

		// Build INSERT — auto-inject parent FK
		const fieldMap = new Map(ctx.targetEntity.fields.map((f) => [f.name, f]));
		const fields: string[] = [];
		const values: unknown[] = [];
		const placeholders: string[] = [];
		let paramIndex = 1;

		// Inject RLS auto-fields first
		for (const [key, value] of Object.entries(rlsAutoFields)) {
			fields.push(`"${key}"`);
			values.push(value);
			placeholders.push(`$${paramIndex}`);
			paramIndex++;
		}

		// Inject parent FK
		fields.push(`"${ctx.fkColumn}"`);
		values.push(parentId);
		placeholders.push(`$${paramIndex}`);
		paramIndex++;

		for (const [key, value] of Object.entries(hookBody)) {
			if (key === ctx.fkColumn) continue; // Already injected
			if (key in rlsAutoFields) continue;

			const field = fieldMap.get(key);
			if (field) {
				const coerced = value === "" && field.type !== "text" ? null : value;
				fields.push(`"${key}"`);
				values.push(coerced);
				placeholders.push(`$${paramIndex}`);
				paramIndex++;
			}
		}

		if (fields.length === 0) {
			return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
		}

		const rows = await executeQuery(
			ctx.databaseName,
			`INSERT INTO "${ctx.targetEntity.tableName}" (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
			values,
		);

		logAppEvent(ctx.databaseName, {
			level: "info",
			category: "entity",
			eventType: "app.entity.create",
			message: `Created ${relationName} row for ${entityName}/${id}`,
			metadata: { entityName: ctx.targetEntity.tableName, parentEntity: entityName, parentId },
		});

		emitDataEvent(appId, { entity: ctx.targetEntity.tableName, action: "created", record: rows[0] as Record<string, unknown> });
		dispatchWebhooks(ctx.app.dbId, appId, "entity.created", ctx.targetEntity.tableName, rows[0]);

		// Run afterCreate hook (fire-and-forget)
		runEntityHook({
			databaseName: ctx.databaseName,
			appDbId: ctx.appDb.appDbId,
			appId,
			entity: ctx.targetEntity.tableName,
			hookType: "afterCreate",
			data: rows[0] as Record<string, unknown>,
			user: await resolveAppUser(ctx.databaseName, request).catch(() => null),
		}).catch(() => {});

		return NextResponse.json({ data: rows[0] }, { status: 201 });
	} catch (error) {
		console.error("[Data API] POST relation error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
