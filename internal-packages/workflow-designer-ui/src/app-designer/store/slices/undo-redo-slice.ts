import type {
	Connection,
	NodeLike,
	NodeUIState,
} from "@giselles-ai/protocol";
import type { StateCreator } from "zustand";
import type { AppDesignerStoreState } from "../app-designer-store";

const MAX_UNDO_HISTORY = 50;

/** Lightweight snapshot of workspace state for undo/redo */
export interface WorkspaceSnapshot {
	nodes: NodeLike[];
	connections: Connection[];
	stickyNotes: unknown[];
	name: string | undefined;
	nodeState: Record<string, NodeUIState>;
	selectedConnectionIds?: string[];
}

export interface UndoRedoSlice {
	_undoStack: WorkspaceSnapshot[];
	_redoStack: WorkspaceSnapshot[];
	_undoBatchDepth: number;
	_undoBatchSnapshot: WorkspaceSnapshot | null;
	pushUndoSnapshot: () => void;
	beginUndoBatch: () => void;
	endUndoBatch: () => void;
	undo: () => void;
	redo: () => void;
	canUndo: () => boolean;
	canRedo: () => boolean;
}

type UndoRedoSliceCreator = StateCreator<
	AppDesignerStoreState,
	[],
	[],
	UndoRedoSlice
>;

function captureSnapshot(s: AppDesignerStoreState): WorkspaceSnapshot {
	return {
		nodes: s.nodes,
		connections: s.connections,
		stickyNotes: (s as unknown as Record<string, unknown>).stickyNotes as unknown[] ?? [],
		name: s.name,
		nodeState: s.ui.nodeState,
		selectedConnectionIds: s.ui.selectedConnectionIds as string[] | undefined,
	};
}

function restoreSnapshot(
	s: AppDesignerStoreState,
	snapshot: WorkspaceSnapshot,
): Record<string, unknown> {
	return {
		nodes: snapshot.nodes,
		connections: snapshot.connections,
		stickyNotes: snapshot.stickyNotes,
		name: snapshot.name,
		ui: {
			...s.ui,
			nodeState: snapshot.nodeState,
			selectedConnectionIds: snapshot.selectedConnectionIds ?? [],
		},
	};
}

export function createUndoRedoSlice(): UndoRedoSliceCreator {
	return (set, get) => ({
		_undoStack: [],
		_redoStack: [],
		_undoBatchDepth: 0,
		_undoBatchSnapshot: null,

		pushUndoSnapshot: () => {
			const state = get();
			// Inside a batch: only capture snapshot on the first push
			if (state._undoBatchDepth > 0) {
				if (state._undoBatchSnapshot === null) {
					set({ _undoBatchSnapshot: captureSnapshot(state) });
				}
				return;
			}
			const snapshot = captureSnapshot(state);
			set({
				_undoStack: [...state._undoStack, snapshot].slice(
					-MAX_UNDO_HISTORY,
				),
				_redoStack: [],
			});
		},

		beginUndoBatch: () => {
			const state = get();
			set({ _undoBatchDepth: state._undoBatchDepth + 1 });
		},

		endUndoBatch: () => {
			const state = get();
			const newDepth = Math.max(0, state._undoBatchDepth - 1);
			if (newDepth === 0 && state._undoBatchSnapshot !== null) {
				// Commit the batched snapshot
				set({
					_undoBatchDepth: 0,
					_undoBatchSnapshot: null,
					_undoStack: [
						...state._undoStack,
						state._undoBatchSnapshot,
					].slice(-MAX_UNDO_HISTORY),
					_redoStack: [],
				});
			} else {
				set({ _undoBatchDepth: newDepth });
			}
		},

		undo: () => {
			const state = get();
			if (state._undoStack.length === 0) return;

			const snapshot =
				state._undoStack[state._undoStack.length - 1] as WorkspaceSnapshot;
			const currentSnapshot = captureSnapshot(state);

			set({
				...restoreSnapshot(state, snapshot),
				_undoStack: state._undoStack.slice(0, -1),
				_redoStack: [...state._redoStack, currentSnapshot],
			});
		},

		redo: () => {
			const state = get();
			if (state._redoStack.length === 0) return;

			const snapshot =
				state._redoStack[state._redoStack.length - 1] as WorkspaceSnapshot;
			const currentSnapshot = captureSnapshot(state);

			set({
				...restoreSnapshot(state, snapshot),
				_redoStack: state._redoStack.slice(0, -1),
				_undoStack: [...state._undoStack, currentSnapshot],
			});
		},

		canUndo: () => get()._undoStack.length > 0,
		canRedo: () => get()._redoStack.length > 0,
	});
}
