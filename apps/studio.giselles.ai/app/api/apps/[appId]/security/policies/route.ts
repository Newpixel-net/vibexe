/**
 * Entity Access Policies API
 *
 * GET  /api/apps/{appId}/security/policies — List all entity policies
 * PUT  /api/apps/{appId}/security/policies — Update a specific entity's policy
 */

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppDatabases,
	builderAppEntityPolicies,
} from "@/db/schema";
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

		// Get schema to know which entities exist
		const appDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, app.dbId),
		});

		const schema = appDb?.schemaJson as AppSchema | null;
		const entityNames = schema?.entities?.map((e) => e.tableName) ?? [];

		// Get persisted policies
		const policies = await db.query.builderAppEntityPolicies.findMany({
			where: eq(builderAppEntityPolicies.appDbId, app.dbId),
		});

		// Build response: merge persisted + defaults for entities without policies
		const policyMap = new Map(policies.map((p) => [p.entityName, p]));
		const result = entityNames.map((name) => {
			const existing = policyMap.get(name);
			return {
				entityName: name,
				readAccess: existing?.readAccess ?? "public",
				writeAccess: existing?.writeAccess ?? "authenticated",
				deleteAccess: existing?.deleteAccess ?? "authenticated",
				ownerField: existing?.ownerField ?? "user_id",
			};
		});

		return NextResponse.json({ policies: result });
	} catch (error) {
		console.error("[Security Policies API] GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function PUT(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const body = await request.json();
		const { entityName, readAccess, writeAccess, deleteAccess } = body as {
			entityName: string;
			readAccess?: string;
			writeAccess?: string;
			deleteAccess?: string;
		};

		if (!entityName) {
			return NextResponse.json({ error: "entityName required" }, { status: 400 });
		}

		const validLevels = ["public", "authenticated", "owner"];
		const values = {
			appDbId: app.dbId,
			entityName,
			readAccess: validLevels.includes(readAccess ?? "") ? readAccess! : "public",
			writeAccess: validLevels.includes(writeAccess ?? "") ? writeAccess! : "authenticated",
			deleteAccess: validLevels.includes(deleteAccess ?? "") ? deleteAccess! : "authenticated",
		};

		// Check if policy exists
		const existing = await db.query.builderAppEntityPolicies.findFirst({
			where: and(
				eq(builderAppEntityPolicies.appDbId, app.dbId),
				eq(builderAppEntityPolicies.entityName, entityName),
			),
		});

		if (existing) {
			await db
				.update(builderAppEntityPolicies)
				.set({
					readAccess: values.readAccess,
					writeAccess: values.writeAccess,
					deleteAccess: values.deleteAccess,
				})
				.where(eq(builderAppEntityPolicies.dbId, existing.dbId));
		} else {
			await db.insert(builderAppEntityPolicies).values(values);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Security Policies API] PUT error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
