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
		(outputNodeId: NodeId, inputNodeId: NodeId, specificOutputId?: string) => {
			// Use getState() for fresh nodes — the hook-provided nodes would be
			// stale when addNode() and connectNodes() are called in the same tick.
			const nodes = storeApi.getState().nodes;
			const outputNode = nodes.find((node) => node.id === outputNodeId);
			const inputNode = nodes.find((node) => node.id === inputNodeId);
			if (outputNode === undefined || inputNode === undefined) {
				console.warn(`Node not found: ${outputNodeId} or ${inputNodeId}`);
				return;
			}
			// If a specific output is requested, connect only that one.
			// Match by id, accessor, or label first, then fall back to index-based
			// matching for multi-output nodes where handle IDs differ from accessors
			// (e.g., Loop handle "done" maps to output index 0, "loop" to index 1).
			let outputsToConnect = outputNode.outputs;
			if (specificOutputId) {
				const directMatch = outputNode.outputs.filter(
					(o) =>
						o.id === specificOutputId ||
						o.accessor === specificOutputId ||
						o.label === specificOutputId,
				);
				if (directMatch.length > 0) {
					outputsToConnect = directMatch;
				} else {
					// Index-based: map handle IDs to output array positions
					const ct = outputNode.content.type;
					let idx = -1;
					if (ct === "loop") {
						idx = specificOutputId === "done" ? 0 : specificOutputId === "loop" ? 1 : -1;
					} else if (ct === "switch") {
						const m = specificOutputId.match(/^case-(\d+)$/);
						if (m) idx = Number.parseInt(m[1], 10);
					}
					if (idx >= 0 && idx < outputNode.outputs.length) {
						outputsToConnect = [outputNode.outputs[idx]];
					}
				}
			}

			for (const output of outputsToConnect) {
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
