import { type Input, InputId, type NodeId } from "@vibexe-ai/protocol";
import { useCallback } from "react";
import { useAppDesignerStoreApi } from "../app-designer-provider";
import { useWorkspaceActions } from "../hooks";
import { useAddConnection } from "./use-add-connection";

/** Node types that have pre-allocated fixed input slots */
const FIXED_INPUT_TYPES = new Set(["merge", "compareDatasets"]);

export function useConnectNodes() {
	const storeApi = useAppDesignerStoreApi();
	const addConnection = useAddConnection();
	const addNodeInput = useWorkspaceActions((s) => s.addNodeInput);
	return useCallback(
		(outputNodeId: NodeId, inputNodeId: NodeId, specificOutputId?: string, targetHandle?: string) => {
			// Use getState() for fresh nodes — the hook-provided nodes would be
			// stale when addNode() and connectNodes() are called in the same tick.
			const state = storeApi.getState();
			const nodes = state.nodes;
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
						const m = specificOutputId.match(/^rule_(\d+)$/);
						if (m) idx = Number.parseInt(m[1], 10);
						else if (specificOutputId === "fallback") {
							idx = outputNode.outputs.length - 1;
						}
					}
					if (idx >= 0 && idx < outputNode.outputs.length) {
						outputsToConnect = [outputNode.outputs[idx]];
					}
				}
			}

			// For nodes with fixed input slots (Merge, CompareDatasets), reuse
			// existing pre-allocated inputs instead of creating new ones.
			const isFixedInput =
				inputNode.type === "operation" &&
				FIXED_INPUT_TYPES.has(inputNode.content.type);

			for (const output of outputsToConnect) {
				let inputId: InputId;

				if (isFixedInput) {
					// Find which pre-allocated inputs are already connected
					const connectedInputIds = new Set(
						state.connections
							.filter((c) => c.inputNode.id === inputNode.id)
							.map((c) => c.inputId),
					);

					// If targetHandle specified (drag-and-drop to specific handle),
					// map it to the corresponding pre-allocated input
					let reusedInput: Input | undefined;
					if (targetHandle) {
						const handleMatch = targetHandle.match(/^input-(\d+)$/);
						if (handleMatch) {
							const idx = Number.parseInt(handleMatch[1], 10) - 1;
							if (idx >= 0 && idx < inputNode.inputs.length) {
								reusedInput = inputNode.inputs[idx];
							}
						}
					}

					// Otherwise, find the first unconnected pre-allocated input
					if (!reusedInput) {
						reusedInput = inputNode.inputs.find(
							(inp) => !connectedInputIds.has(inp.id),
						);
					}

					if (!reusedInput) {
						// All input slots are occupied — skip this connection
						continue;
					}
					inputId = reusedInput.id;
				} else {
					const newInputId = InputId.generate();
					const newInput: Input = {
						id: newInputId,
						label: "Input",
						accessor: newInputId,
					};
					addNodeInput(inputNode.id, newInput);
					inputId = newInputId;
				}

				addConnection({
					outputNode,
					outputId: output.id,
					inputNode,
					inputId,
				});
			}
		},
		[storeApi, addNodeInput, addConnection],
	);
}
