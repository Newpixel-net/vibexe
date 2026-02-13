import type { ConnectionId, NodeId } from "@giselles-ai/protocol";
import { useTaskSystem } from "@giselles-ai/react";
import { useToasts } from "@giselle-internal/ui/toast";
import { useCallback } from "react";
import { useAppDesignerStore, useWorkspaceActions } from "../../app-designer";

/**
 * Compute all predecessor connection IDs for a target node.
 * BFS backwards through connections to find all ancestors.
 * Also includes sub-node connections for any AI Agent nodes in the path.
 */
function computePredecessorConnections(
	targetNodeId: string,
	connections: { id: string; inputNode: { id: string }; outputNode: { id: string }; connectionType: string }[],
): string[] {
	const regularConnections = connections.filter(
		(c) => c.connectionType !== "subNode",
	);
	const subNodeConnections = connections.filter(
		(c) => c.connectionType === "subNode",
	);

	// BFS backwards from target through regular connections
	const visited = new Set<string>();
	const queue: string[] = [targetNodeId];
	visited.add(targetNodeId);

	while (queue.length > 0) {
		const currentId = queue.shift()!;
		for (const conn of regularConnections) {
			if (conn.inputNode.id === currentId && !visited.has(conn.outputNode.id)) {
				visited.add(conn.outputNode.id);
				queue.push(conn.outputNode.id);
			}
		}
	}

	// Collect regular connection IDs between visited nodes
	const resultIds = regularConnections
		.filter(
			(c) => visited.has(c.inputNode.id) && visited.has(c.outputNode.id),
		)
		.map((c) => c.id);

	// Include sub-node connections where the parent node is visited
	// (e.g. AI Agent's chatModel, tool, memory sub-nodes)
	for (const sc of subNodeConnections) {
		if (visited.has(sc.inputNode.id)) {
			resultIds.push(sc.id);
			visited.add(sc.outputNode.id);
		}
	}

	return resultIds;
}

/**
 * Hook that provides "Execute to Here" functionality.
 * Executes a target node and all its required predecessors.
 */
export function useExecuteToHere() {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const connections = useAppDesignerStore((s) => s.connections);
	const nodes = useAppDesignerStore((s) => s.nodes);
	const setUiNodeState = useWorkspaceActions((a) => a.setUiNodeState);
	const { createAndStartTask } = useTaskSystem(workspaceId);
	const { toast } = useToasts();

	const executeToHere = useCallback(
		async (targetNodeId: string) => {
			const predecessorConnectionIds = computePredecessorConnections(
				targetNodeId,
				connections,
			);

			// Clear error states on all involved nodes
			const involvedNodeIds = new Set<string>();
			involvedNodeIds.add(targetNodeId);
			for (const conn of connections) {
				if (predecessorConnectionIds.includes(conn.id)) {
					involvedNodeIds.add(conn.inputNode.id);
					involvedNodeIds.add(conn.outputNode.id);
				}
			}
			for (const nodeId of involvedNodeIds) {
				setUiNodeState(nodeId as NodeId, { showError: false });
			}

			// If no predecessor connections, execute as single node
			const nodeId =
				predecessorConnectionIds.length === 0
					? (targetNodeId as NodeId)
					: undefined;

			await createAndStartTask({
				connectionIds: predecessorConnectionIds as ConnectionId[],
				nodeId,
				inputs: [],
				onTaskStart({ cancel, taskId }) {
					toast("Execute to Here started", {
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
			});
		},
		[connections, setUiNodeState, createAndStartTask, toast],
	);

	return executeToHere;
}
