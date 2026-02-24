import type { NodeId, NodeLike } from "@vibexe-ai/protocol";
import { useCallback } from "react";
import {
	useAddNode,
	useAppDesignerStore,
	useConnectNodes,
	useDisconnectNodes,
	useWorkspaceActions,
} from "../../app-designer";

/**
 * Inserts a new node between an existing connection's source and target.
 * - Removes the original edge
 * - Creates source → newNode and newNode → target edges
 * - Positions newNode at the midpoint of the original connection
 */
export function useInsertOnEdge() {
	const connections = useAppDesignerStore((s) => s.connections);
	const nodeState = useAppDesignerStore((s) => s.ui.nodeState);
	const addNode = useAddNode();
	const connectNodes = useConnectNodes();
	const disconnectNodes = useDisconnectNodes();
	const { setUiNodeState } = useWorkspaceActions((a) => ({
		setUiNodeState: a.setUiNodeState,
	}));

	const insertOnEdge = useCallback(
		(connectionId: string, newNode: NodeLike) => {
			const conn = connections.find((c) => c.id === connectionId);
			if (!conn) return;

			const sourceId = conn.outputNode.id;
			const targetId = conn.inputNode.id;

			// Calculate midpoint position between source and target
			const sourcePos = nodeState[sourceId]?.position ?? { x: 0, y: 0 };
			const targetPos = nodeState[targetId]?.position ?? { x: 0, y: 0 };
			const sourceMeasured = nodeState[sourceId]?.measured;
			const sourceWidth = sourceMeasured?.width ?? 96;

			const midX = sourcePos.x + (targetPos.x - sourcePos.x) / 2;
			const midY = sourcePos.y + (targetPos.y - sourcePos.y) / 2;

			// Add the new node at the midpoint
			addNode(newNode, {
				position: { x: midX, y: midY },
			});

			// Remove the original connection
			disconnectNodes(sourceId, targetId);

			// Create source → newNode → target connections
			connectNodes(sourceId, newNode.id);
			connectNodes(newNode.id, targetId);

			// Select the new node
			setUiNodeState(newNode.id, { selected: true });
		},
		[connections, nodeState, addNode, connectNodes, disconnectNodes, setUiNodeState],
	);

	return insertOnEdge;
}
