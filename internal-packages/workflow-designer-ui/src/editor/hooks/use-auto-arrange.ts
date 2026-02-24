import type { NodeId } from "@vibexe-ai/protocol";
import { useCallback } from "react";
import {
	useAppDesignerStore,
	useUndoRedoActions,
	useWorkspaceActions,
} from "../../app-designer";

const LAYER_SPACING_X = 200; // Horizontal gap between layers
const NODE_SPACING_Y = 140; // Vertical gap between nodes in same layer
const START_X = 100;
const START_Y = 100;

/**
 * Auto-arrange nodes in a clean left-to-right DAG layout.
 * Uses topological layering: root nodes at left, downstream nodes to the right.
 */
export function useAutoArrange() {
	const nodes = useAppDesignerStore((s) => s.nodes);
	const connections = useAppDesignerStore((s) => s.connections);
	const nodeState = useAppDesignerStore((s) => s.ui.nodeState);
	const { setUiNodeState } = useWorkspaceActions((a) => ({
		setUiNodeState: a.setUiNodeState,
	}));
	const { pushUndoSnapshot } = useUndoRedoActions((s) => ({
		pushUndoSnapshot: s.pushUndoSnapshot,
	}));

	const autoArrange = useCallback(() => {
		if (nodes.length === 0) return;

		pushUndoSnapshot();

		// Build adjacency: nodeId -> downstream nodeIds
		const downstream = new Map<string, string[]>();
		const upstream = new Map<string, string[]>();
		const subNodeParents = new Map<string, string>(); // subNodeId -> parentId

		for (const node of nodes) {
			downstream.set(node.id, []);
			upstream.set(node.id, []);
		}

		for (const conn of connections) {
			if (conn.connectionType === "subNode") {
				// Track sub-node relationships separately
				subNodeParents.set(conn.outputNode.id, conn.inputNode.id);
				continue;
			}
			const downList = downstream.get(conn.outputNode.id);
			if (downList) downList.push(conn.inputNode.id);
			const upList = upstream.get(conn.inputNode.id);
			if (upList) upList.push(conn.outputNode.id);
		}

		// Find root nodes (no upstream regular connections, not sub-nodes)
		const roots = nodes.filter(
			(n) =>
				(upstream.get(n.id)?.length ?? 0) === 0 &&
				!subNodeParents.has(n.id),
		);

		// Kahn's algorithm for layer assignment (handles cycles gracefully)
		const inDegree = new Map<string, number>();
		for (const node of nodes) {
			if (!subNodeParents.has(node.id)) {
				inDegree.set(node.id, 0);
			}
		}
		for (const conn of connections) {
			if (conn.connectionType === "subNode") continue;
			const targetId = conn.inputNode.id;
			if (inDegree.has(targetId)) {
				inDegree.set(targetId, (inDegree.get(targetId) ?? 0) + 1);
			}
		}

		const layers = new Map<string, number>();
		const queue: string[] = [];
		for (const [nodeId, deg] of inDegree) {
			if (deg === 0) {
				queue.push(nodeId);
				layers.set(nodeId, 0);
			}
		}

		let head = 0;
		while (head < queue.length) {
			const id = queue[head++];
			const layer = layers.get(id) ?? 0;
			for (const downId of downstream.get(id) ?? []) {
				if (!inDegree.has(downId)) continue;
				const newLayer = layer + 1;
				layers.set(downId, Math.max(layers.get(downId) ?? 0, newLayer));
				const newDeg = (inDegree.get(downId) ?? 1) - 1;
				inDegree.set(downId, newDeg);
				if (newDeg === 0) {
					queue.push(downId);
				}
			}
		}

		// Nodes in cycles won't be processed — assign layer 0
		for (const node of nodes) {
			if (!subNodeParents.has(node.id) && !layers.has(node.id)) {
				layers.set(node.id, 0);
			}
		}

		// Group nodes by layer
		const layerGroups = new Map<number, string[]>();
		for (const [nodeId, layer] of layers) {
			const group = layerGroups.get(layer) ?? [];
			group.push(nodeId);
			layerGroups.set(layer, group);
		}

		// Get estimated node width for each node
		const getNodeWidth = (nodeId: string): number => {
			const measured = (nodeState as Record<string, { measured?: { width?: number; height?: number } }>)[nodeId]?.measured;
			return measured?.width ?? 96;
		};

		// Build a map: for each node, track which parent output port it comes from
		// This lets us group fork branches visually (e.g., If true/false)
		const parentOutputPort = new Map<string, string>();
		for (const conn of connections) {
			if (conn.connectionType === "subNode") continue;
			const childId = conn.inputNode.id;
			if (!parentOutputPort.has(childId)) {
				parentOutputPort.set(childId, `${conn.outputNode.id}:${conn.outputId}`);
			}
		}

		// Position each layer with fork-aware vertical spreading
		const maxLayer = Math.max(...Array.from(layerGroups.keys()), 0);
		let currentX = START_X;

		for (let layer = 0; layer <= maxLayer; layer++) {
			const group = layerGroups.get(layer) ?? [];
			if (group.length === 0) continue;

			// Get the widest node in this layer
			let maxWidth = 0;
			for (const nodeId of group) {
				maxWidth = Math.max(maxWidth, getNodeWidth(nodeId));
			}

			// Group nodes by their parent output port for fork spreading
			// Keeps same-branch nodes together and separates different branches
			const branchGroups = new Map<string, string[]>();
			for (const nodeId of group) {
				const key = parentOutputPort.get(nodeId) ?? "root";
				if (!branchGroups.has(key)) branchGroups.set(key, []);
				branchGroups.get(key)!.push(nodeId);
			}

			const totalHeight = group.length * NODE_SPACING_Y;
			let currentY = START_Y + (group.length > 1 ? 0 : totalHeight / 2);

			for (const [, branchNodes] of branchGroups) {
				for (const nodeId of branchNodes) {
					setUiNodeState(nodeId, {
						position: { x: currentX, y: currentY },
					});
					currentY += NODE_SPACING_Y;
				}
			}

			currentX += maxWidth + LAYER_SPACING_X;
		}

		// Position sub-nodes below their parent
		const nodeStateAny = nodeState as Record<string, { position?: { x: number; y: number }; measured?: { width?: number; height?: number } }>;
		for (const [subNodeId, parentId] of subNodeParents) {
			const parentPos = nodeStateAny[parentId]?.position;
			if (!parentPos) continue;

			const parentMeasured = nodeStateAny[parentId]?.measured;
			const parentHeight = parentMeasured?.height ?? 96;

			// Count how many sub-nodes this parent has to spread them
			const siblingSubNodes = Array.from(subNodeParents.entries())
				.filter(([, pid]) => pid === parentId)
				.map(([sid]) => sid);
			const idx = siblingSubNodes.indexOf(subNodeId);

			setUiNodeState(subNodeId, {
				position: {
					x: parentPos.x + idx * 120,
					y: parentPos.y + parentHeight + 60,
				},
			});
		}
	}, [nodes, connections, nodeState, setUiNodeState, pushUndoSnapshot]);

	return autoArrange;
}
