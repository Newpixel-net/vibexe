import type { NextRequest } from "next/server";
import type { WorkspaceId } from "@vibexe-ai/protocol";
import { vibexe } from "@/app/vibexe";
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
		const conditions: ReturnType<typeof eq>[] = [
			eq(workflowTemplates.isPublic, true),
		];

		if (category) {
			conditions.push(eq(workflowTemplates.category, category));
		}

		if (search) {
			conditions.push(ilike(workflowTemplates.name, `%${search}%`));
		}

		const templates = await db
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
			.where(and(...conditions))
			.orderBy(desc(workflowTemplates.useCount));
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
		const workspace = await vibexe.getWorkspace(workspaceId as WorkspaceId);
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
