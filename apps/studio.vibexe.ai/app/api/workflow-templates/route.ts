import type { NextRequest } from "next/server";
import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { getUser } from "@/lib/auth/get-user";
import { fetchCurrentTeam } from "@/services/teams/fetch-current-team";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/workflow-templates
 *
 * List workflow templates.
 * Returns public templates + templates belonging to the user's team.
 * Query params:
 *   - category: filter by category
 *   - search: fuzzy search on name, description, and tags
 *   - limit: max results (default 50)
 */
export async function GET(request: NextRequest) {
	try {
		await getUser();
		const currentTeam = await fetchCurrentTeam();

		const { searchParams } = new URL(request.url);
		const category = searchParams.get("category");
		const search = searchParams.get("search");
		const limit = Math.min(
			Math.max(Number.parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
			200,
		);

		// Build WHERE conditions
		const conditions: ReturnType<typeof eq>[] = [];

		// Visibility: public OR belongs to user's team
		conditions.push(
			or(
				eq(workflowTemplates.isPublic, true),
				eq(workflowTemplates.teamDbId, currentTeam.dbId),
			)!,
		);

		// Category filter
		if (category) {
			conditions.push(eq(workflowTemplates.category, category));
		}

		// Search filter: match name, description, or any tag
		if (search) {
			const searchPattern = `%${search}%`;
			conditions.push(
				or(
					ilike(workflowTemplates.name, searchPattern),
					ilike(workflowTemplates.description, searchPattern),
					sql`EXISTS (SELECT 1 FROM unnest(${workflowTemplates.tags}) AS t(tag) WHERE t.tag ILIKE ${searchPattern})`,
				)!,
			);
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
			})
			.from(workflowTemplates)
			.where(and(...conditions))
			.orderBy(desc(workflowTemplates.useCount))
			.limit(limit);

		return Response.json({ templates });
	} catch (err) {
		console.error("[WorkflowTemplates] Error listing:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/workflow-templates
 *
 * Save a workflow as a reusable template.
 * Body: { name, description, category, tags, snapshot, thumbnailUrl }
 */
export async function POST(request: NextRequest) {
	try {
		const user = await getUser();
		const currentTeam = await fetchCurrentTeam();
		const body = await request.json();

		const { name, description, category, tags, snapshot, thumbnailUrl } = body;

		if (!name || typeof name !== "string") {
			return Response.json(
				{ error: "name is required and must be a string" },
				{ status: 400 },
			);
		}

		if (!category || typeof category !== "string") {
			return Response.json(
				{ error: "category is required and must be a string" },
				{ status: 400 },
			);
		}

		if (!snapshot || typeof snapshot !== "object") {
			return Response.json(
				{ error: "snapshot is required and must be a JSON object" },
				{ status: 400 },
			);
		}

		const [created] = await db
			.insert(workflowTemplates)
			.values({
				name: name.trim(),
				description: description?.trim() || null,
				category: category.trim(),
				tags: Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === "string") : [],
				snapshot,
				thumbnailUrl: thumbnailUrl?.trim() || null,
				authorDbId: user.dbId,
				teamDbId: currentTeam.dbId,
				isPublic: body.isPublic !== false,
			})
			.returning({
				dbId: workflowTemplates.dbId,
				name: workflowTemplates.name,
				category: workflowTemplates.category,
				createdAt: workflowTemplates.createdAt,
			});

		return Response.json({ template: created }, { status: 201 });
	} catch (err) {
		console.error("[WorkflowTemplates] Error creating:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
