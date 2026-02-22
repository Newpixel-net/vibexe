/**
 * Re-materialize Template API
 *
 * POST /api/app-templates/{templateId}/rematerialize
 *
 * Creates a new app from a template whose source app was deleted,
 * then updates the template to point to the new app.
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, teamMemberships } from "@/db";
import { getUser } from "@/lib/auth/get-user";
import {
	getTemplateById,
	rematerializeTemplate,
} from "@/app/(main)/app-builder/lib/template-queries";

interface RouteParams {
	params: Promise<{ templateId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
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

		const template = await getTemplateById(templateId);
		if (!template) {
			return NextResponse.json(
				{ error: "Template not found" },
				{ status: 404 },
			);
		}

		// Verify team ownership
		if (template.teamDbId !== membership.teamDbId) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const newApp = await rematerializeTemplate(
			template.dbId,
			membership.teamDbId,
			user.dbId,
		);

		return NextResponse.json(
			{
				appId: newApp.id,
				redirectPath: `/app-builder/${newApp.id}`,
			},
			{ status: 201 },
		);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Internal server error";
		console.error("[Template Rematerialize] POST error:", error);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
