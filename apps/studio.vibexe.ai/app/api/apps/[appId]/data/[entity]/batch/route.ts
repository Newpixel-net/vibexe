/**
 * Batch Data API — Bulk Create, Update, Delete
 *
 * POST   /api/apps/{appId}/data/{entity}/batch  — Bulk create rows
 * PUT    /api/apps/{appId}/data/{entity}/batch  — Bulk update rows
 * DELETE /api/apps/{appId}/data/{entity}/batch  — Bulk delete rows
 *
 * All operations run inside a single database transaction for atomicity.
 * Returns detailed results with per-row success/error information.
 *
 * Auth: X-Vibexe-Api-Key header, builder session, or Bearer token (end-user).
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import { logAppEvent } from "@/lib/app-database/app-logger";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { emitDataEvent } from "@/lib/realtime/event-bus";
import { withTransaction } from "@/lib/app-database/pool-manager";
import { resolveAppUser, getEntityPolicy, enforceRLS } from "@/lib/app-database/rls";
import type { AppSchema } from "@/lib/app-database/schema-types";
import { INTERNAL_TABLES } from "@/lib/app-database/internal-tables";
import { dispatchWebhooks } from "@/lib/app-webhooks/dispatcher";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

const MAX_BATCH_SIZE = 500;

interface RouteParams {
	params: Promise<{ appId: string; entity: string }>;
}

/**
 * Shared context resolution (same pattern as main data route).
 */
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
			// Not a builder session
		}
	}

	// Internal tables not supported for batch operations
	if (INTERNAL_TABLES[entityName]) {
		return { error: "Batch operations not supported for internal tables", status: 400 } as const;
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
	};
}

/**
 * POST — Bulk create rows.
 *
 * Body: { records: [ { field: value, ... }, ... ] }
 * Returns: { created: number, errors: number, results: [...] }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, entity: entityName } = await params;
		const ctx = await resolveContext(appId, entityName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		// Rate limit for end-users
		if (!ctx.apiKeyValid) {
			const ip = getClientIp(request);
			const rateCheck = checkRateLimit("data-batch", `${appId}:${ip}`, 10, 60_000);
			if (!rateCheck.allowed) {
				return NextResponse.json(
					{ error: "Too many batch requests. Please try again later." },
					{ status: 429 },
				);
			}
		}

		// RLS enforcement
		let rlsAutoFields: Record<string, unknown> = {};
		if (!ctx.apiKeyValid) {
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

		const body = await request.json();
		const records = body?.records;
		if (!Array.isArray(records) || records.length === 0) {
			return NextResponse.json(
				{ error: "Body must contain a 'records' array with at least one item" },
				{ status: 400 },
			);
		}
		if (records.length > MAX_BATCH_SIZE) {
			return NextResponse.json(
				{ error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} records` },
				{ status: 400 },
			);
		}

		const fieldMap = new Map(ctx.entity.fields.map((f) => [f.name, f]));

		// Build a single multi-row INSERT for efficiency
		// All records share the same columns set (union of all provided fields)
		const allFieldNames = new Set<string>();
		for (const [key] of Object.entries(rlsAutoFields)) {
			allFieldNames.add(key);
		}
		for (const record of records) {
			if (typeof record !== "object" || record === null) continue;
			for (const key of Object.keys(record)) {
				if (key in rlsAutoFields) continue;
				if (fieldMap.has(key)) allFieldNames.add(key);
			}
		}

		if (allFieldNames.size === 0) {
			return NextResponse.json(
				{ error: "No valid fields found in records" },
				{ status: 400 },
			);
		}

		const columns = Array.from(allFieldNames);
		const columnsSql = columns.map((c) => `"${c}"`).join(", ");

		// Build VALUES rows with parameterized placeholders
		const allParams: unknown[] = [];
		const valueRows: string[] = [];
		let paramIdx = 1;

		for (const record of records) {
			if (typeof record !== "object" || record === null) continue;

			const placeholders: string[] = [];
			for (const col of columns) {
				if (col in rlsAutoFields) {
					allParams.push(rlsAutoFields[col]);
				} else {
					const field = fieldMap.get(col);
					const rawVal = (record as Record<string, unknown>)[col];
					const coerced = rawVal === "" && field && field.type !== "text" ? null : (rawVal ?? null);
					allParams.push(coerced);
				}
				placeholders.push(`$${paramIdx}`);
				paramIdx++;
			}
			valueRows.push(`(${placeholders.join(", ")})`);
		}

		if (valueRows.length === 0) {
			return NextResponse.json(
				{ error: "No valid records to insert" },
				{ status: 400 },
			);
		}

		// Execute as a single INSERT ... VALUES (...), (...), ... RETURNING *
		const created = await withTransaction(ctx.databaseName, async (query) => {
			return query(
				`INSERT INTO "${ctx.entity.tableName}" (${columnsSql}) VALUES ${valueRows.join(", ")} RETURNING *`,
				allParams,
			);
		});

		// Emit events + webhooks (fire-and-forget, batch them)
		for (const row of created) {
			emitDataEvent(appId, { entity: entityName, action: "created", record: row });
		}
		if (created.length > 0) {
			dispatchWebhooks(ctx.app.dbId, appId, "entity.created", entityName, {
				batch: true,
				count: created.length,
				first: created[0],
			});
		}

		logAppEvent(ctx.databaseName, {
			level: "info",
			category: "entity",
			eventType: "app.entity.batch_create",
			message: `Batch created ${created.length} rows in ${entityName}`,
		});

		return NextResponse.json({
			created: created.length,
			data: created,
		}, { status: 201 });
	} catch (error) {
		console.error("[Data API] Batch POST error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * PUT — Bulk update rows.
 *
 * Body: { updates: [ { id: 1, data: { field: value } }, ... ] }
 * Returns: { updated: number, errors: number, results: [...] }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, entity: entityName } = await params;
		const ctx = await resolveContext(appId, entityName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		if (!ctx.apiKeyValid) {
			const ip = getClientIp(request);
			const rateCheck = checkRateLimit("data-batch", `${appId}:${ip}`, 10, 60_000);
			if (!rateCheck.allowed) {
				return NextResponse.json(
					{ error: "Too many batch requests. Please try again later." },
					{ status: 429 },
				);
			}
		}

		// RLS enforcement for end-users
		let rlsWriteCheck: { whereClauses: string[]; whereParams: unknown[] } = { whereClauses: [], whereParams: [] };
		if (!ctx.apiKeyValid) {
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
			rlsWriteCheck = { whereClauses: rls.whereClauses, whereParams: rls.whereParams };
		}

		const body = await request.json();
		const updates = body?.updates;
		if (!Array.isArray(updates) || updates.length === 0) {
			return NextResponse.json(
				{ error: "Body must contain an 'updates' array with at least one item" },
				{ status: 400 },
			);
		}
		if (updates.length > MAX_BATCH_SIZE) {
			return NextResponse.json(
				{ error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} records` },
				{ status: 400 },
			);
		}

		const fieldMap = new Map(ctx.entity.fields.map((f) => [f.name, f]));

		const results = await withTransaction(ctx.databaseName, async (query) => {
			const allResults: { id: number | string; success: boolean; data?: Record<string, unknown>; error?: string }[] = [];

			for (const item of updates) {
				const id = item?.id;
				const data = item?.data;
				if (!id || !data || typeof data !== "object") {
					allResults.push({ id: id ?? "unknown", success: false, error: "Missing id or data" });
					continue;
				}

				const setClauses: string[] = [];
				const params: unknown[] = [];
				let pIdx = 1;

				for (const [key, value] of Object.entries(data)) {
					const field = fieldMap.get(key);
					if (!field) continue;
					const coerced = value === "" && field.type !== "text" ? null : value;
					setClauses.push(`"${key}" = $${pIdx}`);
					params.push(coerced);
					pIdx++;
				}

				if (setClauses.length === 0) {
					allResults.push({ id, success: false, error: "No valid fields to update" });
					continue;
				}

				setClauses.push(`"updated_at" = NOW()`);
				params.push(id);

				// Build WHERE clause: id = $N + RLS conditions
				const whereParts = [`id = $${pIdx}`];
				for (const clause of rlsWriteCheck.whereClauses) {
					pIdx++;
					// Re-parameterize: replace $1 in the clause with the new param index
					whereParts.push(clause.replace(/\$\d+/g, `$${pIdx}`));
					params.push(...rlsWriteCheck.whereParams);
				}

				const rows = await query(
					`UPDATE "${ctx.entity.tableName}" SET ${setClauses.join(", ")} WHERE ${whereParts.join(" AND ")} RETURNING *`,
					params,
				);

				if (rows.length > 0) {
					allResults.push({ id, success: true, data: rows[0] });
				} else {
					allResults.push({ id, success: false, error: "Row not found or access denied" });
				}
			}

			return allResults;
		});

		const succeeded = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success);

		// Emit events for updated rows
		for (const r of succeeded) {
			if (r.data) {
				emitDataEvent(appId, { entity: entityName, action: "updated", record: r.data });
			}
		}
		if (succeeded.length > 0) {
			dispatchWebhooks(ctx.app.dbId, appId, "entity.updated", entityName, {
				batch: true,
				count: succeeded.length,
			});
		}

		logAppEvent(ctx.databaseName, {
			level: "info",
			category: "entity",
			eventType: "app.entity.batch_update",
			message: `Batch updated ${succeeded.length}/${results.length} rows in ${entityName}`,
		});

		return NextResponse.json({
			updated: succeeded.length,
			errors: failed.length,
			results,
		});
	} catch (error) {
		console.error("[Data API] Batch PUT error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE — Bulk delete rows.
 *
 * Body: { ids: [1, 2, 3, ...] }
 * Returns: { deleted: number }
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, entity: entityName } = await params;
		const ctx = await resolveContext(appId, entityName, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		if (!ctx.apiKeyValid) {
			const ip = getClientIp(request);
			const rateCheck = checkRateLimit("data-batch", `${appId}:${ip}`, 10, 60_000);
			if (!rateCheck.allowed) {
				return NextResponse.json(
					{ error: "Too many batch requests. Please try again later." },
					{ status: 429 },
				);
			}
		}

		// RLS enforcement for end-users
		let rlsDeleteCheck: { whereClauses: string[]; whereParams: unknown[] } = { whereClauses: [], whereParams: [] };
		if (!ctx.apiKeyValid) {
			const user = await resolveAppUser(ctx.databaseName, request);
			const policy = await getEntityPolicy(ctx.appDb.appDbId, entityName);
			const entityFields = ctx.entity.fields.map((f) => f.name);
			const rls = enforceRLS({
				policy,
				operation: "delete",
				user,
				paramOffset: 1, // $1 is the ids array
				entityFields,
			});
			if (!rls.allowed) {
				return NextResponse.json({ error: rls.error }, { status: rls.status });
			}
			rlsDeleteCheck = { whereClauses: rls.whereClauses, whereParams: rls.whereParams };
		}

		const body = await request.json();
		const ids = body?.ids;
		if (!Array.isArray(ids) || ids.length === 0) {
			return NextResponse.json(
				{ error: "Body must contain an 'ids' array with at least one item" },
				{ status: 400 },
			);
		}
		if (ids.length > MAX_BATCH_SIZE) {
			return NextResponse.json(
				{ error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} IDs` },
				{ status: 400 },
			);
		}

		// Build WHERE clause: id = ANY($1::int[]) + RLS conditions
		const deleteWhere = [`id = ANY($1::int[])`];
		const deleteParams: unknown[] = [ids];
		let dIdx = 1;
		for (const clause of rlsDeleteCheck.whereClauses) {
			dIdx++;
			deleteWhere.push(clause.replace(/\$\d+/g, `$${dIdx}`));
			deleteParams.push(...rlsDeleteCheck.whereParams);
		}

		const deleted = await withTransaction(ctx.databaseName, async (query) => {
			return query<{ id: number }>(
				`DELETE FROM "${ctx.entity.tableName}" WHERE ${deleteWhere.join(" AND ")} RETURNING id`,
				deleteParams,
			);
		});

		// Emit events for deleted rows
		for (const row of deleted) {
			emitDataEvent(appId, {
				entity: entityName,
				action: "deleted",
				record: row as Record<string, unknown>,
			});
		}
		if (deleted.length > 0) {
			dispatchWebhooks(ctx.app.dbId, appId, "entity.deleted", entityName, {
				batch: true,
				count: deleted.length,
				ids: deleted.map((r) => r.id),
			});
		}

		logAppEvent(ctx.databaseName, {
			level: "info",
			category: "entity",
			eventType: "app.entity.batch_delete",
			message: `Batch deleted ${deleted.length} rows from ${entityName}`,
		});

		return NextResponse.json({ deleted: deleted.length });
	} catch (error) {
		console.error("[Data API] Batch DELETE error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function OPTIONS() {
	return new Response(null, {
		status: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, X-Vibexe-Api-Key, Authorization",
			"Access-Control-Max-Age": "86400",
		},
	});
}
