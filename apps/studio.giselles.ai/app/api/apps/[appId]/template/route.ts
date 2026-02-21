/**
 * App Template API
 *
 * GET    /api/apps/{appId}/template  — Get template published from this app
 * POST   /api/apps/{appId}/template  — Publish new template
 * PUT    /api/apps/{appId}/template  — Update metadata or refresh snapshot
 * DELETE /api/apps/{appId}/template  — Unpublish template
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps } from "@/db/schema";
import { getUser } from "@/lib/auth/get-user";
import {
	deleteTemplate,
	getTemplateBySourceApp,
	publishTemplate,
	refreshTemplateSnapshot,
	updateTemplate,
} from "@/app/(main)/app-builder/lib/template-queries";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

async function resolveApp(appId: string) {
	return db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true, teamDbId: true },
	});
}

export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const app = await resolveApp(appId);
		if (!app)
			return NextResponse.json({ error: "App not found" }, { status: 404 });

		const template = await getTemplateBySourceApp(app.dbId);
		if (!template) return NextResponse.json({ published: false });

		return NextResponse.json({ published: true, template });
	} catch (error) {
		console.error("[Template API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const user = await getUser();
		const app = await resolveApp(appId);
		if (!app)
			return NextResponse.json({ error: "App not found" }, { status: 404 });

		const body = await request.json();
		const template = await publishTemplate(
			appId,
			app.teamDbId,
			user.dbId,
			{
				name: body.name,
				description: body.description,
				category: body.category,
				tags: body.tags,
				visibility: body.visibility,
			},
		);

		return NextResponse.json({ success: true, template });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Internal server error";
		console.error("[Template API] POST error:", error);
		return NextResponse.json(
			{ error: message },
			{ status: message.includes("already published") ? 409 : 500 },
		);
	}
}

export async function PUT(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const app = await resolveApp(appId);
		if (!app)
			return NextResponse.json({ error: "App not found" }, { status: 404 });

		const existing = await getTemplateBySourceApp(app.dbId);
		if (!existing)
			return NextResponse.json(
				{ error: "No template found for this app" },
				{ status: 404 },
			);

		const body = await request.json();

		// Refresh snapshot if requested
		if (body.refresh) {
			const updated = await refreshTemplateSnapshot(existing.id, appId);
			return NextResponse.json({ success: true, template: updated });
		}

		// Update metadata
		const updated = await updateTemplate(existing.id, {
			name: body.name,
			description: body.description,
			category: body.category,
			tags: body.tags,
			visibility: body.visibility,
		});

		return NextResponse.json({ success: true, template: updated });
	} catch (error) {
		console.error("[Template API] PUT error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function DELETE(_request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const app = await resolveApp(appId);
		if (!app)
			return NextResponse.json({ error: "App not found" }, { status: 404 });

		const existing = await getTemplateBySourceApp(app.dbId);
		if (!existing)
			return NextResponse.json(
				{ error: "No template found for this app" },
				{ status: 404 },
			);

		await deleteTemplate(existing.id);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Template API] DELETE error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
