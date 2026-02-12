import type { NextRequest } from "next/server";
import { db, agents } from "@/db";
import { eq, and } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";
import type { AgentId } from "@/services/agents/types";

export const dynamic = "force-dynamic";

/**
 * PUT /api/agents/[agentId]/tags
 * Body: { tags: string[] }
 *
 * Updates the tags array for the given agent.
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: string }> },
) {
	const { agentId } = await params;

	try {
		const currentTeam = await fetchCurrentTeam();
		const body = await request.json();
		const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [];

		const [updated] = await db
			.update(agents)
			.set({ tags })
			.where(
				and(
					eq(agents.id, agentId as AgentId),
					eq(agents.teamDbId, currentTeam.dbId),
				),
			)
			.returning({ id: agents.id, tags: agents.tags });

		if (!updated) {
			return Response.json({ error: "Agent not found" }, { status: 404 });
		}

		return Response.json({ tags: updated.tags });
	} catch (err) {
		console.error("[Tags] Error updating tags:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/agents/[agentId]/tags/publish
 * Body: { published: boolean }
 *
 * Toggles the published state of the agent.
 * This is routed via tags/route.ts PATCH for simplicity.
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: string }> },
) {
	const { agentId } = await params;

	try {
		const currentTeam = await fetchCurrentTeam();
		const body = await request.json();
		const isPublished = body.published === true;

		const [updated] = await db
			.update(agents)
			.set({
				isPublished,
				publishedAt: isPublished ? new Date() : null,
			})
			.where(
				and(
					eq(agents.id, agentId as AgentId),
					eq(agents.teamDbId, currentTeam.dbId),
				),
			)
			.returning({ id: agents.id, isPublished: agents.isPublished });

		if (!updated) {
			return Response.json({ error: "Agent not found" }, { status: 404 });
		}

		return Response.json({ isPublished: updated.isPublished });
	} catch (err) {
		console.error("[Publish] Error toggling publish:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
