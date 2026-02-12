import type { NextRequest } from "next/server";
import type { WorkspaceId } from "@giselles-ai/protocol";
import { giselle } from "@/app/giselle";
import { db, agents, workflowTemplates, users } from "@/db";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";
import { getCurrentUser } from "@/lib/get-current-user";

export const dynamic = "force-dynamic";

/**
 * GET /api/templates
 * Query: ?category=xxx&search=xxx
 *
 * List available workflow templates.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = request.nextUrl;
	const category = searchParams.get("category");
	const search = searchParams.get("search");

	try {
		let query = db
			.select({
				dbId: workflowTemplates.dbId,
				name: workflowTemplates.name,
				description: workflowTemplates.description,
				category: workflowTemplates.category,
				tags: workflowTemplates.tags,
				thumbnailUrl: workflowTemplates.thumbnailUrl,
				isPublic: workflowTemplates.isPublic,
				useCount: workflowTemplates.useCount,
				createdAt: workflowTemplates.createdAt,
				authorName: users.displayName,
				authorAvatar: users.avatarUrl,
			})
			.from(workflowTemplates)
			.leftJoin(users, eq(workflowTemplates.authorDbId, users.dbId))
			.where(eq(workflowTemplates.isPublic, true))
			.orderBy(desc(workflowTemplates.useCount))
			.$dynamic();

		if (category) {
			query = query.where(
				and(
					eq(workflowTemplates.isPublic, true),
					eq(workflowTemplates.category, category),
				),
			);
		}

		if (search) {
			query = query.where(
				and(
					eq(workflowTemplates.isPublic, true),
					ilike(workflowTemplates.name, `%${search}%`),
				),
			);
		}

		const templates = await query;
		return Response.json({ templates });
	} catch (err) {
		console.error("[Templates] Error listing templates:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/templates
 * Body: { workspaceId: string, name: string, description?: string, category: string, tags?: string[] }
 *
 * Publish current workflow as a template.
 */
export async function POST(request: NextRequest) {
	try {
		const currentTeam = await fetchCurrentTeam();
		const user = await getCurrentUser();
		const body = await request.json();

		const {
			workspaceId,
			name,
			description,
			category,
			tags,
		} = body;

		if (!workspaceId || !name || !category) {
			return Response.json(
				{ error: "workspaceId, name, and category are required" },
				{ status: 400 },
			);
		}

		// Get the workspace snapshot
		const workspace = await giselle.getWorkspace(workspaceId as WorkspaceId);
		if (!workspace) {
			return Response.json({ error: "Workspace not found" }, { status: 404 });
		}

		const [created] = await db
			.insert(workflowTemplates)
			.values({
				name,
				description: description || null,
				category,
				tags: Array.isArray(tags) ? tags : [],
				snapshot: workspace,
				authorDbId: user?.dbId ?? null,
				teamDbId: currentTeam.dbId,
			})
			.returning({
				dbId: workflowTemplates.dbId,
				name: workflowTemplates.name,
				category: workflowTemplates.category,
				createdAt: workflowTemplates.createdAt,
			});

		return Response.json({ template: created }, { status: 201 });
	} catch (err) {
		console.error("[Templates] Error creating template:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
