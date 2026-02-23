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
import type { AppSchema, EntityField } from "@/lib/app-database/schema-types";
import { INTERNAL_TABLES, MAX_IN_FILTER_ITEMS, getInternalSelectColumns } from "@/lib/app-database/internal-tables";
import { runEntityHook } from "@/lib/app-functions/hooks";
import { dispatchWebhooks } from "@/lib/app-webhooks/dispatcher";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

// ─── Advanced Filter Operators ──────────────────────────────────────────────

const FILTER_OPERATORS: Record<string, string> = {
	eq: "=",
	gte: ">=",
	gt: ">",
	lte: "<=",
	lt: "<",
	ne: "!=",
	like: "ILIKE",
};

/**
 * Parse advanced filter query params into SQL WHERE clauses.
 *
 * Supported formats:
 *   filter[field]=value           → "field" = $N          (equality, backward-compatible)
 *   filter[field][gte]=100        → "field" >= $N
 *   filter[field][like]=John%     → "field" ILIKE $N
 *   filter[field][in]=a,b,c       → "field" = ANY($N::text[])
 */
function parseAdvancedFilters(
	searchParams: URLSearchParams,
	entityFields: EntityField[],
): { clauses: string[]; params: unknown[]; paramCount: number } {
	const validFields = new Set([
		"id",
		"created_at",
		"updated_at",
		...entityFields.map((f) => f.name),
	]);
	const clauses: string[] = [];
	const params: unknown[] = [];
	let idx = 1;

	// Match filter[field] or filter[field][operator]
	const filterRegex = /^filter\[(\w+)\](?:\[(\w+)\])?$/;

	for (const [key, value] of searchParams) {
		const match = key.match(filterRegex);
		if (!match) continue;

		const fieldName = match[1];
		const operator = match[2]; // undefined for plain equality

		if (!validFields.has(fieldName)) continue;

		if (!operator || operator === "eq") {
			// Equality: filter[status]=active
			clauses.push(`"${fieldName}" = $${idx}`);
			params.push(value);
			idx++;
		} else if (operator === "in") {
			// IN: filter[status][in]=active,pending
			const values = value.split(",").map((v) => v.trim()).filter(Boolean);
			if (values.length > MAX_IN_FILTER_ITEMS) {
				return { clauses: [], params: [], paramCount: 0, error: `IN filter for '${fieldName}' exceeds maximum of ${MAX_IN_FILTER_ITEMS} values` } as ReturnType<typeof parseAdvancedFilters>;
			}
			clauses.push(`"${fieldName}" = ANY($${idx}::text[])`);
			params.push(values);
			idx++;
		} else if (FILTER_OPERATORS[operator]) {
			clauses.push(`"${fieldName}" ${FILTER_OPERATORS[operator]} $${idx}`);
			params.push(value);
			idx++;
		} else {
			// Reject unknown operators instead of silently ignoring
			return { clauses: [], params: [], paramCount: 0, error: `Unknown filter operator: '${operator}'. Supported: eq, gte, gt, lte, lt, ne, like, in` };
		}
	}

	return { clauses, params, paramCount: idx - 1 };
}

/**
 * Check if a column exists in a table.
 * Used to detect _search_vector for full-text search.
 */
async function checkColumnExists(
	databaseName: string,
	tableName: string,
	columnName: string,
): Promise<boolean> {
	const result = await executeQuery<{ exists: boolean }>(
		databaseName,
		`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2) as exists`,
		[tableName, columnName],
	);
	return result[0]?.exists === true;
}

interface RouteParams {
	params: Promise<{ appId: string; entity: string }>;
}


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
		apiKeyValid = !!(await verifyApiKey(app.dbId, apiKey));
		if (!apiKeyValid) return { error: "Invalid API key", status: 401 } as const;
	}

	// Builder session fallback — verify builder owns this app via team membership
	if (!apiKeyValid) {
		try {
			await verifyAppAccess(appId);
			apiKeyValid = true;
		} catch {
			// Not a builder session or no access — continue with end-user auth
		}
	}

	// Check internal tables first (e.g. _app_users, _app_sessions)
	const internalTable = INTERNAL_TABLES[entityName];
	if (internalTable) {
		// SECURITY: Internal tables require API key or builder session.
		// End-users (Bearer token only) must NOT access _app_users/_app_sessions directly.
		if (!apiKeyValid) {
			return { error: "Internal tables require admin access", status: 403 } as const;
		}
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
			error: `Entity '${entityName}' not found`,
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

		// Build WHERE clause from advanced filter params
		const parsed = parseAdvancedFilters(url.searchParams, ctx.entity.fields);
		if ("error" in parsed && parsed.error) {
			return NextResponse.json({ error: parsed.error }, { status: 400 });
		}
		const filters: string[] = [...parsed.clauses];
		const filterParams: unknown[] = [...parsed.params];
		let paramIndex = parsed.paramCount + 1;

		// Full-text search: ?search=term
		const searchTerm = url.searchParams.get("search");
		if (searchTerm && searchTerm.trim()) {
			const trimmed = searchTerm.trim();
			const hasSearchVector = await checkColumnExists(
				ctx.databaseName,
				ctx.entity.tableName,
				"_search_vector",
			);
			if (hasSearchVector) {
				filters.push(
					`_search_vector @@ plainto_tsquery('english', $${paramIndex})`,
				);
				filterParams.push(trimmed);
				paramIndex++;
			} else {
				// Fallback: ILIKE across all text fields
				const textFields = ctx.entity.fields
					.filter((f) => f.type === "text")
					.map((f) => f.name);
				if (textFields.length > 0) {
					const ilikeConditions = textFields.map(
						(f) => `"${f}" ILIKE $${paramIndex}`,
					);
					filters.push(`(${ilikeConditions.join(" OR ")})`);
					filterParams.push(`%${trimmed}%`);
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

		// Validate sort column (support _relevance for FTS ranking)
		const validColumns = [
			"id",
			"created_at",
			"updated_at",
			...ctx.entity.fields.map((f) => f.name),
		];
		const isRelevanceSort = sort === "_relevance" && searchTerm?.trim();
		const safeSort = isRelevanceSort
			? "_relevance"
			: validColumns.includes(sort)
				? sort
				: "created_at";

		// Build ORDER BY clause
		let orderByClause: string;
		if (isRelevanceSort) {
			orderByClause = `ORDER BY ts_rank(_search_vector, plainto_tsquery('english', $${paramIndex})) DESC`;
			filterParams.push(searchTerm!.trim());
			paramIndex++;
		} else {
			orderByClause = `ORDER BY "${safeSort}" ${order}`;
		}

		// Count total
		const countResult = await executeQuery<{ count: string }>(
			ctx.databaseName,
			`SELECT COUNT(*) as count FROM "${ctx.entity.tableName}" ${whereClause}`,
			filterParams.slice(0, isRelevanceSort ? filterParams.length - 1 : filterParams.length),
		);
		const total = Number.parseInt(countResult[0]?.count || "0", 10);

		// Fetch rows (use safe column list for internal tables to exclude sensitive fields)
		const selectCols = ctx.isInternal
			? getInternalSelectColumns(ctx.entity as import("@/lib/app-database/internal-tables").InternalTableDef)
			: "*";
		const rows = await executeQuery(
			ctx.databaseName,
			`SELECT ${selectCols} FROM "${ctx.entity.tableName}" ${whereClause} ${orderByClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
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

		// Rate limit writes for end-users (API key / builder users bypass)
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

		const body = await request.json();
		if (!body || typeof body !== "object") {
			return NextResponse.json(
				{ error: "Request body must be a JSON object" },
				{ status: 400 },
			);
		}

		// Reject oversized payloads (1 MB per record)
		const bodySize = JSON.stringify(body).length;
		if (bodySize > 1_000_000) {
			return NextResponse.json(
				{ error: `Record too large (${Math.round(bodySize / 1024)} KB). Maximum size is 1 MB.` },
				{ status: 413 },
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

		const returningCols = ctx.isInternal
			? getInternalSelectColumns(ctx.entity as import("@/lib/app-database/internal-tables").InternalTableDef)
			: "*";
		const rows = await executeQuery(
			ctx.databaseName,
			`INSERT INTO "${ctx.entity.tableName}" (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING ${returningCols}`,
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

		// Dispatch webhooks (fire-and-forget)
		dispatchWebhooks(ctx.app.dbId, appId, "entity.created", entityName, rows[0]);

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
