import {
	type Connection,
	ConnectionId,
	type InputId,
	type NodeLike,
	type OutputId,
} from "@giselles-ai/protocol";
import { useCallback } from "react";
import { useAppDesignerStoreApi } from "../app-designer-provider";
import { useUndoRedoActions, useWorkspaceActions } from "../hooks";
import { useSyncAppConnectionStateIfNeeded } from "./use-sync-app-connection-state-if-needed";

export function useAddConnection() {
	const { addConnection } = useWorkspaceActions((s) => ({
		addConnection: s.addConnection,
	}));
	const { pushUndoSnapshot } = useUndoRedoActions((s) => ({
		pushUndoSnapshot: s.pushUndoSnapshot,
	}));
	const storeApi = useAppDesignerStoreApi();
	const syncAppConnectionStateIfNeeded = useSyncAppConnectionStateIfNeeded();

	return useCallback(
		(args: {
			outputNode: NodeLike;
			outputId: OutputId;
			inputNode: NodeLike;
			inputId: InputId;
			connectionType?: "regular" | "subNode";
		}) => {
			const { outputNode, outputId, inputNode, inputId, connectionType } = args;

			// Prevent duplicate connections (same output→input pair)
			const existing = storeApi.getState().connections;
			const isDuplicate = existing.some(
				(c) =>
					c.outputNode.id === outputNode.id &&
					c.outputId === outputId &&
					c.inputNode.id === inputNode.id &&
					c.inputId === inputId,
			);
			if (isDuplicate) return null;

			const newConnection = {
				id: ConnectionId.generate(),
				outputNode: {
					id: outputNode.id,
					type: outputNode.type,
					content: { type: outputNode.content.type },
				},
				outputId,
				inputNode: {
					id: inputNode.id,
					type: inputNode.type,
					content: { type: inputNode.content.type },
				},
				inputId,
				...(connectionType ? { connectionType } : {}),
			} as Connection;

			pushUndoSnapshot();
			addConnection(newConnection);
			syncAppConnectionStateIfNeeded();
			return newConnection;
		},
		[addConnection, pushUndoSnapshot, storeApi, syncAppConnectionStateIfNeeded],
	);
}
