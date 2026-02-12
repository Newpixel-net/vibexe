"use client";

import { Node, type NodeId, type OperationNode } from "@giselles-ai/protocol";
import { useNodeGenerations } from "@giselles-ai/react";
import { useCallback } from "react";
import {
	useAppDesignerStore,
	useWorkspaceActions,
} from "../../app-designer";

/**
 * Hook that provides a reusable "execute step" callback for any operation node.
 * Used by OutputPanel's "Execute Step" button in the three-panel layout.
 */
export function useExecuteStep(node: OperationNode | undefined) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const connections = useAppDesignerStore((s) => s.connections);
	const nodes = useAppDesignerStore((s) => s.nodes);
	const setUiNodeState = useWorkspaceActions((a) => a.setUiNodeState);

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
	}, [
		node,
		isGenerating,
		stopGenerationRunner,
		setUiNodeState,
		connections,
		nodes,
		createAndStartGenerationRunner,
		workspaceId,
	]);

	return { executeStep: node ? executeStep : undefined, isGenerating, stopGenerationRunner };
}
