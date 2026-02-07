import { createId } from "@paralleldrive/cuid2";
import { NextResponse } from "next/server";
import { agents, db, workspaces } from "@/db";
import { fetchCurrentUser } from "@/services/accounts";
import { fetchCurrentTeam } from "@/services/teams";
import { giselle } from "../../../giselle";

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as { n8nWorkflow?: unknown };

		if (!body.n8nWorkflow) {
			return NextResponse.json(
				{ error: "Missing n8nWorkflow in request body" },
				{ status: 400 },
			);
		}

		const user = await fetchCurrentUser();
		const team = await fetchCurrentTeam();

		// Create a fresh workspace
		const workspace = await giselle.createWorkspace();

		// Convert N8N workflow to Giselle nodes
		// Dynamic import to avoid bundling the adapter in all routes
		const { convertN8NToGiselle } = await import(
			"@giselles-ai/activepieces-adapter"
		);
		const converted = convertN8NToGiselle(body.n8nWorkflow);

		// Merge converted nodes and connections into the workspace
		const savedWorkspace = await giselle.getWorkspace({
			workspaceId: workspace.id,
		});

		// Add converted nodes
		for (const node of converted.nodes) {
			savedWorkspace.nodes.push(node);
		}

		// Add converted connections
		for (const connection of converted.connections) {
			savedWorkspace.connections.push(connection);
		}

		// Add UI state for node positions
		if (converted.ui?.nodeState) {
			for (const [nodeId, state] of Object.entries(converted.ui.nodeState)) {
				savedWorkspace.ui.nodeState[nodeId] = state;
			}
		}

		await giselle.saveWorkspace({ workspace: savedWorkspace });

		// Insert workspace records
		const agentId = `agnt_${createId()}` as const;
		await db.insert(agents).values({
			id: agentId,
			teamDbId: team.dbId,
			creatorDbId: user.dbId,
			workspaceId: workspace.id,
		});
		await db.insert(workspaces).values({
			id: workspace.id,
			creatorDbId: user.dbId,
			teamDbId: team.dbId,
		});

		const redirectPath = `/workflows/${workspace.id}`;
		return NextResponse.json(
			{
				redirectPath,
				nodeCount: converted.nodes.length,
				connectionCount: converted.connections.length,
				warnings: converted.warnings ?? [],
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("N8N import error:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to import workflow",
			},
			{ status: 500 },
		);
	}
}
