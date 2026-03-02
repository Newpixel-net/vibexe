"use client";

/**
 * Game Editor Context — Unity/Godot-style scene editor state.
 * Manages: editor enabled/disabled, scene tree, selected object, gizmo mode.
 * Communicates with the Sandpack iframe via postMessage.
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

// ===== Types =====

export type GizmoMode = "translate" | "rotate" | "scale";

export interface SceneNode {
	uuid: string;
	name: string;
	type: string;
	position: { x: number; y: number; z: number };
	rotation: { x: number; y: number; z: number };
	scale: { x: number; y: number; z: number };
	visible: boolean;
	userData: Record<string, any>;
	children: SceneNode[];
	_isMesh?: boolean;
	_isLight?: boolean;
	_isGroup?: boolean;
	_materialColor?: string;
}

export interface SelectedSceneObject {
	uuid: string;
	name: string;
	type: string;
	position: { x: number; y: number; z: number };
	rotation: { x: number; y: number; z: number };
	scale: { x: number; y: number; z: number };
	visible: boolean;
	castShadow?: boolean;
	userData: Record<string, any>;
	_materialColor?: string;
}

interface GameEditorContextValue {
	enabled: boolean;
	sceneTree: SceneNode | null;
	selectedObject: SelectedSceneObject | null;
	gizmoMode: GizmoMode;
	snapEnabled: boolean;
	toggleEditor: () => void;
	setEnabled: (v: boolean) => void;
	setGizmoMode: (mode: GizmoMode) => void;
	selectObjectByUuid: (uuid: string) => void;
	deselectObject: () => void;
	updateSceneTree: (tree: SceneNode) => void;
	updateSelectedObject: (obj: SelectedSceneObject | null) => void;
	updateProperty: (uuid: string, property: string, value: any) => void;
	deleteObject: (uuid: string) => void;
	requestSceneTree: () => void;
	setIframeRef: (ref: React.RefObject<HTMLIFrameElement | null>) => void;
	focusSelected: () => void;
	duplicateSelected: () => void;
	undoAction: () => void;
	toggleSnap: () => void;
	setSnapEnabled: (v: boolean) => void;
}

const GameEditorContext = createContext<GameEditorContextValue | null>(null);

export function GameEditorProvider({ children }: { children: ReactNode }) {
	const [enabled, setEnabledState] = useState(false);
	const [sceneTree, setSceneTree] = useState<SceneNode | null>(null);
	const [selectedObject, setSelectedObject] = useState<SelectedSceneObject | null>(null);
	const [gizmoMode, setGizmoModeState] = useState<GizmoMode>("translate");
	const [snapEnabled, setSnapEnabledState] = useState(false);
	const iframeRef = useRef<React.RefObject<HTMLIFrameElement | null> | null>(null);

	const sendToIframe = useCallback((msg: any) => {
		const iframe = iframeRef.current?.current;
		if (iframe?.contentWindow) {
			console.log("[GameEditor] Sending to iframe:", msg.type);
			iframe.contentWindow.postMessage(msg, "*");
		} else {
			console.warn("[GameEditor] No iframe contentWindow available for:", msg.type, "iframeRef.current:", !!iframeRef.current, "current:", !!iframeRef.current?.current);
		}
	}, []);

	const toggleEditor = useCallback(() => {
		setEnabledState((prev) => {
			const next = !prev;
			const msg = { type: next ? "game-editor-enable" : "game-editor-disable" };
			sendToIframe(msg);
			// Fallback: also try sending via any iframe in the preview container
			// This handles cases where iframeRef chain breaks
			try {
				const iframes = document.querySelectorAll(".sandpack-container iframe");
				for (const iframe of iframes) {
					const f = iframe as HTMLIFrameElement;
					if (f.contentWindow) {
						f.contentWindow.postMessage(msg, "*");
					}
				}
			} catch { /* ignore */ }
			if (!next) {
				setSelectedObject(null);
				setSceneTree(null);
			}
			return next;
		});
	}, [sendToIframe]);

	const setEnabled = useCallback((v: boolean) => {
		setEnabledState(v);
		const msg = { type: v ? "game-editor-enable" : "game-editor-disable" };
		sendToIframe(msg);
		// Fallback: also try via DOM query
		try {
			const iframes = document.querySelectorAll(".sandpack-container iframe");
			for (const iframe of iframes) {
				const f = iframe as HTMLIFrameElement;
				if (f.contentWindow) f.contentWindow.postMessage(msg, "*");
			}
		} catch { /* ignore */ }
		if (!v) {
			setSelectedObject(null);
			setSceneTree(null);
		}
	}, [sendToIframe]);

	const setGizmoMode = useCallback((mode: GizmoMode) => {
		setGizmoModeState(mode);
		sendToIframe({ type: "game-editor-set-mode", mode });
	}, [sendToIframe]);

	const selectObjectByUuid = useCallback((uuid: string) => {
		sendToIframe({ type: "game-editor-select-by-uuid", uuid });
	}, [sendToIframe]);

	const deselectObject = useCallback(() => {
		setSelectedObject(null);
		sendToIframe({ type: "game-editor-deselect" });
	}, [sendToIframe]);

	const updateProperty = useCallback((uuid: string, property: string, value: any) => {
		sendToIframe({ type: "game-editor-update-property", uuid, property, value });
	}, [sendToIframe]);

	const deleteObject = useCallback((uuid: string) => {
		sendToIframe({ type: "game-editor-delete-object", uuid });
		setSelectedObject(null);
	}, [sendToIframe]);

	const requestSceneTree = useCallback(() => {
		sendToIframe({ type: "game-editor-request-tree" });
	}, [sendToIframe]);

	const focusSelected = useCallback(() => {
		sendToIframe({ type: "game-editor-focus" });
	}, [sendToIframe]);

	const duplicateSelected = useCallback(() => {
		sendToIframe({ type: "game-editor-duplicate" });
	}, [sendToIframe]);

	const undoAction = useCallback(() => {
		sendToIframe({ type: "game-editor-undo" });
	}, [sendToIframe]);

	const toggleSnap = useCallback(() => {
		sendToIframe({ type: "game-editor-toggle-snap" });
	}, [sendToIframe]);

	const setSnapEnabled = useCallback((v: boolean) => {
		setSnapEnabledState(v);
	}, []);

	const setIframeRefCb = useCallback((ref: React.RefObject<HTMLIFrameElement | null>) => {
		iframeRef.current = ref;
	}, []);

	return (
		<GameEditorContext.Provider
			value={{
				enabled,
				sceneTree,
				selectedObject,
				gizmoMode,
				snapEnabled,
				toggleEditor,
				setEnabled,
				setGizmoMode,
				selectObjectByUuid,
				deselectObject,
				updateSceneTree: setSceneTree,
				updateSelectedObject: setSelectedObject,
				updateProperty,
				deleteObject,
				requestSceneTree,
				setIframeRef: setIframeRefCb,
				focusSelected,
				duplicateSelected,
				undoAction,
				toggleSnap,
				setSnapEnabled,
			}}
		>
			{children}
		</GameEditorContext.Provider>
	);
}

export function useGameEditor(): GameEditorContextValue {
	const ctx = useContext(GameEditorContext);
	if (!ctx) throw new Error("useGameEditor must be used inside <GameEditorProvider>");
	return ctx;
}
