/**
 * App Schema API
 *
 * GET /api/apps/{appId}/schema — Returns the entity schema for an app's database
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import type { AppSchema } from "@/lib/app-database/schema-types";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});

		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const appDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, app.dbId),
		});

		if (!appDb) {
			return NextResponse.json({ schema: null, status: "no_database" });
		}

		const schema = appDb.schemaJson as AppSchema | null;

		return NextResponse.json({
			schema: schema && schema.entities?.length > 0 ? schema : null,
			status: appDb.status,
			databaseName: appDb.databaseName,
		});
	} catch (error) {
		console.error("[Schema API] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
