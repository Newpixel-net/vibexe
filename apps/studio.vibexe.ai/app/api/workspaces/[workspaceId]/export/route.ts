import type { NextRequest } from "next/server";
import type { WorkspaceId } from "@vibexe-ai/protocol";
import { vibexe } from "@/app/vibexe";
import { db, agents } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/[workspaceId]/export
 *
 * Exports the full workspace definition as a JSON file download.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId } = await params;

	try {
		const workspace = await vibexe.getWorkspace(workspaceId as WorkspaceId);

		if (!workspace) {
			return Response.json(
				{ error: "Workspace not found" },
				{ status: 404 },
			);
		}

		// Get agent metadata for the export
		const [agent] = await db
			.select({ name: agents.name, tags: agents.tags })
			.from(agents)
			.where(eq(agents.workspaceId, workspaceId as WorkspaceId))
			.limit(1);

		const exportData = {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			metadata: {
				name: agent?.name ?? "Untitled Workflow",
				tags: agent?.tags ?? [],
			},
			workspace,
		};

		const fileName = `${(agent?.name ?? "workflow").replace(/[^a-zA-Z0-9-_]/g, "_")}.json`;

		return new Response(JSON.stringify(exportData, null, 2), {
			headers: {
				"Content-Type": "application/json",
				"Content-Disposition": `attachment; filename="${fileName}"`,
			},
		});
	} catch (err) {
		console.error("[Export] Error exporting workspace:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
