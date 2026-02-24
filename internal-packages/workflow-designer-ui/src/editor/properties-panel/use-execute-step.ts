"use client";

import {
	Node,
	type ConnectionId,
	type NodeId,
	type OperationNode,
	isFlowControlNode,
} from "@vibexe-ai/protocol";
import { useNodeGenerations, useTaskSystem } from "@vibexe-ai/react";
import { useToasts } from "@vibexe-internal/ui/toast";
import { useCallback } from "react";
import {
	useAppDesignerStore,
	useWorkspaceActions,
} from "../../app-designer";

/**
 * Compute all predecessor connection IDs for a target node.
 * BFS backwards through connections to find all ancestors.
 */
function computePredecessorConnections(
	targetNodeId: string,
	connections: Array<{ id: string; inputNode: { id: string }; outputNode: { id: string } }>,
): string[] {
	const visited = new Set<string>();
	const queue: string[] = [targetNodeId];
	visited.add(targetNodeId);

	while (queue.length > 0) {
		const currentId = queue.shift()!;
		for (const conn of connections) {
			if (conn.inputNode.id === currentId && !visited.has(conn.outputNode.id)) {
				visited.add(conn.outputNode.id);
				queue.push(conn.outputNode.id);
			}
		}
	}

	return connections
		.filter((c) => visited.has(c.inputNode.id) && visited.has(c.outputNode.id))
		.map((c) => c.id);
}

/**
 * Hook that provides a reusable "execute step" callback for any operation node.
 * Used by OutputPanel's "Execute Step" button in the three-panel layout.
 *
 * For flow-control nodes (Code, If, Filter, etc.), routes to the DAG execution
 * path via createAndStartTask instead of the legacy createAndStartGenerationRunner.
 */
export function useExecuteStep(node: OperationNode | undefined) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const connections = useAppDesignerStore((s) => s.connections);
	const nodes = useAppDesignerStore((s) => s.nodes);
	const setUiNodeState = useWorkspaceActions((a) => a.setUiNodeState);
	const { createAndStartTask } = useTaskSystem(workspaceId);
	const { toast } = useToasts();

	const isFlowControl = node ? isFlowControlNode(node) : false;

	const {
		createAndStartGenerationRunner,
		isGenerating,
		stopGenerationRunner,
	} = useNodeGenerations({
		nodeId: (node?.id ?? "noop") as NodeId,
		origin: { type: "studio", workspaceId },
	});

	const executeStep = useCallback(() => {
		if (!node) return;

		if (isGenerating) {
			stopGenerationRunner();
			return;
		}

		setUiNodeState(node.id, { showError: false });

		if (isFlowControl) {
			// Flow-control nodes use DAG execution path via task system
			const predecessorConnectionIds = computePredecessorConnections(
				node.id,
				connections,
			);

			// Clear error states on all involved nodes
			const involvedNodeIds = new Set<string>();
			involvedNodeIds.add(node.id);
			for (const conn of connections) {
				if (predecessorConnectionIds.includes(conn.id)) {
					involvedNodeIds.add(conn.inputNode.id);
					involvedNodeIds.add(conn.outputNode.id);
				}
			}
			for (const nodeId of involvedNodeIds) {
				setUiNodeState(nodeId as NodeId, { showError: false });
			}

			const nodeId = predecessorConnectionIds.length === 0
				? (node.id as NodeId)
				: undefined;

			createAndStartTask({
				connectionIds: predecessorConnectionIds as ConnectionId[],
				nodeId,
				inputs: [],
				onTaskStart({ cancel, taskId }) {
					toast("Execute Step started", {
						id: taskId,
						preserve: true,
						action: {
							label: "Cancel",
							onClick: async () => {
								await cancel();
							},
						},
					});
				},
				onTaskComplete: ({ taskId }) => {
					toast.dismiss(taskId);
				},
			});
		} else {
			// Legacy path for AI/integration nodes
			const incomingConnections = connections.filter(
				(c) => c.inputNode.id === node.id,
			);
			const sourceNodes = incomingConnections
				.map((c) => nodes.find((n) => n.id === c.outputNode.id))
				.filter((n): n is Node => Node.safeParse(n).success);

			createAndStartGenerationRunner({
				origin: { type: "studio", workspaceId },
				operationNode: node,
				sourceNodes,
				connections: incomingConnections,
			});
		}
	}, [
		node,
		isFlowControl,
		isGenerating,
		stopGenerationRunner,
		setUiNodeState,
		connections,
		nodes,
		createAndStartGenerationRunner,
		createAndStartTask,
		toast,
		workspaceId,
	]);

	return { executeStep: node ? executeStep : undefined, isGenerating, stopGenerationRunner };
}
