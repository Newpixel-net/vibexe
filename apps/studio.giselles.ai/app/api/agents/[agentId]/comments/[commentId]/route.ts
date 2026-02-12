import type { NextRequest } from "next/server";
import type { WorkspaceId } from "@giselles-ai/protocol";
import { db, agents, nodeComments } from "@/db";
import { eq, and } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";
import type { AgentId } from "@/services/agents/types";

export const dynamic = "force-dynamic";

/**
 * Resolve agent dbId from either agentId param or workspaceId query param.
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
 * PUT /api/agents/[agentId]/comments/[commentId]
 * Body: { content?: string, resolved?: boolean }
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: string; commentId: string }> },
) {
	const { agentId, commentId } = await params;
	const commentDbId = Number.parseInt(commentId, 10);

	if (Number.isNaN(commentDbId)) {
		return Response.json({ error: "Invalid comment ID" }, { status: 400 });
	}

	try {
		const currentTeam = await fetchCurrentTeam();
		const body = await request.json();

		const agentDbId = await resolveAgentDbId(
			agentId,
			request.nextUrl.searchParams,
			currentTeam.dbId,
		);

		if (!agentDbId) {
			return Response.json({ error: "Agent not found" }, { status: 404 });
		}

		const updates: Record<string, unknown> = {
			updatedAt: new Date(),
		};
		if (typeof body.content === "string") {
			updates.content = body.content.trim();
		}
		if (typeof body.resolved === "boolean") {
			updates.resolved = body.resolved;
		}

		const [updated] = await db
			.update(nodeComments)
			.set(updates)
			.where(
				and(
					eq(nodeComments.dbId, commentDbId),
					eq(nodeComments.agentDbId, agentDbId),
				),
			)
			.returning({
				dbId: nodeComments.dbId,
				content: nodeComments.content,
				resolved: nodeComments.resolved,
				updatedAt: nodeComments.updatedAt,
			});

		if (!updated) {
			return Response.json({ error: "Comment not found" }, { status: 404 });
		}

		return Response.json({ comment: updated });
	} catch (err) {
		console.error("[Comments] Error updating comment:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * DELETE /api/agents/[agentId]/comments/[commentId]
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: string; commentId: string }> },
) {
	const { agentId, commentId } = await params;
	const commentDbId = Number.parseInt(commentId, 10);

	if (Number.isNaN(commentDbId)) {
		return Response.json({ error: "Invalid comment ID" }, { status: 400 });
	}

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

		const [deleted] = await db
			.delete(nodeComments)
			.where(
				and(
					eq(nodeComments.dbId, commentDbId),
					eq(nodeComments.agentDbId, agentDbId),
				),
			)
			.returning({ dbId: nodeComments.dbId });

		if (!deleted) {
			return Response.json({ error: "Comment not found" }, { status: 404 });
		}

		return Response.json({ deleted: true });
	} catch (err) {
		console.error("[Comments] Error deleting comment:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
