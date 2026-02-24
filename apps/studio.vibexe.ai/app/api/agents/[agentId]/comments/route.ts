import type { NextRequest } from "next/server";
import type { WorkspaceId } from "@vibexe-ai/protocol";
import { db, agents, nodeComments, users } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";
import { getCurrentUser } from "@/lib/get-current-user";
import type { AgentId } from "@/services/agents/types";

export const dynamic = "force-dynamic";

/**
 * Resolve agent dbId from either agentId param or workspaceId query param.
 * The agentId param can be "by-workspace" when using workspaceId query.
 */
async function resolveAgentDbId(
	agentIdParam: string,
	searchParams: URLSearchParams,
	teamDbId: number,
): Promise<number | null> {
	if (agentIdParam === "by-workspace") {
		const workspaceId = searchParams.get("workspaceId");
		if (!workspaceId) return null;
		const [agent] = await db
			.select({ dbId: agents.dbId })
			.from(agents)
			.where(
				and(
					eq(agents.workspaceId, workspaceId as WorkspaceId),
					eq(agents.teamDbId, teamDbId),
				),
			)
			.limit(1);
		return agent?.dbId ?? null;
	}
	const [agent] = await db
		.select({ dbId: agents.dbId })
		.from(agents)
		.where(
			and(
				eq(agents.id, agentIdParam as AgentId),
				eq(agents.teamDbId, teamDbId),
			),
		)
		.limit(1);
	return agent?.dbId ?? null;
}

/**
 * GET /api/agents/[agentId]/comments
 * Also: GET /api/agents/by-workspace/comments?workspaceId=xxx
 *
 * List all comments for an agent, grouped by nodeId.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: string }> },
) {
	const { agentId } = await params;

	try {
		const currentTeam = await fetchCurrentTeam();
		const agentDbId = await resolveAgentDbId(
			agentId,
			request.nextUrl.searchParams,
			currentTeam.dbId,
		);

		if (!agentDbId) {
			return Response.json({ error: "Agent not found" }, { status: 404 });
		}

		const comments = await db
			.select({
				dbId: nodeComments.dbId,
				nodeId: nodeComments.nodeId,
				content: nodeComments.content,
				resolved: nodeComments.resolved,
				createdAt: nodeComments.createdAt,
				updatedAt: nodeComments.updatedAt,
				authorName: users.displayName,
				authorAvatar: users.avatarUrl,
			})
			.from(nodeComments)
			.leftJoin(users, eq(nodeComments.userDbId, users.dbId))
			.where(eq(nodeComments.agentDbId, agentDbId))
			.orderBy(desc(nodeComments.createdAt));

		// Group by nodeId
		const grouped: Record<string, typeof comments> = {};
		for (const comment of comments) {
			if (!grouped[comment.nodeId]) grouped[comment.nodeId] = [];
			grouped[comment.nodeId].push(comment);
		}

		return Response.json({ comments: grouped });
	} catch (err) {
		console.error("[Comments] Error listing comments:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/agents/[agentId]/comments
 * Also: POST /api/agents/by-workspace/comments?workspaceId=xxx
 * Body: { nodeId: string, content: string }
 *
 * Add a comment to a node.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: string }> },
) {
	const { agentId } = await params;

	try {
		const currentTeam = await fetchCurrentTeam();
		const user = await getCurrentUser();
		const body = await request.json();

		const nodeId = typeof body.nodeId === "string" ? body.nodeId : null;
		const content = typeof body.content === "string" ? body.content.trim() : "";

		if (!nodeId || !content) {
			return Response.json(
				{ error: "nodeId and content are required" },
				{ status: 400 },
			);
		}

		const agentDbId = await resolveAgentDbId(
			agentId,
			request.nextUrl.searchParams,
			currentTeam.dbId,
		);

		if (!agentDbId) {
			return Response.json({ error: "Agent not found" }, { status: 404 });
		}

		const [created] = await db
			.insert(nodeComments)
			.values({
				agentDbId,
				nodeId,
				userDbId: user?.dbId ?? null,
				content,
			})
			.returning({
				dbId: nodeComments.dbId,
				nodeId: nodeComments.nodeId,
				content: nodeComments.content,
				resolved: nodeComments.resolved,
				createdAt: nodeComments.createdAt,
			});

		return Response.json({ comment: created }, { status: 201 });
	} catch (err) {
		console.error("[Comments] Error adding comment:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
