"use client";

/**
 * Game Editor Context — Unity/Godot-style scene editor state.
 * Manages: editor enabled/disabled, scene tree, selected object, gizmo mode.
 * Communicates with the Sandpack iframe via postMessage.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// ===== Types =====

export type GizmoMode = "translate" | "rotate" | "scale" | "pan";

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
	_textureUrl?: string | null;
	_textureTileX?: number;
	_textureTileY?: number;
	_textureRotation?: number;
	_textureOffsetX?: number;
	_textureOffsetY?: number;
}

export interface PrefabDefinition {
	factory: string;
	args: Record<string, any>;
	displayName: string;
	category: string;
}

// ===== Game Settings =====
export type QualityPreset = "low" | "medium" | "high" | "ultra";

export interface GameSettings {
	version?: number;
	player?: {
		spawnX?: number; spawnY?: number; spawnZ?: number;
		startingLives?: number;
		respawnX?: number; respawnY?: number; respawnZ?: number;
	};
	physics?: {
		gravity?: number; fallGravity?: number;
		jumpForce?: number; moveSpeed?: number; runSpeed?: number;
		friction?: number; coyoteTime?: number;
	};
	camera?: {
		offsetY?: number; offsetZ?: number; fov?: number;
		lerp?: number; lookAhead?: number; lookY?: number;
		near?: number; far?: number;
	};
	environment?: {
		backgroundColor?: string;
		ambientLightIntensity?: number;
		ambientLightColor?: string;
		sunLightIntensity?: number;
		sunLightColor?: string;
		hemisphereIntensity?: number;
		hemisphereSkyColor?: string;
		hemisphereGroundColor?: string;
		fogEnabled?: boolean; fogColor?: string; fogNear?: number; fogFar?: number;
		fogType?: "linear" | "exponential"; fogDensity?: number;
		shadowQuality?: "low" | "medium" | "high";
	};
	audio?: {
		masterVolume?: number;
		musicVolume?: number;
		sfxVolume?: number;
		enabled?: boolean;
	};
	postProcessing?: {
		preset?: "none" | "cinematic" | "vibrant" | "dark" | "neon" | "natural";
		bloomIntensity?: number;
		bloomThreshold?: number;
	};
	performance?: {
		qualityPreset?: QualityPreset;
		showFPS?: boolean;
		antialias?: boolean;
		pixelRatio?: number;
		maxFPS?: number;
	};
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
	version: 1,
	player: { spawnX: 0, spawnY: 3, spawnZ: 0, startingLives: 3, respawnX: 0, respawnY: 5, respawnZ: 0 },
	physics: { gravity: -38, fallGravity: -65, jumpForce: 17, moveSpeed: 6, runSpeed: 7.5, friction: 28, coyoteTime: 0.15 },
	camera: { offsetY: 8, offsetZ: 12, fov: 60, lerp: 3, lookAhead: 5, lookY: 1, near: 0.1, far: 1000 },
	environment: { backgroundColor: "#87CEEB", ambientLightIntensity: 0.15, ambientLightColor: "#ffffff", sunLightIntensity: 0.55, sunLightColor: "#fff8ee", hemisphereIntensity: 0.35, hemisphereSkyColor: "#eef4ff", hemisphereGroundColor: "#886644", fogEnabled: false, fogColor: "#88aacc", fogNear: 30, fogFar: 100, fogType: "linear" as const, fogDensity: 0.02, shadowQuality: "medium" as const },
	audio: { masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.7, enabled: true },
	postProcessing: { preset: "none" as const, bloomIntensity: 0.5, bloomThreshold: 0.8 },
	performance: { qualityPreset: "high" as QualityPreset, showFPS: false, antialias: true, pixelRatio: 1, maxFPS: 60 },
};

interface GameEditorContextValue {
	enabled: boolean;
	sceneTree: SceneNode | null;
	selectedObject: SelectedSceneObject | null;
	gizmoMode: GizmoMode;
	snapEnabled: boolean;
	isDirty: boolean;
	isSaving: boolean;
	// Animation editor
	animationClips: string[];
	currentAnimClip: string | null;
	animationMap: Record<string, string> | null;
	animClipDurations: Record<string, number>;
	animPlaybackState: "stopped" | "playing" | "paused";
	animCurrentTime: number;
	animClipDuration: number;
	// Animation name overrides (originalName → displayName)
	animClipOverrides: Record<string, string>;
	animModelId: string | null;
	// Palette / Asset Library
	activePrefab: PrefabDefinition | null;
	// Game Settings
	gameSettings: GameSettings;
	updateGameSettings: (patch: Partial<GameSettings>) => void;
	setGameSettings: (settings: GameSettings) => void;
	updateCameraProperty: (property: string, value: number) => void;
	// Pick-from-scene mode for spawn/respawn position
	pickSpawnActive: boolean;
	pickRespawnActive: boolean;
	togglePickSpawn: () => void;
	togglePickRespawn: () => void;
	// Dynamic character half-height (from bridge, defaults to 0.75)
	characterHalfHeight: number;
	setCharacterHalfHeight: (v: number) => void;
	// Scene editor extended state
	gizmoSpace: "world" | "local";
	hierarchySearch: string;
	canUndo: boolean;
	canRedo: boolean;
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
	selectAndFocus: (uuid: string) => void;
	duplicateSelected: () => void;
	undoAction: () => void;
	toggleSnap: () => void;
	setSnapEnabled: (v: boolean) => void;
	setDirty: (v: boolean) => void;
	setIsSaving: (v: boolean) => void;
	saveScene: () => Promise<void>;
	setSaveHandler: (handler: () => Promise<void>) => void;
	// Animation editor
	getAnimations: (uuid: string) => void;
	playAnimation: (uuid: string, clipName: string) => void;
	pauseAnimation: (uuid: string) => void;
	resumeAnimation: (uuid: string) => void;
	stopAnimation: (uuid: string) => void;
	seekAnimation: (uuid: string, time: number) => void;
	setAnimationClips: (clips: string[], current: string | null, map: Record<string, string> | null, durations?: Record<string, number>) => void;
	updateAnimProgress: (time: number, duration: number, clipName: string | null, paused: boolean) => void;
	renameAnimClip: (originalName: string, newDisplayName: string) => void;
	fetchAnimOverrides: (modelId: string) => void;
	// Palette / Asset Library
	setActivePrefab: (prefab: PrefabDefinition | null) => void;
	spawnObject: (factory: string, position: { x: number; y: number; z: number }, args?: Record<string, any>) => void;
	// Texture library
	applyTexture: (uuid: string, textureUrl: string, tileX: number, tileY: number, hasPBR?: boolean) => void;
	removeTexture: (uuid: string) => void;
	updateTiling: (uuid: string, tileX: number, tileY: number) => void;
	updateTextureParams: (uuid: string, tileX: number, tileY: number, rotation: number, offsetX: number, offsetY: number) => void;
	// Scene editor extended actions
	redoAction: () => void;
	renameObject: (uuid: string, name: string) => void;
	toggleVisibility: (uuid: string) => void;
	toggleGizmoSpace: () => void;
	setGizmoSpace: (space: "world" | "local") => void;
	setHierarchySearch: (search: string) => void;
	setUndoRedoState: (canUndo: boolean, canRedo: boolean) => void;
	// Camera orientation for Scene Gizmo
	cameraQuaternion: { x: number; y: number; z: number; w: number };
	setCameraQuaternion: (q: { x: number; y: number; z: number; w: number }) => void;
	snapCameraToView: (direction: "front" | "back" | "left" | "right" | "top" | "bottom") => void;
	// Perspective / Orthographic toggle
	editorProjection: "perspective" | "orthographic";
	setEditorProjection: (mode: "perspective" | "orthographic") => void;
	toggleEditorProjection: () => void;
	// Center / Pivot orbit toggle
	pivotMode: "center" | "pivot";
	setPivotMode: (mode: "center" | "pivot") => void;
	togglePivotMode: () => void;
	// Generic iframe message sender (for module communication)
	sendToIframe: (msg: any) => void;
}

const GameEditorContext = createContext<GameEditorContextValue | null>(null);

export function GameEditorProvider({ children }: { children: ReactNode }) {
	const [enabled, setEnabledState] = useState(false);
	const [sceneTree, setSceneTree] = useState<SceneNode | null>(null);
	const [selectedObject, setSelectedObject] = useState<SelectedSceneObject | null>(null);
	const [gizmoMode, setGizmoModeState] = useState<GizmoMode>("translate");
	const [snapEnabled, setSnapEnabledState] = useState(false);
	const [isDirty, setIsDirty] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [animationClips, setAnimationClipsState] = useState<string[]>([]);
	const [currentAnimClip, setCurrentAnimClip] = useState<string | null>(null);
	const [animationMap, setAnimationMapState] = useState<Record<string, string> | null>(null);
	const [animClipDurations, setAnimClipDurations] = useState<Record<string, number>>({});
	const [animPlaybackState, setAnimPlaybackState] = useState<"stopped" | "playing" | "paused">("stopped");
	const [animCurrentTime, setAnimCurrentTime] = useState(0);
	const [animClipDuration, setAnimClipDuration] = useState(0);
	const [activePrefab, setActivePrefabState] = useState<PrefabDefinition | null>(null);
	const [gameSettings, setGameSettingsState] = useState<GameSettings>({ ...DEFAULT_GAME_SETTINGS });
	const [pickSpawnActive, setPickSpawnActive] = useState(false);
	const [pickRespawnActive, setPickRespawnActive] = useState(false);
	const [characterHalfHeight, setCharacterHalfHeight] = useState(0.75);
	const pickSpawnRef = useRef(false);
	const pickRespawnRef = useRef(false);
	const [animClipOverrides, setAnimClipOverrides] = useState<Record<string, string>>({});
	const [animModelId, setAnimModelId] = useState<string | null>(null);
	const [gizmoSpace, setGizmoSpaceState] = useState<"world" | "local">("world");
	const [hierarchySearch, setHierarchySearchState] = useState("");
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);
	const [cameraQuaternion, setCameraQuaternion] = useState<{ x: number; y: number; z: number; w: number }>({ x: 0, y: 0, z: 0, w: 1 });
	const [editorProjection, setEditorProjectionState] = useState<"perspective" | "orthographic">("perspective");
	const [pivotMode, setPivotModeState] = useState<"center" | "pivot">("center");
	const saveHandlerRef = useRef<(() => Promise<void>) | null>(null);
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
			if (next) {
				// Send enable immediately
				const msg = { type: "game-editor-enable" };
				sendToIframe(msg);
				try {
					const iframes = document.querySelectorAll(".sandpack-container iframe");
					for (const iframe of iframes) {
						const f = iframe as HTMLIFrameElement;
						if (f.contentWindow) {
							f.contentWindow.postMessage(msg, "*");
						}
					}
				} catch { /* ignore */ }
				// Re-send FX settings after bridge activates (bridge needs renderer/scene/camera ready)
				setTimeout(() => {
					setGameSettingsState((gs) => {
						const pp = gs.postProcessing;
						if (pp?.preset && pp.preset !== "none") {
							sendToIframe({
								type: "updateGameSettings",
								settings: { postProcessing: pp },
							});
						}
						return gs; // don't actually change state
					});
				}, 800);
			}
			if (!next) {
				// Send disable to iframe so the bridge deactivates (removes gizmo, grid, restores game)
				const disableMsg = { type: "game-editor-disable" };
				sendToIframe(disableMsg);
				try {
					const iframes = document.querySelectorAll(".sandpack-container iframe");
					for (const iframe of iframes) {
						const f = iframe as HTMLIFrameElement;
						if (f.contentWindow) f.contentWindow.postMessage(disableMsg, "*");
					}
				} catch { /* ignore */ }
				setSelectedObject(null);
				setSceneTree(null);
				// Reset editor state to defaults
				setGizmoModeState("translate");
				setGizmoSpaceState("world");
				setCanUndo(false);
				setCanRedo(false);
				setCameraQuaternion({ x: 0, y: 0, z: 0, w: 1 });
				setEditorProjectionState("perspective");
				setPivotModeState("center");
			}
			return next;
		});
	}, [sendToIframe]);

	const setEnabled = useCallback((v: boolean) => {
		setEnabledState(v);
		if (v) {
			// Send enable immediately
			const msg = { type: "game-editor-enable" };
			sendToIframe(msg);
			try {
				const iframes = document.querySelectorAll(".sandpack-container iframe");
				for (const iframe of iframes) {
					const f = iframe as HTMLIFrameElement;
					if (f.contentWindow) f.contentWindow.postMessage(msg, "*");
				}
			} catch { /* ignore */ }
		}
		if (!v) {
			// Send disable to iframe so the bridge deactivates
			const disableMsg = { type: "game-editor-disable" };
			sendToIframe(disableMsg);
			try {
				const iframes = document.querySelectorAll(".sandpack-container iframe");
				for (const iframe of iframes) {
					const f = iframe as HTMLIFrameElement;
					if (f.contentWindow) f.contentWindow.postMessage(disableMsg, "*");
				}
			} catch { /* ignore */ }
			setSelectedObject(null);
			setSceneTree(null);
			// Reset editor state to defaults
			setGizmoModeState("translate");
			setGizmoSpaceState("world");
			setCanUndo(false);
			setCanRedo(false);
			setCameraQuaternion({ x: 0, y: 0, z: 0, w: 1 });
			setEditorProjectionState("perspective");
			setPivotModeState("center");
		}
	}, [sendToIframe]);

	const setGizmoMode = useCallback((mode: GizmoMode) => {
		setGizmoModeState(mode);
		sendToIframe({ type: "game-editor-set-mode", mode });
	}, [sendToIframe]);

	const selectObjectByUuid = useCallback((uuid: string) => {
		if (uuid === "__game_camera__") {
			sendToIframe({ type: "game-editor-select-camera", uuid });
		} else {
			sendToIframe({ type: "game-editor-select-by-uuid", uuid });
		}
	}, [sendToIframe]);

	const deselectObject = useCallback(() => {
		setSelectedObject(null);
		sendToIframe({ type: "game-editor-deselect" });
		// Reset animation state
		setAnimationClipsState([]);
		setCurrentAnimClip(null);
		setAnimPlaybackState("stopped");
		setAnimCurrentTime(0);
		setAnimClipDuration(0);
		setAnimClipDurations({});
		setAnimClipOverrides({});
		setAnimModelId(null);
	}, [sendToIframe]);

	const updateProperty = useCallback((uuid: string, property: string, value: any) => {
		sendToIframe({ type: "game-editor-update-property", uuid, property, value });
	}, [sendToIframe]);

	const deleteObject = useCallback((uuid: string) => {
		sendToIframe({ type: "game-editor-delete-object", uuid });
		setSelectedObject(null);
		setIsDirty(true);
	}, [sendToIframe]);

	const requestSceneTree = useCallback(() => {
		sendToIframe({ type: "game-editor-request-tree" });
	}, [sendToIframe]);

	const focusSelected = useCallback(() => {
		sendToIframe({ type: "game-editor-focus" });
	}, [sendToIframe]);

	const selectAndFocus = useCallback((uuid: string) => {
		sendToIframe({ type: "game-editor-select-and-focus", uuid });
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

	const setDirty = useCallback((v: boolean) => setIsDirty(v), []);

	const setSaveHandler = useCallback((handler: () => Promise<void>) => {
		saveHandlerRef.current = handler;
	}, []);

	// Animation editor actions
	const getAnimations = useCallback((uuid: string) => {
		sendToIframe({ type: "game-editor-get-animations", uuid });
	}, [sendToIframe]);

	const playAnimation = useCallback((uuid: string, clipName: string) => {
		sendToIframe({ type: "game-editor-play-animation", uuid, clipName });
		setCurrentAnimClip(clipName);
		setAnimPlaybackState("playing");
	}, [sendToIframe]);

	const pauseAnimation = useCallback((uuid: string) => {
		sendToIframe({ type: "game-editor-pause-animation", uuid });
		setAnimPlaybackState("paused");
	}, [sendToIframe]);

	const resumeAnimation = useCallback((uuid: string) => {
		sendToIframe({ type: "game-editor-resume-animation", uuid });
		setAnimPlaybackState("playing");
	}, [sendToIframe]);

	const stopAnimation = useCallback((uuid: string) => {
		sendToIframe({ type: "game-editor-stop-animation", uuid });
		setAnimPlaybackState("stopped");
		setCurrentAnimClip(null);
		setAnimCurrentTime(0);
		setAnimClipDuration(0);
	}, [sendToIframe]);

	const seekAnimation = useCallback((uuid: string, time: number) => {
		sendToIframe({ type: "game-editor-seek-animation", uuid, time });
	}, [sendToIframe]);

	const updateAnimProgress = useCallback((time: number, duration: number, clipName: string | null, paused: boolean) => {
		setAnimCurrentTime(time);
		setAnimClipDuration(duration);
		if (clipName) setCurrentAnimClip(clipName);
		setAnimPlaybackState(paused ? "paused" : duration > 0 ? "playing" : "stopped");
	}, []);

	const setAnimationClips = useCallback((clips: string[], current: string | null, map: Record<string, string> | null, durations?: Record<string, number>) => {
		setAnimationClipsState(clips);
		setCurrentAnimClip(current);
		setAnimationMapState(map);
		if (durations) setAnimClipDurations(durations);
	}, []);

	// Fetch overrides when selected object changes (AnimatedCharacter)
	const fetchAnimOverrides = useCallback((modelId: string) => {
		setAnimModelId(modelId);
		fetch(`/api/app-builder/animation-overrides?model=${encodeURIComponent(modelId)}`)
			.then((r) => r.json())
			.then((data) => {
				setAnimClipOverrides(data.overrides || {});
			})
			.catch(() => setAnimClipOverrides({}));
	}, []);

	// Rename a clip: save override locally + persist to API
	const renameAnimClip = useCallback((originalName: string, newDisplayName: string) => {
		if (!animModelId) return;
		setAnimClipOverrides((prev) => {
			const next = { ...prev };
			if (newDisplayName === originalName || !newDisplayName.trim()) {
				delete next[originalName];
			} else {
				next[originalName] = newDisplayName.trim();
			}
			// Persist to server
			fetch("/api/app-builder/animation-overrides", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ model: animModelId, overrides: next }),
			}).catch(() => { /* silent */ });
			return next;
		});
	}, [animModelId]);

	const togglePickSpawn = useCallback(() => {
		setPickSpawnActive((prev) => {
			const next = !prev;
			pickSpawnRef.current = next;
			if (next) { setPickRespawnActive(false); pickRespawnRef.current = false; }
			return next;
		});
	}, []);

	const togglePickRespawn = useCallback(() => {
		setPickRespawnActive((prev) => {
			const next = !prev;
			pickRespawnRef.current = next;
			if (next) { setPickSpawnActive(false); pickSpawnRef.current = false; }
			return next;
		});
	}, []);

	const updateGameSettings = useCallback((patch: Partial<GameSettings>) => {
		setGameSettingsState((prev) => {
			const next = { ...prev };
			for (const [key, val] of Object.entries(patch)) {
				if (val && typeof val === "object" && !Array.isArray(val)) {
					(next as any)[key] = { ...(prev as any)[key], ...val };
				} else {
					(next as any)[key] = val;
				}
			}
			// Live-sync player spawn position to iframe (but not during pick mode —
			// in pick mode the player is already being dragged by the user)
			if (patch.player && !pickSpawnRef.current && !pickRespawnRef.current) {
				const p = patch.player as Record<string, unknown>;
				if (p.spawnX !== undefined || p.spawnY !== undefined || p.spawnZ !== undefined) {
					sendToIframe({
						type: "game-editor-move-player",
						x: p.spawnX ?? next.player?.spawnX,
						y: p.spawnY ?? next.player?.spawnY,
						z: p.spawnZ ?? next.player?.spawnZ,
					});
				}
			}
			// Live-sync ALL settings to iframe (physics, camera, lighting, fog, etc.)
			sendToIframe({ type: "updateGameSettings", settings: next });
			// FX presets: send via external bridge (works even with old Game3D.tsx)
			if (patch.postProcessing) {
				const pp = next.postProcessing;
				sendToIframe({
					type: "game-editor-apply-fx",
					preset: pp?.preset ?? "none",
					bloomIntensity: pp?.bloomIntensity,
					bloomThreshold: pp?.bloomThreshold,
				});
			}
			return next;
		});
	}, [sendToIframe]);

	const setGameSettings = useCallback((settings: GameSettings) => {
		setGameSettingsState(settings);
	}, []);

	const updateCameraProperty = useCallback((property: string, value: number) => {
		updateGameSettings({ camera: { [property]: value } });
		sendToIframe({ type: "game-editor-update-camera-property", property, value });
	}, [updateGameSettings, sendToIframe]);

	const setActivePrefab = useCallback((prefab: PrefabDefinition | null) => {
		setActivePrefabState(prefab);
		sendToIframe({
			type: "game-editor-set-spawn-mode",
			active: !!prefab,
			factory: prefab?.factory ?? null,
			args: prefab?.args ?? null,
		});
	}, [sendToIframe]);

	const spawnObject = useCallback((factory: string, position: { x: number; y: number; z: number }, args?: Record<string, any>) => {
		sendToIframe({ type: "game-editor-spawn-object", factory, position, args });
		setIsDirty(true);
	}, [sendToIframe]);

	// Texture library actions
	const applyTexture = useCallback((uuid: string, textureUrl: string, tileX: number, tileY: number, hasPBR?: boolean) => {
		sendToIframe({ type: "game-editor-apply-texture", uuid, textureUrl, tileX, tileY, hasPBR: !!hasPBR });
		setIsDirty(true);
	}, [sendToIframe]);

	const removeTexture = useCallback((uuid: string) => {
		sendToIframe({ type: "game-editor-remove-texture", uuid });
		setIsDirty(true);
	}, [sendToIframe]);

	const updateTiling = useCallback((uuid: string, tileX: number, tileY: number) => {
		sendToIframe({ type: "game-editor-update-tiling", uuid, tileX, tileY });
		setIsDirty(true);
	}, [sendToIframe]);

	const updateTextureParams = useCallback((uuid: string, tileX: number, tileY: number, rotation: number, offsetX: number, offsetY: number) => {
		sendToIframe({ type: "game-editor-update-texture-params", uuid, tileX, tileY, rotation, offsetX, offsetY });
		// Optimistic UI update — don't wait for bridge round-trip
		setSelectedObject(prev => prev && prev.uuid === uuid ? { ...prev, _textureTileX: tileX, _textureTileY: tileY, _textureRotation: rotation, _textureOffsetX: offsetX, _textureOffsetY: offsetY } : prev);
		setIsDirty(true);
	}, [sendToIframe]);

	// Scene editor extended actions
	const redoAction = useCallback(() => {
		sendToIframe({ type: "game-editor-redo" });
	}, [sendToIframe]);

	const renameObject = useCallback((uuid: string, name: string) => {
		sendToIframe({ type: "game-editor-rename-object", uuid, name });
	}, [sendToIframe]);

	const toggleVisibility = useCallback((uuid: string) => {
		sendToIframe({ type: "game-editor-toggle-visibility", uuid });
	}, [sendToIframe]);

	const toggleGizmoSpace = useCallback(() => {
		sendToIframe({ type: "game-editor-toggle-space" });
	}, [sendToIframe]);

	const setGizmoSpace = useCallback((space: "world" | "local") => {
		setGizmoSpaceState(space);
	}, []);

	const snapCameraToView = useCallback((direction: "front" | "back" | "left" | "right" | "top" | "bottom") => {
		sendToIframe({ type: "game-editor-snap-camera", direction });
	}, [sendToIframe]);

	const setEditorProjection = useCallback((mode: "perspective" | "orthographic") => {
		setEditorProjectionState(mode);
	}, []);

	const toggleEditorProjection = useCallback(() => {
		setEditorProjectionState((prev) => {
			const next = prev === "perspective" ? "orthographic" : "perspective";
			sendToIframe({ type: "game-editor-toggle-projection", projection: next });
			return next;
		});
	}, [sendToIframe]);

	const setPivotMode = useCallback((mode: "center" | "pivot") => {
		setPivotModeState(mode);
	}, []);

	const togglePivotMode = useCallback(() => {
		setPivotModeState((prev) => {
			const next = prev === "center" ? "pivot" : "center";
			sendToIframe({ type: "game-editor-set-pivot-mode", mode: next });
			return next;
		});
	}, [sendToIframe]);

	const setHierarchySearch = useCallback((search: string) => {
		setHierarchySearchState(search);
	}, []);

	const setUndoRedoState = useCallback((undo: boolean, redo: boolean) => {
		setCanUndo(undo);
		setCanRedo(redo);
	}, []);

	const saveScene = useCallback(async () => {
		if (!saveHandlerRef.current) return;
		setIsSaving(true);
		try {
			await saveHandlerRef.current();
			setIsDirty(false);
		} catch (err) {
			console.error("[GameEditor] Save failed:", err);
		} finally {
			setIsSaving(false);
		}
	}, []);

	// Reset dirty state and pick modes when editor is disabled
	useEffect(() => {
		if (!enabled) {
			setIsDirty(false);
			setIsSaving(false);
			setPickSpawnActive(false);
			setPickRespawnActive(false);
			pickSpawnRef.current = false;
			pickRespawnRef.current = false;
		}
	}, [enabled]);

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
				isDirty,
				isSaving,
				animationClips,
				currentAnimClip,
				animationMap,
				animClipDurations,
				animPlaybackState,
				animCurrentTime,
				animClipDuration,
				animClipOverrides,
				animModelId,
				activePrefab,
				gameSettings,
				updateGameSettings,
				setGameSettings,
				updateCameraProperty,
				pickSpawnActive,
				pickRespawnActive,
				togglePickSpawn,
				togglePickRespawn,
				characterHalfHeight,
				setCharacterHalfHeight,
				gizmoSpace,
				hierarchySearch,
				canUndo,
				canRedo,
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
				selectAndFocus,
				duplicateSelected,
				undoAction,
				toggleSnap,
				setSnapEnabled,
				setDirty,
				setIsSaving,
				saveScene,
				setSaveHandler,
				getAnimations,
				playAnimation,
				pauseAnimation,
				resumeAnimation,
				stopAnimation,
				seekAnimation,
				setAnimationClips,
				updateAnimProgress,
				renameAnimClip,
				fetchAnimOverrides,
				setActivePrefab,
				spawnObject,
				applyTexture,
				removeTexture,
				updateTiling,
				updateTextureParams,
				redoAction,
				renameObject,
				toggleVisibility,
				toggleGizmoSpace,
				setGizmoSpace,
				setHierarchySearch,
				setUndoRedoState,
				cameraQuaternion,
				setCameraQuaternion,
				snapCameraToView,
				editorProjection,
				setEditorProjection,
				toggleEditorProjection,
				pivotMode,
				setPivotMode,
				togglePivotMode,
				sendToIframe,
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
