/**
 * Template Detail API
 *
 * GET /api/app-templates/{templateId}
 * Returns metadata + file paths + entity names (no file content)
 */

import { NextResponse } from "next/server";
import { getTemplateWithAuthor } from "@/app/(main)/app-builder/lib/template-queries";

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
