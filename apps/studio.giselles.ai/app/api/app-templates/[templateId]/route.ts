/**
 * Template Detail API
 *
 * GET    /api/app-templates/{templateId}  — Get template detail
 * PUT    /api/app-templates/{templateId}  — Update metadata (featured, status, etc.)
 * DELETE /api/app-templates/{templateId}  — Delete template
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, teamMemberships } from "@/db";
import { getUser } from "@/lib/auth/get-user";
import {
	deleteTemplate,
	getTemplateById,
	getTemplateWithAuthor,
	updateTemplate,
} from "@/app/(main)/app-builder/lib/template-queries";

interface RouteParams {
	params: Promise<{ templateId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { templateId } = await params;
		const template = await getTemplateWithAuthor(templateId);

		if (!template) {
			return NextResponse.json(
				{ error: "Template not found" },
				{ status: 404 },
			);
		}

		// Extract file paths and entity names without sending full content
		const filesSnapshot = template.filesSnapshot as Array<{
			path: string;
			content: string;
			language: string;
		}>;
		const filePaths = filesSnapshot.map((f) => f.path);

		const schemaSnapshot = template.schemaSnapshot as {
			entities?: Array<{ name: string; tableName: string }>;
		} | null;
		const entityNames = schemaSnapshot?.entities?.map((e) => e.name) ?? [];

		return NextResponse.json({
			id: template.id,
			name: template.name,
			description: template.description,
			category: template.category,
			tags: template.tags,
			visibility: template.visibility,
			featured: template.featured,
			status: template.status,
			useCount: template.useCount,
			fileCount: template.fileCount,
			entityCount: template.entityCount,
			authorName: template.authorName,
			createdAt: template.createdAt,
			filePaths,
			entityNames,
		});
	} catch (error) {
		console.error("[Template Detail] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function PUT(request: Request, { params }: RouteParams) {
	try {
		const { templateId } = await params;

		const user = await getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const template = await getTemplateById(templateId);
		if (!template) {
			return NextResponse.json(
				{ error: "Template not found" },
				{ status: 404 },
			);
		}

		// Verify team ownership
		const membership = await db.query.teamMemberships.findFirst({
			where: eq(teamMemberships.userDbId, user.dbId),
		});
		if (!membership || membership.teamDbId !== template.teamDbId) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const body = await request.json();
		const updated = await updateTemplate(templateId, {
			name: body.name,
			description: body.description,
			category: body.category,
			tags: body.tags,
			visibility: body.visibility,
			featured: body.featured,
			status: body.status,
			thumbnailUrl: body.thumbnailUrl,
		});

		return NextResponse.json({ success: true, template: updated });
	} catch (error) {
		console.error("[Template Detail] PUT error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function DELETE(_request: Request, { params }: RouteParams) {
	try {
		const { templateId } = await params;

		const user = await getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const template = await getTemplateById(templateId);
		if (!template) {
			return NextResponse.json(
				{ error: "Template not found" },
				{ status: 404 },
			);
		}

		// Verify team ownership
		const membership = await db.query.teamMemberships.findFirst({
			where: eq(teamMemberships.userDbId, user.dbId),
		});
		if (!membership || membership.teamDbId !== template.teamDbId) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		await deleteTemplate(templateId);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Template Detail] DELETE error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
