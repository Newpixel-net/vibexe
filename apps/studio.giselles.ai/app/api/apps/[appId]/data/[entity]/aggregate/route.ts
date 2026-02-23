/**
 * Aggregation API — Grouped statistics for entity data.
 *
 * GET /api/apps/{appId}/data/{entity}/aggregate
 *   ?group=status
 *   &count=true
 *   &sum=amount
 *   &avg=price
 *   &min=created_at
 *   &max=updated_at
 *   &filter[status]=active
 *   &filter[amount][gte]=100
 *
 * Auth: Same as entity list (API key or builder session, with RLS enforcement).
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { executeQuery } from "@/lib/app-database/pool-manager";
import { resolveAppUser, getEntityPolicy, enforceRLS } from "@/lib/app-database/rls";
import type { AppSchema, EntityField } from "@/lib/app-database/schema-types";
import { INTERNAL_TABLES, MAX_IN_FILTER_ITEMS } from "@/lib/app-database/internal-tables";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";

interface RouteParams {
	params: Promise<{ appId: string; entity: string }>;
}

// ─── Filter Operators (same as entity route) ────────────────────────────────

const FILTER_OPERATORS: Record<string, string> = {
	eq: "=",
	gte: ">=",
	gt: ">",
	lte: "<=",
	lt: "<",
	ne: "!=",
	like: "ILIKE",
};

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

	const filterRegex = /^filter\[(\w+)\](?:\[(\w+)\])?$/;

	for (const [key, value] of searchParams) {
		const match = key.match(filterRegex);
		if (!match) continue;

		const fieldName = match[1];
		const operator = match[2];

		if (!validFields.has(fieldName)) continue;

		if (!operator || operator === "eq") {
			clauses.push(`"${fieldName}" = $${idx}`);
			params.push(value);
			idx++;
		} else if (operator === "in") {
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
			return { clauses: [], params: [], paramCount: 0, error: `Unknown filter operator: '${operator}'. Supported: eq, gte, gt, lte, lt, ne, like, in` };
		}
	}

	return { clauses, params, paramCount: idx - 1 };
}

// Internal tables imported from @/lib/app-database/internal-tables

// ─── Resolve context (shared pattern) ───────────────────────────────────────

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

	let apiKeyValid = false;
	const apiKey = request.headers.get("x-vibexe-api-key");
	if (apiKey) {
		apiKeyValid = !!(await verifyApiKey(app.dbId, apiKey));
		if (!apiKeyValid) return { error: "Invalid API key", status: 401 } as const;
	}

	if (!apiKeyValid) {
		try {
			await verifyAppAccess(appId);
			apiKeyValid = true;
		} catch {
			// Not a builder session or no access
		}
	}

	const internalTable = INTERNAL_TABLES[entityName];
	if (internalTable) {
		// SECURITY: Internal tables require API key or builder session.
		if (!apiKeyValid) {
			return { error: "Internal tables require admin access", status: 403 } as const;
		}
		return { app, appDb, entity: internalTable, databaseName: appDb.databaseName, apiKeyValid, isInternal: true as const };
	}

	const schema = appDb.schemaJson as AppSchema | null;
	if (!schema?.entities?.length) {
		return { error: "No entities defined", status: 404 } as const;
	}

	const entity = schema.entities.find((e) => e.tableName === entityName);
	if (!entity) {
		return { error: `Entity '${entityName}' not found`, status: 404 } as const;
	}

	return { app, appDb, entity, databaseName: appDb.databaseName, apiKeyValid, isInternal: false as const };
}

// ─── GET handler ────────────────────────────────────────────────────────────

const NUMERIC_TYPES = new Set(["number", "integer", "float"]);

export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, entity: entityName } = await params;
		const ctx = await resolveContext(appId, entityName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const url = new URL(request.url);

		// Parse filters
		const parsed = parseAdvancedFilters(url.searchParams, ctx.entity.fields);
		if ("error" in parsed && parsed.error) {
			return NextResponse.json({ error: parsed.error }, { status: 400 });
		}
		const filters: string[] = [...parsed.clauses];
		const filterParams: unknown[] = [...parsed.params];
		let paramIndex = parsed.paramCount + 1;

		// RLS enforcement
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

			for (const clause of rls.whereClauses) {
				filters.push(clause);
			}
			filterParams.push(...rls.whereParams);
			paramIndex += rls.whereParams.length;
		}

		const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

		// Validate field names
		const validFields = new Set([
			"id",
			"created_at",
			"updated_at",
			...ctx.entity.fields.map((f) => f.name),
		]);
		const fieldTypeMap = new Map<string, string>(
			ctx.entity.fields.map((f) => [f.name, f.type]),
		);
		fieldTypeMap.set("id", "number");
		fieldTypeMap.set("created_at", "date");
		fieldTypeMap.set("updated_at", "date");

		// Parse aggregation params
		const groupField = url.searchParams.get("group");
		const wantCount = url.searchParams.get("count") === "true";
		const sumField = url.searchParams.get("sum");
		const avgField = url.searchParams.get("avg");
		const minField = url.searchParams.get("min");
		const maxField = url.searchParams.get("max");

		// Validate group field
		if (groupField && !validFields.has(groupField)) {
			return NextResponse.json(
				{ error: `Invalid group field: ${groupField}` },
				{ status: 400 },
			);
		}

		// Validate numeric fields for sum/avg
		for (const [label, field] of [["sum", sumField], ["avg", avgField]] as const) {
			if (field) {
				if (!validFields.has(field)) {
					return NextResponse.json(
						{ error: `Invalid ${label} field: ${field}` },
						{ status: 400 },
					);
				}
				const fType = fieldTypeMap.get(field);
				if (fType && !NUMERIC_TYPES.has(fType)) {
					return NextResponse.json(
						{ error: `Field '${field}' is not numeric (cannot use ${label})` },
						{ status: 400 },
					);
				}
			}
		}

		// Validate min/max fields
		for (const [label, field] of [["min", minField], ["max", maxField]] as const) {
			if (field && !validFields.has(field)) {
				return NextResponse.json(
					{ error: `Invalid ${label} field: ${field}` },
					{ status: 400 },
				);
			}
		}

		// Build SELECT columns
		const selectParts: string[] = [];
		if (groupField) selectParts.push(`"${groupField}"`);
		if (wantCount) selectParts.push("COUNT(*)::int as count");
		if (sumField) selectParts.push(`SUM("${sumField}")::numeric as "sum_${sumField}"`);
		if (avgField) selectParts.push(`AVG("${avgField}")::numeric as "avg_${avgField}"`);
		if (minField) selectParts.push(`MIN("${minField}") as "min_${minField}"`);
		if (maxField) selectParts.push(`MAX("${maxField}") as "max_${maxField}"`);


		if (selectParts.length === 0) {
			return NextResponse.json(
				{ error: "At least one aggregation param required (count, sum, avg, min, max)" },
				{ status: 400 },
			);
		}

		const groupByClause = groupField ? `GROUP BY "${groupField}"` : "";
		const orderByClause = groupField
			? `ORDER BY "${groupField}" ASC`
			: "";

		const sql = `SELECT ${selectParts.join(", ")} FROM "${ctx.entity.tableName}" ${whereClause} ${groupByClause} ${orderByClause}`;

		const rows = await executeQuery(
			ctx.databaseName,
			sql,
			filterParams,
		);

		return NextResponse.json({ data: rows });
	} catch (error) {
		console.error("[Aggregate API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
