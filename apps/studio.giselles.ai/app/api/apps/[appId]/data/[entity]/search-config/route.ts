/**
 * Search Config API — Configure full-text search fields and weights per entity.
 *
 * GET  /api/apps/{appId}/data/{entity}/search-config — Get current config
 * PUT  /api/apps/{appId}/data/{entity}/search-config — Update config + apply migration
 *
 * Auth: Builder session only (not end-user accessible).
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import type { AppSchema, SearchFieldConfig } from "@/lib/app-database/schema-types";
import { applySearchVector } from "@/lib/app-database/schema-executor";
import { getUser } from "@/lib/auth/get-user";

interface RouteParams {
	params: Promise<{ appId: string; entity: string }>;
}

async function resolveAppAndEntity(appId: string, entityName: string) {
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

	const schema = appDb.schemaJson as AppSchema | null;
	if (!schema?.entities?.length) {
		return { error: "No entities defined", status: 404 } as const;
	}

	const entityIndex = schema.entities.findIndex((e) => e.tableName === entityName);
	if (entityIndex === -1) {
		return { error: `Entity '${entityName}' not found`, status: 404 } as const;
	}

	return { appDb, schema, entityIndex };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const user = await getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { appId, entity: entityName } = await params;
		const ctx = await resolveAppAndEntity(appId, entityName);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const entity = ctx.schema.entities[ctx.entityIndex];
		const textFields = entity.fields.filter((f) => f.type === "text").map((f) => f.name);

		return NextResponse.json({
			searchConfig: entity.searchConfig || null,
			textFields,
			entityName: entity.name,
		});
	} catch (error) {
		console.error("[Search Config] GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
	try {
		const user = await getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { appId, entity: entityName } = await params;
		const ctx = await resolveAppAndEntity(appId, entityName);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const body = await request.json();
		const newConfig: SearchFieldConfig[] | null = body.searchConfig ?? null;

		// Validate fields exist and are text type
		const entity = ctx.schema.entities[ctx.entityIndex];
		const textFieldNames = new Set(
			entity.fields.filter((f) => f.type === "text").map((f) => f.name),
		);

		if (newConfig) {
			for (const sc of newConfig) {
				if (!textFieldNames.has(sc.field)) {
					return NextResponse.json(
						{ error: `Field '${sc.field}' is not a text field` },
						{ status: 400 },
					);
				}
				if (!["A", "B", "C", "D"].includes(sc.weight)) {
					return NextResponse.json(
						{ error: `Invalid weight '${sc.weight}' for field '${sc.field}'` },
						{ status: 400 },
					);
				}
			}
		}

		// Update schema in platform DB
		const updatedSchema = { ...ctx.schema };
		updatedSchema.entities = [...ctx.schema.entities];
		updatedSchema.entities[ctx.entityIndex] = {
			...entity,
			searchConfig: newConfig || undefined,
		};

		await db
			.update(builderAppDatabases)
			.set({ schemaJson: updatedSchema })
			.where(eq(builderAppDatabases.dbId, ctx.appDb.dbId));

		// Apply tsvector migration to app database
		await applySearchVector(
			ctx.appDb.databaseName,
			updatedSchema.entities[ctx.entityIndex],
		);

		return NextResponse.json({
			success: true,
			searchConfig: newConfig,
		});
	} catch (error) {
		console.error("[Search Config] PUT error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
