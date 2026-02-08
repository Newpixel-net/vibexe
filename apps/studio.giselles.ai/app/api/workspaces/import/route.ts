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
			"@giselles-ai/activepieces-adapter/server"
		);
		const converted = convertN8NToGiselle(
			body.n8nWorkflow as Parameters<typeof convertN8NToGiselle>[0],
		);

		// Merge converted nodes and connections into the workspace
		// The converter generates IDs via protocol generators (nd-xxx, inp-xxx, etc.)
		// so the runtime data matches protocol schemas. We use any[] to bridge the
		// simplified converter types with the strict protocol Zod-inferred types.
		const savedWorkspace = await giselle.getWorkspace(workspace.id);

		// Add converted nodes
		// biome-ignore lint/suspicious/noExplicitAny: converter types are structurally compatible at runtime
		const nodes = savedWorkspace.nodes as any[];
		for (const node of converted.nodes) {
			nodes.push(node);
		}

		// Add converted connections
		// biome-ignore lint/suspicious/noExplicitAny: converter types are structurally compatible at runtime
		const connections = savedWorkspace.connections as any[];
		for (const connection of converted.connections) {
			connections.push(connection);
		}

		// Add UI state for node positions
		// biome-ignore lint/suspicious/noExplicitAny: bridging converter UI state to protocol NodeUIState
		const nodeState = savedWorkspace.ui.nodeState as any;
		if (converted.uiState?.nodePositions) {
			for (const [nodeId, pos] of Object.entries(
				converted.uiState.nodePositions,
			)) {
				nodeState[nodeId] = { position: pos };
			}
		}

		await giselle.updateWorkspace(savedWorkspace);

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
