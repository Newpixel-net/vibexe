import { createId } from "@paralleldrive/cuid2";
import { NextResponse } from "next/server";
import { agents, db, workspaces } from "@/db";
import { fetchCurrentUser } from "@/services/accounts";
import { fetchCurrentTeam } from "@/services/teams";
import { giselle } from "../../../giselle";

export async function POST(request: Request) {
	let workspaceId: string | undefined;
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
		workspaceId = workspace.id;

		// Convert N8N workflow to Giselle nodes
		// Dynamic import to avoid bundling the adapter in all routes
		const { convertN8NToGiselle } = await import(
			"@giselles-ai/activepieces-adapter/server"
		);
		const converted = convertN8NToGiselle(
			body.n8nWorkflow as Parameters<typeof convertN8NToGiselle>[0],
		);

		// Diagnostic logging
		const nodeTypes = converted.nodes.map(
			(n: { content: { type: string } }) => n.content.type,
		);
		const nodeTypeCounts: Record<string, number> = {};
		for (const t of nodeTypes) {
			nodeTypeCounts[t] = (nodeTypeCounts[t] ?? 0) + 1;
		}
		console.log(
			`[N8N Import] Converting "${converted.name}": ${converted.nodes.length} nodes, ${converted.connections.length} connections, hasFlowControl=${converted.hasFlowControl}`,
		);
		console.log("[N8N Import] Node types:", JSON.stringify(nodeTypeCounts));
		if (converted.warnings.length > 0) {
			console.log(
				`[N8N Import] ${converted.warnings.length} warnings:`,
				converted.warnings.map(
					(w: { nodeName: string; message: string }) => `${w.nodeName}: ${w.message}`,
				),
			);
		}

		// Merge converted nodes and connections into the workspace
		const savedWorkspace = await giselle.getWorkspace(workspace.id);

		// Apply workflow name
		if (converted.name) {
			// biome-ignore lint/suspicious/noExplicitAny: workspace schema supports optional name field
			(savedWorkspace as any).name = converted.name;
		}

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

		// Insert workspace records with workflow name
		const workflowName = converted.name || "Imported Workflow";
		const agentId = `agnt_${createId()}` as const;
		await db.insert(agents).values({
			id: agentId,
			teamDbId: team.dbId,
			creatorDbId: user.dbId,
			workspaceId: workspace.id,
			name: workflowName,
		});
		await db.insert(workspaces).values({
			id: workspace.id,
			creatorDbId: user.dbId,
			teamDbId: team.dbId,
			name: workflowName,
		});

		const redirectPath = `/workflows/${workspace.id}`;
		console.log(
			`[N8N Import] Success: workspace=${workspace.id}, redirect=${redirectPath}`,
		);
		return NextResponse.json(
			{
				redirectPath,
				nodeCount: converted.nodes.length,
				connectionCount: converted.connections.length,
				warnings: converted.warnings ?? [],
				hasFlowControl: converted.hasFlowControl ?? false,
				nodeTypeCounts,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error(
			`[N8N Import] Error${workspaceId ? ` (workspace=${workspaceId})` : ""}:`,
			error,
		);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to import workflow",
				...(workspaceId ? { workspaceId } : {}),
			},
			{ status: 500 },
		);
	}
}
