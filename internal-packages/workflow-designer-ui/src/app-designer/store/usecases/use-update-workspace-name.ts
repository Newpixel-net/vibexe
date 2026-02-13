import { useCallback } from "react";
import { useUndoRedoActions, useWorkspaceActions } from "../hooks";

export function useUpdateWorkspaceName() {
	const { updateWorkspaceName } = useWorkspaceActions((s) => ({
		updateWorkspaceName: s.updateWorkspaceName,
	}));
	const { pushUndoSnapshot } = useUndoRedoActions((s) => ({
		pushUndoSnapshot: s.pushUndoSnapshot,
	}));
	return useCallback(
		(name: string | undefined) => {
			pushUndoSnapshot();
			updateWorkspaceName(name);
		},
		[pushUndoSnapshot, updateWorkspaceName],
	);
}
