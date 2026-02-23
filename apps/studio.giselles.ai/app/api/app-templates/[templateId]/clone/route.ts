/**
 * Clone Template API
 *
 * POST /api/app-templates/{templateId}/clone
 * Body: { "name": "My Dashboard" }
 *
 * Creates a new app from a template snapshot:
 * 1. Creates app record + copies all files from snapshot
 * 2. Provisions per-app database if template has entities
 * 3. Applies schema from snapshot
 * 4. Increments template use count
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, teamMemberships } from "@/db";
import { getUser } from "@/lib/auth/get-user";
import {
	cloneTemplateToApp,
	getTemplateById,
} from "@/app/(main)/app-builder/lib/template-queries";
import { ensureAppDatabase } from "@/lib/app-database/manager";
import { applySchema } from "@/lib/app-database/schema-executor";
import type { AppSchema } from "@/lib/app-database/schema-types";

interface RouteParams {
	params: Promise<{ templateId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { templateId } = await params;

		const user = await getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const membership = await db.query.teamMemberships.findFirst({
			where: eq(teamMemberships.userDbId, user.dbId),
		});
		if (!membership) {
			return NextResponse.json({ error: "No team found" }, { status: 400 });
		}

		const body = await request.json();
		const appName = body.name?.trim();
		if (!appName) {
			return NextResponse.json(
				{ error: "App name is required" },
				{ status: 400 },
			);
		}

		// Resolve template
		const template = await getTemplateById(templateId);
		if (!template) {
			return NextResponse.json(
				{ error: "Template not found" },
				{ status: 404 },
			);
		}

		// Visibility check: team-only templates can only be cloned by team members
		if (
			template.visibility === "team" &&
			template.teamDbId !== membership.teamDbId
		) {
			return NextResponse.json(
				{ error: "This template is not available to your team" },
				{ status: 403 },
			);
		}

		// Clone: create app + copy files + apply config + increment use count
		const { app, schemaSnapshot } = await cloneTemplateToApp(
			template.dbId,
			membership.teamDbId,
			user.dbId,
			appName,
		);

		// Provision per-app database and apply schema if template had entities
		if (
			schemaSnapshot &&
			typeof schemaSnapshot === "object" &&
			"entities" in schemaSnapshot
		) {
			const schema = schemaSnapshot as AppSchema;
			if (schema.entities && schema.entities.length > 0) {
				try {
					const appDb = await ensureAppDatabase(app.dbId);
					await applySchema(appDb.databaseName, schema, appDb.dbId);
				} catch (dbError) {
					console.error(
						"[Template Clone] DB provisioning error (non-fatal):",
						dbError,
					);
				}
			}
		}

		const redirectPath = `/app-builder/${app.id}`;
		return NextResponse.json({ appId: app.id, redirectPath }, { status: 201 });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Internal server error";
		console.error("[Template Clone] POST error:", error);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
