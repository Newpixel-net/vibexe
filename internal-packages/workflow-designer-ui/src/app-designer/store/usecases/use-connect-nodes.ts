import { type Input, InputId, type NodeId } from "@giselles-ai/protocol";
import { useCallback } from "react";
import { useAppDesignerStoreApi } from "../app-designer-provider";
import { useWorkspaceActions } from "../hooks";
import { useAddConnection } from "./use-add-connection";

export function useConnectNodes() {
	const storeApi = useAppDesignerStoreApi();
	const addConnection = useAddConnection();
	const addNodeInput = useWorkspaceActions((s) => s.addNodeInput);
	return useCallback(
		(outputNodeId: NodeId, inputNodeId: NodeId) => {
			// Use getState() for fresh nodes — the hook-provided nodes would be
			// stale when addNode() and connectNodes() are called in the same tick.
			const nodes = storeApi.getState().nodes;
			const outputNode = nodes.find((node) => node.id === outputNodeId);
			const inputNode = nodes.find((node) => node.id === inputNodeId);
			if (outputNode === undefined || inputNode === undefined) {
				console.warn(`Node not found: ${outputNodeId} or ${inputNodeId}`);
				return;
			}
			for (const output of outputNode.outputs) {
				const newInputId = InputId.generate();
				const newInput: Input = {
					id: newInputId,
					label: "Input",
					accessor: newInputId,
				};
				addNodeInput(inputNode.id, newInput);
				addConnection({
					outputNode,
					outputId: output.id,
					inputNode,
					inputId: newInput.id,
				});
			}
		},
		[storeApi, addNodeInput, addConnection],
	);
}
