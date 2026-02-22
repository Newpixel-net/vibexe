/**
 * Dynamic Data API — Single Row Operations
 *
 * GET    /api/apps/{appId}/data/{entity}/{id}  — Get a single row
 * PUT    /api/apps/{appId}/data/{entity}/{id}  — Update a row
 * DELETE /api/apps/{appId}/data/{entity}/{id}  — Delete a row
 *
 * Auth: X-Vibexe-Api-Key header OR platform session cookie.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { executeQuery } from "@/lib/app-database/pool-manager";
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

	// Check internal tables first (e.g. _app_users, _app_sessions)
	const internalTable = INTERNAL_TABLES[entityName];
	if (internalTable) {
		const apiKey = request.headers.get("x-vibexe-api-key");
		if (apiKey) {
			const valid = await verifyApiKey(app.dbId, apiKey);
			if (!valid) return { error: "Invalid API key", status: 401 } as const;
		}
		return { app, appDb, entity: internalTable, databaseName: appDb.databaseName };
	}

	const schema = appDb.schemaJson as AppSchema | null;
	if (!schema?.entities?.length) {
		return { error: "No entities defined", status: 404 } as const;
	}

	const entity = schema.entities.find((e) => e.tableName === entityName);
	if (!entity) {
		return { error: `Entity '${entityName}' not found`, status: 404 } as const;
	}

	const apiKey = request.headers.get("x-vibexe-api-key");
	if (apiKey) {
		const valid = await verifyApiKey(app.dbId, apiKey);
		if (!valid) return { error: "Invalid API key", status: 401 } as const;
	}

	return { app, appDb, entity, databaseName: appDb.databaseName };
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

		const rows = await executeQuery(
			ctx.databaseName,
			`SELECT * FROM "${ctx.entity.tableName}" WHERE id = $1`,
			[rowId],
		);

		if (rows.length === 0) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
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

		const validFieldNames = new Set(ctx.entity.fields.map((f) => f.name));
		const setClauses: string[] = [];
		const values: unknown[] = [];
		let paramIndex = 1;

		for (const [key, value] of Object.entries(body)) {
			if (validFieldNames.has(key)) {
				setClauses.push(`"${key}" = $${paramIndex}`);
				values.push(value);
				paramIndex++;
			}
		}

		if (setClauses.length === 0) {
			return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
		}

		// Always update updated_at
		setClauses.push(`"updated_at" = NOW()`);

		values.push(rowId);
		const rows = await executeQuery(
			ctx.databaseName,
			`UPDATE "${ctx.entity.tableName}" SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
			values,
		);

		if (rows.length === 0) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

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

		const rows = await executeQuery(
			ctx.databaseName,
			`DELETE FROM "${ctx.entity.tableName}" WHERE id = $1 RETURNING id`,
			[rowId],
		);

		if (rows.length === 0) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		return NextResponse.json({ success: true, deleted: rowId });
	} catch (error) {
		console.error("[Data API] DELETE error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
