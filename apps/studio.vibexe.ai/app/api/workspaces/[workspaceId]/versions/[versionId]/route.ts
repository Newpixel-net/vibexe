import type { NextRequest } from "next/server";
import type { WorkspaceId } from "@vibexe-ai/protocol";
import { vibexe } from "@/app/vibexe";
import { db, agents, workspaceVersions } from "@/db";
import { eq, and } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/[workspaceId]/versions/[versionId]
 *
 * Fetch a specific version snapshot.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string; versionId: string }> },
) {
	const { workspaceId, versionId } = await params;
	const versionDbId = Number.parseInt(versionId, 10);

	if (Number.isNaN(versionDbId)) {
		return Response.json({ error: "Invalid version ID" }, { status: 400 });
	}

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

		const [version] = await db
			.select()
			.from(workspaceVersions)
			.where(
				and(
					eq(workspaceVersions.dbId, versionDbId),
					eq(workspaceVersions.agentDbId, agent.dbId),
				),
			)
			.limit(1);

		if (!version) {
			return Response.json({ error: "Version not found" }, { status: 404 });
		}

		return Response.json({ version });
	} catch (err) {
		console.error("[Versions] Error fetching version:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/workspaces/[workspaceId]/versions/[versionId]
 *
 * Restore workspace to this version's snapshot.
 */
export async function POST(
	_request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string; versionId: string }> },
) {
	const { workspaceId, versionId } = await params;
	const versionDbId = Number.parseInt(versionId, 10);

	if (Number.isNaN(versionDbId)) {
		return Response.json({ error: "Invalid version ID" }, { status: 400 });
	}

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

		const [version] = await db
			.select({ snapshot: workspaceVersions.snapshot })
			.from(workspaceVersions)
			.where(
				and(
					eq(workspaceVersions.dbId, versionDbId),
					eq(workspaceVersions.agentDbId, agent.dbId),
				),
			)
			.limit(1);

		if (!version) {
			return Response.json({ error: "Version not found" }, { status: 404 });
		}

		// Restore workspace by updating it with the version snapshot
		const snapshot = version.snapshot as Record<string, unknown>;
		// Ensure the workspace ID is preserved
		snapshot.id = workspaceId;
		await vibexe.updateWorkspace(snapshot as unknown as import("@vibexe-ai/protocol").Workspace);

		return Response.json({ restored: true, versionId: versionDbId });
	} catch (err) {
		console.error("[Versions] Error restoring version:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
