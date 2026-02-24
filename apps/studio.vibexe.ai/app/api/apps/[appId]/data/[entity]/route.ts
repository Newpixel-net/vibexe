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
import {
	resolveIncludes,
	buildManyToOneJoins,
	qualifyWhereClause,
	fetchOneToMany,
	attachRelations,
	fieldMatchesInclude,
	findOneToManyForCreate,
	IncludeError,
	type IncludeSpec,
} from "@/lib/app-database/relation-resolver";
import { runEntityHook } from "@/lib/app-functions/hooks";
import { dispatchWebhooks } from "@/lib/app-webhooks/dispatcher";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

const DATA_CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Vibexe-Api-Key",
	"Access-Control-Max-Age": "86400",
} as const;

export function OPTIONS() {
	return new Response(null, { status: 204, headers: DATA_CORS_HEADERS });
}

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

		// Parse ?include=author,comments for relation population
		const includeParam = url.searchParams.get("include");
		let includes: IncludeSpec[] = [];
		if (includeParam && !ctx.isInternal) {
			try {
				const schema = ctx.appDb.schemaJson as AppSchema;
				includes = resolveIncludes(schema, entityName, includeParam);
			} catch (err) {
				if (err instanceof IncludeError) {
					return NextResponse.json({ error: err.message }, { status: 400 });
				}
				throw err;
			}
		}

		// ─── Deep Filters (dot-notation on related fields) ──────────────
		// Detect filter[author.name]=John style params and generate JOINs
		const deepFilterJoins: string[] = [];
		const deepFilterClauses: string[] = [];
		const deepFilterParams: unknown[] = [];
		// Track already-joined relations to avoid duplicate JOINs
		const deepFilterAliasMap = new Map<string, string>();
		let deepFilterAliasIdx = 0;

		if (!ctx.isInternal) {
			const schema = ctx.appDb.schemaJson as AppSchema;
			const deepFilterRegex = /^filter\[(\w+)\.(\w+)\](?:\[(\w+)\])?$/;

			for (const [key, value] of url.searchParams) {
				const match = key.match(deepFilterRegex);
				if (!match) continue;

				const [, relationName, fieldName, operator] = match;

				// Find the many-to-one relation field matching relationName
				const entityDef = ctx.entity as import("@/lib/app-database/schema-types").EntityDefinition;
				const relationField = entityDef.fields.find(
					(f) =>
						f.type === "relation" &&
						f.relationType === "many-to-one" &&
						f.relationTo &&
						fieldMatchesInclude(f, relationName),
				);

				if (!relationField?.relationTo) continue;

				const targetEntity = schema.entities.find((e) => e.name === relationField.relationTo);
				if (!targetEntity) continue;

				// Validate fieldName exists on target entity
				const targetFields = new Set([
					"id", "created_at", "updated_at",
					...targetEntity.fields.map((f) => f.name),
				]);
				if (!targetFields.has(fieldName)) continue;

				// Reuse alias if same relation already joined
				let alias = deepFilterAliasMap.get(relationField.name);
				if (!alias) {
					alias = `__df${deepFilterAliasIdx++}`;
					deepFilterAliasMap.set(relationField.name, alias);
					deepFilterJoins.push(
						`LEFT JOIN "${targetEntity.tableName}" ${alias} ON t."${relationField.name}" = ${alias}.id`,
					);
				}

				const pIdx = deepFilterParams.length + 1; // placeholder; will be offset later
				const sqlOp = operator ? (FILTER_OPERATORS[operator] ?? "=") : "=";
				deepFilterClauses.push(`${alias}."${fieldName}" ${sqlOp} $__DF${pIdx}__`);
				deepFilterParams.push(value);
			}
		}

		const hasDeepFilters = deepFilterJoins.length > 0;
		const hasJoins = includes.some((s) => s.strategy === "many-to-one") || hasDeepFilters;

		// Build WHERE clause from advanced filter params
		const parsed = parseAdvancedFilters(url.searchParams, ctx.entity.fields);
		if ("error" in parsed && parsed.error) {
			return NextResponse.json({ error: parsed.error }, { status: 400 });
		}
		// Qualify column references when JOINs are active
		const filters: string[] = hasJoins
			? parsed.clauses.map(qualifyWhereClause)
			: [...parsed.clauses];
		const filterParams: unknown[] = [...parsed.params];
		let paramIndex = parsed.paramCount + 1;

		// Resolve deep filter parameter placeholders to real $N indices
		for (const clause of deepFilterClauses) {
			const resolved = clause.replace(
				/\$__DF(\d+)__/g,
				(_, n) => `$${paramIndex + Number.parseInt(n, 10) - 1}`,
			);
			filters.push(resolved);
		}
		filterParams.push(...deepFilterParams);
		paramIndex += deepFilterParams.length;

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
				const svCol = hasJoins ? `t._search_vector` : `_search_vector`;
				filters.push(
					`${svCol} @@ plainto_tsquery('english', $${paramIndex})`,
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
						(f) => hasJoins ? `t."${f}" ILIKE $${paramIndex}` : `"${f}" ILIKE $${paramIndex}`,
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

			// Append RLS WHERE clauses (qualify if JOINs active)
			for (const clause of rls.whereClauses) {
				filters.push(hasJoins ? qualifyWhereClause(clause) : clause);
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
			const svCol = hasJoins ? `t._search_vector` : `_search_vector`;
			orderByClause = `ORDER BY ts_rank(${svCol}, plainto_tsquery('english', $${paramIndex})) DESC`;
			filterParams.push(searchTerm!.trim());
			paramIndex++;
		} else {
			const sortCol = hasJoins ? `t."${safeSort}"` : `"${safeSort}"`;
			orderByClause = `ORDER BY ${sortCol} ${order}`;
		}

		// Build SELECT + FROM + JOIN based on includes
		let selectExpr: string;
		let fromClause: string;

		if (hasJoins) {
			const { selectExprs, joinClauses } = buildManyToOneJoins(includes);
			// Append deep filter JOINs (separate aliases, don't conflict with include JOINs)
			const allJoins = [...joinClauses, ...deepFilterJoins];
			selectExpr = `t.*${selectExprs.length > 0 ? `, ${selectExprs.join(", ")}` : ""}`;
			fromClause = `"${ctx.entity.tableName}" t ${allJoins.join(" ")}`;
		} else {
			const selectCols = ctx.isInternal
				? getInternalSelectColumns(ctx.entity as import("@/lib/app-database/internal-tables").InternalTableDef)
				: "*";
			selectExpr = selectCols;
			fromClause = `"${ctx.entity.tableName}"`;
		}

		// Count total (include deep filter JOINs when active, since WHERE references them)
		const countFrom = hasJoins
			? `"${ctx.entity.tableName}" t ${deepFilterJoins.join(" ")}`
			: `"${ctx.entity.tableName}"`;
		const countResult = await executeQuery<{ count: string }>(
			ctx.databaseName,
			`SELECT COUNT(*) as count FROM ${countFrom} ${whereClause}`,
			filterParams.slice(0, isRelevanceSort ? filterParams.length - 1 : filterParams.length),
		);
		const total = Number.parseInt(countResult[0]?.count || "0", 10);

		// Fetch rows
		const rows = await executeQuery(
			ctx.databaseName,
			`SELECT ${selectExpr} FROM ${fromClause} ${whereClause} ${orderByClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
			[...filterParams, limit, offset],
		);

		// Post-process: fetch one-to-many children and attach all relations
		let resultRows = rows as Record<string, unknown>[];
		if (includes.length > 0) {
			const parentIds = resultRows
				.map((r) => r.id as number)
				.filter((id) => id != null);
			const otmResults = await fetchOneToMany(
				ctx.databaseName,
				includes,
				parentIds,
			);
			resultRows = attachRelations(resultRows, includes, otmResults);
		}

		// Log the query (fire-and-forget, don't await)
		logAppEvent(ctx.databaseName, {
			level: "info",
			category: "entity",
			eventType: "app.entity.query",
			message: `Listed ${entityName}: ${resultRows.length} rows returned`,
		});

		return NextResponse.json({
			data: resultRows,
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

		// Separate nested arrays (one-to-many children) from flat fields
		const nestedRelations = new Map<string, { targetEntity: import("@/lib/app-database/schema-types").EntityDefinition; fkColumn: string; children: Record<string, unknown>[] }>();
		if (!ctx.isInternal) {
			const schema = ctx.appDb.schemaJson as AppSchema;
			const entityDef = ctx.entity as import("@/lib/app-database/schema-types").EntityDefinition;
			for (const [key, value] of Object.entries(hookBody)) {
				if (Array.isArray(value)) {
					const relMatch = findOneToManyForCreate(schema, entityDef, key);
					if (relMatch) {
						nestedRelations.set(key, {
							...relMatch,
							children: value as Record<string, unknown>[],
						});
					}
				}
			}
		}

		// Filter to only known fields (skip nested array fields)
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
			// Skip nested array fields (handled after parent INSERT)
			if (nestedRelations.has(key)) continue;

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

		// If nested relations exist, wrap in a transaction
		const hasNested = nestedRelations.size > 0;
		if (hasNested) {
			await executeQuery(ctx.databaseName, "BEGIN");
		}

		let parentRow: Record<string, unknown>;
		const nestedResults = new Map<string, Record<string, unknown>[]>();

		try {
			const rows = await executeQuery(
				ctx.databaseName,
				`INSERT INTO "${ctx.entity.tableName}" (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING ${returningCols}`,
				values,
			);
			parentRow = rows[0] as Record<string, unknown>;

			// Insert nested children
			if (hasNested) {
				const parentId = parentRow.id as number;

				for (const [relName, rel] of nestedRelations) {
					const childFieldMap = new Map(rel.targetEntity.fields.map((f) => [f.name, f]));
					const createdChildren: Record<string, unknown>[] = [];

					for (const child of rel.children) {
						if (!child || typeof child !== "object") continue;

						const childFields: string[] = [`"${rel.fkColumn}"`];
						const childValues: unknown[] = [parentId];
						const childPlaceholders: string[] = ["$1"];
						let childParamIdx = 2;

						for (const [ck, cv] of Object.entries(child)) {
							if (ck === rel.fkColumn) continue; // Already injected
							const cf = childFieldMap.get(ck);
							if (cf) {
								const coerced = cv === "" && cf.type !== "text" ? null : cv;
								childFields.push(`"${ck}"`);
								childValues.push(coerced);
								childPlaceholders.push(`$${childParamIdx}`);
								childParamIdx++;
							}
						}

						if (childFields.length > 0) {
							const childRows = await executeQuery(
								ctx.databaseName,
								`INSERT INTO "${rel.targetEntity.tableName}" (${childFields.join(", ")}) VALUES (${childPlaceholders.join(", ")}) RETURNING *`,
								childValues,
							);
							if (childRows[0]) {
								createdChildren.push(childRows[0] as Record<string, unknown>);
							}
						}
					}

					nestedResults.set(relName, createdChildren);
				}

				await executeQuery(ctx.databaseName, "COMMIT");
			}
		} catch (err) {
			if (hasNested) {
				await executeQuery(ctx.databaseName, "ROLLBACK").catch(() => {});
			}
			throw err;
		}

		// Attach nested children to the response
		const responseData = { ...parentRow };
		for (const [relName, children] of nestedResults) {
			responseData[relName] = children;
		}

		// Log the creation (fire-and-forget, don't await)
		logAppEvent(ctx.databaseName, {
			level: "info",
			category: "entity",
			eventType: "app.entity.create",
			message: `Created row in ${entityName}${hasNested ? ` with ${nestedRelations.size} nested relations` : ""}`,
			metadata: { entityName },
		});

		// Emit real-time event
		emitDataEvent(appId, { entity: entityName, action: "created", record: parentRow });

		// Emit events for nested children too
		for (const [, rel] of nestedRelations) {
			for (const child of nestedResults.get(rel.targetEntity.tableName) ?? []) {
				emitDataEvent(appId, { entity: rel.targetEntity.tableName, action: "created", record: child });
			}
		}

		// Dispatch webhooks (fire-and-forget)
		dispatchWebhooks(ctx.app.dbId, appId, "entity.created", entityName, parentRow);

		// Run afterCreate hook (fire-and-forget)
		if (!ctx.isInternal) {
			runEntityHook({
				databaseName: ctx.databaseName,
				appDbId: ctx.appDb.appDbId,
				appId,
				entity: entityName,
				hookType: "afterCreate",
				data: parentRow,
				user: await resolveAppUser(ctx.databaseName, request).catch(() => null),
			}).catch(() => {});
		}

		return NextResponse.json({ data: responseData }, { status: 201 });
	} catch (error) {
		console.error("[Data API] POST error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
