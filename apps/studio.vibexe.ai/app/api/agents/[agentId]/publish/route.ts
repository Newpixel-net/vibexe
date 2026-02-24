import type { NextRequest } from "next/server";
import { db, agents } from "@/db";
import { eq, and } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";
import type { AgentId } from "@/services/agents/types";
import type { WorkspaceId } from "@vibexe-ai/protocol";

export const dynamic = "force-dynamic";

/**
 * Resolve the agent filter condition.
 * Supports both direct agentId and "by-workspace" with ?workspaceId= query param.
 */
function resolveAgentFilter(agentId: string, request: NextRequest, teamDbId: number) {
	if (agentId === "by-workspace") {
		const workspaceId = request.nextUrl.searchParams.get("workspaceId");
		if (!workspaceId) return null;
		return and(
			eq(agents.workspaceId, workspaceId as WorkspaceId),
			eq(agents.teamDbId, teamDbId),
		);
	}
	return and(
		eq(agents.id, agentId as AgentId),
		eq(agents.teamDbId, teamDbId),
	);
}

/**
 * PATCH /api/agents/[agentId]/publish
 * Body: { published: boolean }
 *
 * Toggles the published state of the agent.
 * Published workflows have their automated triggers (schedule, webhook, chat) active.
 *
 * Supports:
 * - /api/agents/<agentId>/publish
 * - /api/agents/by-workspace/publish?workspaceId=<workspaceId>
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

		const filter = resolveAgentFilter(agentId, request, currentTeam.dbId);
		if (!filter) {
			return Response.json({ error: "Missing workspaceId parameter" }, { status: 400 });
		}

		const [updated] = await db
			.update(agents)
			.set({
				isPublished,
				publishedAt: isPublished ? new Date() : null,
			})
			.where(filter)
			.returning({ id: agents.id, isPublished: agents.isPublished, publishedAt: agents.publishedAt });

		if (!updated) {
			return Response.json({ error: "Agent not found" }, { status: 404 });
		}

		return Response.json({ isPublished: updated.isPublished, publishedAt: updated.publishedAt });
	} catch (err) {
		console.error("[Publish] Error toggling publish:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * GET /api/agents/[agentId]/publish
 * Returns the current publish status.
 *
 * Supports:
 * - /api/agents/<agentId>/publish
 * - /api/agents/by-workspace/publish?workspaceId=<workspaceId>
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: string }> },
) {
	const { agentId } = await params;

	try {
		const currentTeam = await fetchCurrentTeam();

		const filter = resolveAgentFilter(agentId, request, currentTeam.dbId);
		if (!filter) {
			return Response.json({ error: "Missing workspaceId parameter" }, { status: 400 });
		}

		const [agent] = await db
			.select({ isPublished: agents.isPublished, publishedAt: agents.publishedAt })
			.from(agents)
			.where(filter)
			.limit(1);

		if (!agent) {
			return Response.json({ error: "Agent not found" }, { status: 404 });
		}

		return Response.json({ isPublished: agent.isPublished, publishedAt: agent.publishedAt });
	} catch (err) {
		console.error("[Publish] Error fetching publish status:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
