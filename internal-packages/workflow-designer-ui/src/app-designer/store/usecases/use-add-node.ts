import type { NodeLike, NodeUIState } from "@vibexe-ai/protocol";
import { useCallback } from "react";
import { useUndoRedoActions, useWorkspaceActions } from "../hooks";
import { useAutoConfigureAppEntryNode } from "./use-auto-configure-app-entry-node";
import { useAutoConfigureManualTrigger } from "./use-auto-configure-manual-trigger";

export function useAddNode() {
	const actions = useWorkspaceActions((s) => ({
		addNode: s.addNode,
		upsertUiNodeState: s.upsertUiNodeState,
	}));
	const { pushUndoSnapshot } = useUndoRedoActions((s) => ({
		pushUndoSnapshot: s.pushUndoSnapshot,
	}));
	const autoConfigureAppEntryNode = useAutoConfigureAppEntryNode();
	const autoConfigureManualTrigger = useAutoConfigureManualTrigger();
	return useCallback(
		(node: NodeLike, ui?: NodeUIState) => {
			pushUndoSnapshot();
			actions.addNode(node);
			if (ui) {
				actions.upsertUiNodeState(node.id, ui);
			}
			void autoConfigureAppEntryNode(node);
			void autoConfigureManualTrigger(node);
		},
		[actions, pushUndoSnapshot, autoConfigureAppEntryNode, autoConfigureManualTrigger],
	);
}
