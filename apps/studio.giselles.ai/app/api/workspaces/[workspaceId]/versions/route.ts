import type { NextRequest } from "next/server";
import type { WorkspaceId } from "@giselles-ai/protocol";
import { giselle } from "@/app/giselle";
import { db, agents, workspaceVersions, users } from "@/db";
import { eq, and, desc, max } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";
import { getCurrentUser } from "@/lib/get-current-user";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/[workspaceId]/versions
 *
 * List all saved versions for this workspace.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId } = await params;

	try {
		const currentTeam = await fetchCurrentTeam();

		// Find the agent for this workspace
		const [agent] = await db
			.select({ dbId: agents.dbId })
			.from(agents)
			.where(
				and(
					eq(agents.workspaceId, workspaceId as WorkspaceId),
					eq(agents.teamDbId, currentTeam.dbId),
				),
			)
			.limit(1);

		if (!agent) {
			return Response.json({ error: "Workspace not found" }, { status: 404 });
		}

		const versions = await db
			.select({
				dbId: workspaceVersions.dbId,
				versionNumber: workspaceVersions.versionNumber,
				label: workspaceVersions.label,
				createdAt: workspaceVersions.createdAt,
				createdByName: users.displayName,
				createdByAvatar: users.avatarUrl,
			})
			.from(workspaceVersions)
			.leftJoin(users, eq(workspaceVersions.createdByDbId, users.dbId))
			.where(eq(workspaceVersions.agentDbId, agent.dbId))
			.orderBy(desc(workspaceVersions.versionNumber));

		return Response.json({ versions });
	} catch (err) {
		console.error("[Versions] Error listing versions:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/workspaces/[workspaceId]/versions
 * Body: { label?: string }
 *
 * Create a new version snapshot of the current workspace.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId } = await params;

	try {
		const currentTeam = await fetchCurrentTeam();
		const user = await getCurrentUser();
		const body = await request.json().catch(() => ({}));
		const label = typeof body.label === "string" ? body.label : null;

		// Find the agent for this workspace
		const [agent] = await db
			.select({ dbId: agents.dbId, name: agents.name })
			.from(agents)
			.where(
				and(
					eq(agents.workspaceId, workspaceId as WorkspaceId),
					eq(agents.teamDbId, currentTeam.dbId),
				),
			)
			.limit(1);

		if (!agent) {
			return Response.json({ error: "Workspace not found" }, { status: 404 });
		}

		// Get current workspace state as snapshot
		const workspace = await giselle.getWorkspace(workspaceId as WorkspaceId);
		if (!workspace) {
			return Response.json({ error: "Workspace data not found" }, { status: 404 });
		}

		// Get next version number
		const [maxVersion] = await db
			.select({ maxNum: max(workspaceVersions.versionNumber) })
			.from(workspaceVersions)
			.where(eq(workspaceVersions.agentDbId, agent.dbId));

		const nextVersionNumber = (maxVersion?.maxNum ?? 0) + 1;

		const [created] = await db
			.insert(workspaceVersions)
			.values({
				agentDbId: agent.dbId,
				versionNumber: nextVersionNumber,
				label: label || `Version ${nextVersionNumber}`,
				snapshot: workspace,
				createdByDbId: user?.dbId ?? null,
			})
			.returning({
				dbId: workspaceVersions.dbId,
				versionNumber: workspaceVersions.versionNumber,
				label: workspaceVersions.label,
				createdAt: workspaceVersions.createdAt,
			});

		return Response.json({ version: created }, { status: 201 });
	} catch (err) {
		console.error("[Versions] Error creating version:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
