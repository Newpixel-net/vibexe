"use client";

/**
 * GameEditorPanel — Scene hierarchy + tabbed content (Assets / Properties / Settings).
 * Overlaid on the right side of the viewport when editor is active.
 */

import { Box, Camera, Check, ChevronDown, ChevronRight, Copy, Eye, EyeOff, Focus, Lightbulb, Layers, Lock, Paintbrush, Pause, Pencil, Play, Plus, Search, Settings, Square, Sun, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@vibexe-internal/ui/dialog";
import { DragNumberInput } from "./drag-number-input";
import { SceneTreeNode } from "./scene-tree-node";
import { useGameEditor, type GameSettings, type SceneDefinition } from "../lib/game-editor-context";
import { GameEditorAssetLibrary } from "./game-editor-asset-library";
import { GameSettingsContent, type GameSettingsContentProps } from "./game-settings-panel";
import { TEXTURE_CATALOG, TEXTURE_CATEGORIES, textureUrl, type TextureCategory, type TextureLibraryItem } from "../lib/texture-library-data";

type EditorTab = "properties" | "assets" | "settings";

export interface GameEditorPanelProps {
	settingsProps?: {
		onSave: (settings: GameSettings) => void;
	};
}

export function GameEditorPanel({ settingsProps }: GameEditorPanelProps) {
	const {
		sceneTree,
		selectedObject,
		selectObjectByUuid,
		updateProperty,
		deleteObject,
		focusSelected,
		selectAndFocus,
		duplicateSelected,
		animationClips,
		currentAnimClip,
		animClipDurations,
		animPlaybackState,
		animCurrentTime,
		animClipDuration,
		animClipOverrides,
		getAnimations,
		playAnimation,
		pauseAnimation,
		resumeAnimation,
		stopAnimation,
		seekAnimation,
		renameAnimClip,
		fetchAnimOverrides,
		renameObject,
		toggleVisibility,
		toggleLock,
		selectedUuids,
		toggleMultiSelect,
		deleteSelected,
		groupSelected,
		ungroupSelected,
		hierarchySearch,
		setHierarchySearch,
		// Settings data from context
		gameSettings,
		updateGameSettings,
		pickSpawnActive,
		pickRespawnActive,
		togglePickSpawn,
		togglePickRespawn,
		resetSpawnToCamera,
		resetRespawnToCamera,
		characterHalfHeight,
		applyTexture,
		removeTexture,
		updateTiling,
		updateTextureParams,
		updateCameraProperty,
		// Multi-scene / level
		scenes,
		activeSceneId,
		addScene,
		removeScene,
		renameScene,
		switchScene,
		// Lights
		addLight,
		updateLight,
		removeLight,
		// Prefabs
		saveAsPrefab,
	} = useGameEditor();

	const [activeTab, setActiveTab] = useState<EditorTab>("properties");
	const [scenesExpanded, setScenesExpanded] = useState(true);
	const [lightDropdownOpen, setLightDropdownOpen] = useState(false);
	const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
	const [sceneNameValue, setSceneNameValue] = useState("");
	const sceneNameInputRef = useRef<HTMLInputElement>(null);
	const progressBarRef = useRef<HTMLDivElement>(null);
	const [editingClip, setEditingClip] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const editInputRef = useRef<HTMLInputElement>(null);
	const [editingName, setEditingName] = useState(false);
	const [nameValue, setNameValue] = useState("");
	const nameInputRef = useRef<HTMLInputElement>(null);
	const [texturePickerOpen, setTexturePickerOpen] = useState(false);
	const [textureCategory, setTextureCategory] = useState<TextureCategory>("ground");
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [prefabDialogOpen, setPrefabDialogOpen] = useState(false);
	const [prefabNameValue, setPrefabNameValue] = useState("");

	// Close light dropdown on outside click
	useEffect(() => {
		if (!lightDropdownOpen) return;
		const handler = () => setLightDropdownOpen(false);
		const timer = setTimeout(() => document.addEventListener("click", handler), 0);
		return () => { clearTimeout(timer); document.removeEventListener("click", handler); };
	}, [lightDropdownOpen]);

	// Auto-switch to Properties tab when an object is selected
	useEffect(() => {
		if (selectedObject) {
			setActiveTab("properties");
		}
	}, [selectedObject?.uuid]);

	// Auto-fetch animation clips when an AnimatedCharacter is selected
	useEffect(() => {
		if (selectedObject?.userData?.vibexeType === "AnimatedCharacter" && selectedObject.uuid) {
			getAnimations(selectedObject.uuid);
			const name = selectedObject.name || "";
			const modelId = selectedObject?.userData?.__characterModel ||
				(name.startsWith("Character_") ? name.slice(10) : name);
			if (modelId) fetchAnimOverrides(modelId);
		}
	}, [selectedObject?.uuid, selectedObject?.userData?.vibexeType, selectedObject?.name, getAnimations, fetchAnimOverrides]);

	// Focus edit input when editing starts
	useEffect(() => {
		if (editingClip && editInputRef.current) {
			editInputRef.current.focus();
			editInputRef.current.select();
		}
	}, [editingClip]);

	// Helper: get display name for a clip (apply override)
	const getDisplayName = useCallback((originalName: string) => {
		return animClipOverrides[originalName] || originalName;
	}, [animClipOverrides]);

	const handleStartRename = useCallback((originalClip: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setEditingClip(originalClip);
		setEditValue(animClipOverrides[originalClip] || originalClip);
	}, [animClipOverrides]);

	const handleConfirmRename = useCallback(() => {
		if (editingClip && editValue.trim()) {
			renameAnimClip(editingClip, editValue.trim());
		}
		setEditingClip(null);
	}, [editingClip, editValue, renameAnimClip]);

	const handleCancelRename = useCallback(() => {
		setEditingClip(null);
	}, []);

	const handleTreeSelect = useCallback(
		(uuid: string) => {
			if (sceneTree && uuid === sceneTree.uuid) return;
			selectObjectByUuid(uuid);
		},
		[selectObjectByUuid, sceneTree],
	);

	const handleTreeDoubleClick = useCallback(
		(uuid: string) => {
			if (sceneTree && uuid === sceneTree.uuid) return;
			selectAndFocus(uuid);
		},
		[selectAndFocus, sceneTree],
	);

	const handleMultiSelect = useCallback(
		(uuid: string) => {
			if (sceneTree && uuid === sceneTree.uuid) return;
			toggleMultiSelect(uuid);
		},
		[toggleMultiSelect, sceneTree],
	);

	const handlePropertyChange = useCallback(
		(property: string, value: any) => {
			if (!selectedObject) return;
			updateProperty(selectedObject.uuid, property, value);
		},
		[selectedObject, updateProperty],
	);

	const handleDelete = useCallback(() => {
		if (!selectedObject) return;
		setDeleteDialogOpen(true);
	}, [selectedObject]);

	const handleConfirmDelete = useCallback(() => {
		if (selectedUuids.length > 1) {
			deleteSelected();
		} else if (selectedObject) {
			deleteObject(selectedObject.uuid);
		}
		setDeleteDialogOpen(false);
	}, [selectedObject, selectedUuids, deleteObject, deleteSelected]);

	// Name editing
	const handleStartNameEdit = useCallback(() => {
		if (!selectedObject) return;
		setEditingName(true);
		setNameValue(selectedObject.name || "");
	}, [selectedObject]);

	const handleConfirmNameEdit = useCallback(() => {
		if (selectedObject && nameValue.trim()) {
			renameObject(selectedObject.uuid, nameValue.trim());
		}
		setEditingName(false);
	}, [selectedObject, nameValue, renameObject]);

	useEffect(() => {
		if (editingName && nameInputRef.current) {
			nameInputRef.current.focus();
			nameInputRef.current.select();
		}
	}, [editingName]);

	useEffect(() => {
		setEditingName(false);
		setTexturePickerOpen(false);
	}, [selectedObject?.uuid]);

	const handleToggleVisibility = useCallback(
		(uuid: string) => {
			toggleVisibility(uuid);
		},
		[toggleVisibility],
	);

	const handleToggleLock = useCallback(
		(uuid: string) => {
			toggleLock(uuid);
		},
		[toggleLock],
	);

	const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		if (!selectedObject || !animClipDuration) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		seekAnimation(selectedObject.uuid, ratio * animClipDuration);
	}, [selectedObject, animClipDuration, seekAnimation]);

	const fmtTime = (s: number) => s.toFixed(1) + "s";

	// Tab definitions
	const tabs: { id: EditorTab; label: string; icon: typeof Layers }[] = [
		{ id: "assets", label: "Assets", icon: Box },
		{ id: "properties", label: "Properties", icon: Layers },
		{ id: "settings", label: "Settings", icon: Settings },
	];

	return (
		<div data-game-editor-panel className="absolute top-0 right-0 bottom-0 w-[260px] bg-[#0f0f1a]/95 backdrop-blur-xl border-l border-white/[0.08] flex flex-col z-30 overflow-hidden">
			{/* Scene Hierarchy */}
			<div className="flex-shrink-0 border-b border-white/[0.08]">
				<div className="flex items-center justify-between px-3 py-2">
					<span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
						Scene Hierarchy
					</span>
					{/* Add light dropdown */}
					<div className="relative">
						<button
							type="button"
							onClick={() => setLightDropdownOpen((v) => !v)}
							className="p-0.5 rounded hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors"
							title="Add light"
						>
							<Sun className="w-3 h-3" />
						</button>
						{lightDropdownOpen && (
							<div className="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-white/[0.12] rounded-lg shadow-xl z-50 min-w-[120px] py-1">
								<button
									type="button"
									onClick={() => { addLight("point"); setLightDropdownOpen(false); }}
									className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
								>
									<Sun className="w-3 h-3 text-amber-400" />
									Point Light
								</button>
								<button
									type="button"
									onClick={() => { addLight("spot"); setLightDropdownOpen(false); }}
									className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
								>
									<Lightbulb className="w-3 h-3 text-blue-400" />
									Spot Light
								</button>
							</div>
						)}
					</div>
				</div>
				{/* Hierarchy Search */}
				<div className="px-2 pb-1">
					<div className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] rounded">
						<Search className="w-3 h-3 text-white/20 flex-shrink-0" />
						<input
							type="text"
							value={hierarchySearch}
							onChange={(e) => setHierarchySearch(e.target.value)}
							placeholder="Filter hierarchy..."
							className="flex-1 bg-transparent text-[10px] text-white/70 placeholder:text-white/20 outline-none"
						/>
						{hierarchySearch && (
							<button type="button" onClick={() => setHierarchySearch("")} className="text-white/20 hover:text-white/50">
								<X className="w-2.5 h-2.5" />
							</button>
						)}
					</div>
				</div>
				<div className="max-h-[30vh] overflow-y-auto px-1 pb-2 scrollbar-thin">
					{sceneTree ? (
						<SceneTreeNode
							node={sceneTree}
							depth={0}
							selectedUuid={selectedObject?.uuid || null}
							selectedUuids={selectedUuids}
							onSelect={handleTreeSelect}
							onMultiSelect={handleMultiSelect}
							onDoubleClick={handleTreeDoubleClick}
							onToggleVisibility={handleToggleVisibility}
							onToggleLock={handleToggleLock}
							searchFilter={hierarchySearch ? hierarchySearch.toLowerCase() : undefined}
						/>
					) : (
						<div className="px-3 py-4 text-[11px] text-white/30 text-center">
							Loading scene...
						</div>
					)}
				</div>
			</div>

			{/* Scenes / Levels */}
			<div className="flex-shrink-0 border-b border-white/[0.08]">
				<div className="flex items-center justify-between px-3 py-1.5">
					<button
						type="button"
						onClick={() => setScenesExpanded((v) => !v)}
						className="flex items-center gap-1 text-[11px] font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
					>
						{scenesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
						Scenes
						<span className="text-[9px] font-normal text-white/20 ml-1">({scenes.length})</span>
					</button>
					<button
						type="button"
						onClick={() => addScene()}
						className="p-0.5 rounded hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors"
						title="Add new scene / level"
					>
						<Plus className="w-3 h-3" />
					</button>
				</div>
				{scenesExpanded && (
					<div className="px-1 pb-1.5 space-y-0.5 max-h-[15vh] overflow-y-auto scrollbar-thin">
						{scenes.map((scene) => {
							const isActive = scene.id === activeSceneId;
							const isEditing = editingSceneId === scene.id;
							return (
								<div
									key={scene.id}
									className={`group flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer transition-colors ${
										isActive
											? "bg-emerald-500/[0.12] text-emerald-300"
											: "text-white/50 hover:bg-white/[0.04] hover:text-white/70"
									}`}
									onClick={() => { if (!isEditing) switchScene(scene.id); }}
								>
									<span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-emerald-400" : "bg-white/15"}`} />
									{isEditing ? (
										<input
											ref={sceneNameInputRef}
											type="text"
											value={sceneNameValue}
											onChange={(e) => setSceneNameValue(e.target.value)}
											onBlur={() => {
												if (sceneNameValue.trim()) renameScene(scene.id, sceneNameValue.trim());
												setEditingSceneId(null);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													if (sceneNameValue.trim()) renameScene(scene.id, sceneNameValue.trim());
													setEditingSceneId(null);
												} else if (e.key === "Escape") {
													setEditingSceneId(null);
												}
											}}
											className="flex-1 bg-transparent text-[10px] text-white/80 outline-none border-b border-white/20 px-0.5"
											autoFocus
											onClick={(e) => e.stopPropagation()}
										/>
									) : (
										<span className="flex-1 truncate">{scene.name}</span>
									)}
									{scene.isDefault && (
										<span className="text-[8px] text-white/20 uppercase flex-shrink-0">default</span>
									)}
									{/* Rename button */}
									<button
										type="button"
										className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/[0.08] text-white/20 hover:text-white/50 transition-all"
										onClick={(e) => {
											e.stopPropagation();
											setEditingSceneId(scene.id);
											setSceneNameValue(scene.name);
											setTimeout(() => sceneNameInputRef.current?.select(), 0);
										}}
										title="Rename scene"
									>
										<Pencil className="w-2.5 h-2.5" />
									</button>
									{/* Delete button — only if more than 1 scene */}
									{scenes.length > 1 && (
										<button
											type="button"
											className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all"
											onClick={(e) => {
												e.stopPropagation();
												removeScene(scene.id);
											}}
											title="Delete scene"
										>
											<Trash2 className="w-2.5 h-2.5" />
										</button>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Tab Bar */}
			<div className="flex-shrink-0 flex border-b border-white/[0.08]">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors ${
								isActive
									? "text-white/80 border-b-2 border-violet-400 bg-white/[0.04]"
									: "text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
							}`}
						>
							<Icon className="w-3 h-3" />
							{tab.label}
						</button>
					);
				})}
			</div>

			{/* Tab Content */}
			{activeTab === "assets" && (
				<div className="flex-1 overflow-hidden flex flex-col min-h-0">
					<GameEditorAssetLibrary />
				</div>
			)}

			{activeTab === "properties" && (
				<div className="flex-1 overflow-y-auto scrollbar-thin">
					{selectedObject?.userData?._isSyntheticCameraNode ? (
						/* ===== Camera-Specific Inspector ===== */
						<div className="p-3 space-y-3">
							{/* Header */}
							<div>
								<div className="flex items-center gap-1.5">
									<Camera className="w-3.5 h-3.5 text-blue-400" />
									<span className="text-[13px] font-medium text-white/90">Main Camera</span>
								</div>
								<div className="text-[10px] text-white/30">PerspectiveCamera</div>
							</div>

							{/* Position (read-only, updated by TC drag) */}
							<Section title="Position">
								<div className="flex gap-1.5">
									<DragNumberInput label="X" value={selectedObject.position.x} color="#e74c3c" onChange={() => {}} />
									<DragNumberInput label="Y" value={selectedObject.position.y} color="#2ecc71" onChange={() => {}} />
									<DragNumberInput label="Z" value={selectedObject.position.z} color="#3498db" onChange={() => {}} />
								</div>
								<div className="text-[9px] text-white/20 mt-0.5">Drag camera gizmo to move</div>
							</Section>

							{/* Camera Properties */}
							<Section title="Camera">
								<div className="space-y-1.5">
									<DragNumberInput
										label="FOV"
										value={gameSettings.camera?.fov ?? 60}
										step={1}
										precision={0}
										color="#f59e0b"
										onChange={(v) => updateCameraProperty("fov", Math.max(1, Math.min(179, v)))}
									/>
									<div className="flex gap-1.5">
										<DragNumberInput
											label="Near"
											value={gameSettings.camera?.near ?? 0.1}
											step={0.01}
											precision={2}
											color="#8b5cf6"
											onChange={(v) => updateCameraProperty("near", Math.max(0.01, Math.min(100, v)))}
										/>
										<DragNumberInput
											label="Far"
											value={gameSettings.camera?.far ?? 1000}
											step={10}
											precision={0}
											color="#8b5cf6"
											onChange={(v) => updateCameraProperty("far", Math.max(10, Math.min(10000, v)))}
										/>
									</div>
								</div>
							</Section>

							{/* Follow Camera Offsets */}
							<Section title="Follow Camera">
								<div className="space-y-1.5">
									<DragNumberInput
										label="Offset Y"
										value={gameSettings.camera?.offsetY ?? 8}
										step={0.5}
										color="#2ecc71"
										labelClassName="w-12 text-left text-[9px]"
										onChange={(v) => updateCameraProperty("offsetY", v)}
									/>
									<DragNumberInput
										label="Offset Z"
										value={gameSettings.camera?.offsetZ ?? 12}
										step={0.5}
										color="#3498db"
										labelClassName="w-12 text-left text-[9px]"
										onChange={(v) => updateCameraProperty("offsetZ", v)}
									/>
									<DragNumberInput
										label="Look Y"
										value={gameSettings.camera?.lookY ?? 1}
										step={0.1}
										color="#e74c3c"
										labelClassName="w-12 text-left text-[9px]"
										onChange={(v) => updateCameraProperty("lookY", v)}
									/>
								</div>
							</Section>

							{/* Actions — Save & Apply + Focus */}
							<div className="space-y-1.5 mt-1">
								<button
									type="button"
									onClick={() => settingsProps?.onSave?.(gameSettings)}
									className="w-full flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
									title="Save camera settings to project"
								>
									<Check className="w-3 h-3" />
									Save &amp; Apply
								</button>
								<button
									type="button"
									onClick={focusSelected}
									className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] text-white/50 bg-white/[0.04] hover:bg-white/[0.08] rounded transition-colors"
									title="Focus camera (F)"
								>
									<Focus className="w-3 h-3" />
									Focus
								</button>
							</div>
						</div>
					) : selectedObject ? (
						<div className="p-3 space-y-3">
							{/* Header — editable name */}
							<div>
								{editingName ? (
									<div className="flex items-center gap-1">
										<input
											ref={nameInputRef}
											type="text"
											value={nameValue}
											onChange={(e) => setNameValue(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") handleConfirmNameEdit();
												if (e.key === "Escape") setEditingName(false);
											}}
											onBlur={handleConfirmNameEdit}
											className="flex-1 min-w-0 px-1.5 py-0.5 text-[13px] font-medium bg-white/[0.1] border border-white/20 rounded text-white/90 outline-none focus:border-violet-400"
										/>
									</div>
								) : (
									<div
										className="group/name flex items-center gap-1 cursor-pointer"
										onClick={handleStartNameEdit}
										title="Click to rename"
									>
										<div className="text-[13px] font-medium text-white/90 truncate flex-1">
											{selectedObject.name}
										</div>
										<Pencil className="w-2.5 h-2.5 text-white/0 group-hover/name:text-white/30 flex-shrink-0 transition-colors" />
									</div>
								)}
								<div className="text-[10px] text-white/30">
									{selectedObject.userData?.vibexeType || selectedObject.type}
								</div>
								{selectedObject.userData?.__editorLocked && (
									<div className="flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] text-amber-400">
										<Lock className="w-2.5 h-2.5" /> Object locked — transform disabled
									</div>
								)}
							</div>

							{/* Position */}
							<Section title="Position">
								<div className="flex gap-1.5">
									<DragNumberInput
										label="X"
										value={selectedObject.position.x}
										color="#e74c3c"
										onChange={(v) => handlePropertyChange("position.x", v)}
									/>
									<DragNumberInput
										label="Y"
										value={selectedObject.position.y}
										color="#2ecc71"
										onChange={(v) => handlePropertyChange("position.y", v)}
									/>
									<DragNumberInput
										label="Z"
										value={selectedObject.position.z}
										color="#3498db"
										onChange={(v) => handlePropertyChange("position.z", v)}
									/>
								</div>
							</Section>

							{/* Rotation */}
							<Section title="Rotation">
								<div className="flex gap-1.5">
									<DragNumberInput
										label="X"
										value={selectedObject.rotation.x}
										step={1}
										precision={1}
										color="#e74c3c"
										onChange={(v) => handlePropertyChange("rotation.x", v)}
									/>
									<DragNumberInput
										label="Y"
										value={selectedObject.rotation.y}
										step={1}
										precision={1}
										color="#2ecc71"
										onChange={(v) => handlePropertyChange("rotation.y", v)}
									/>
									<DragNumberInput
										label="Z"
										value={selectedObject.rotation.z}
										step={1}
										precision={1}
										color="#3498db"
										onChange={(v) => handlePropertyChange("rotation.z", v)}
									/>
								</div>
							</Section>

							{/* Scale */}
							<Section title="Scale">
								<div className="flex gap-1.5">
									<DragNumberInput
										label="X"
										value={selectedObject.scale.x}
										step={0.05}
										color="#e74c3c"
										onChange={(v) => handlePropertyChange("scale.x", v)}
									/>
									<DragNumberInput
										label="Y"
										value={selectedObject.scale.y}
										step={0.05}
										color="#2ecc71"
										onChange={(v) => handlePropertyChange("scale.y", v)}
									/>
									<DragNumberInput
										label="Z"
										value={selectedObject.scale.z}
										step={0.05}
										color="#3498db"
										onChange={(v) => handlePropertyChange("scale.z", v)}
									/>
								</div>
							</Section>

							{/* Reset Transform */}
							<button
								type="button"
								onClick={() => {
									handlePropertyChange("position.x", 0);
									handlePropertyChange("position.y", 0);
									handlePropertyChange("position.z", 0);
									handlePropertyChange("rotation.x", 0);
									handlePropertyChange("rotation.y", 0);
									handlePropertyChange("rotation.z", 0);
									handlePropertyChange("scale.x", 1);
									handlePropertyChange("scale.y", 1);
									handlePropertyChange("scale.z", 1);
								}}
								className="w-full text-[9px] text-white/30 hover:text-white/60 py-0.5 rounded hover:bg-white/[0.04] transition-colors"
							>
								Reset Transform
							</button>

							{/* Visibility */}
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() =>
										handlePropertyChange("visible", !selectedObject.visible)
									}
									className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors ${
										selectedObject.visible
											? "bg-white/[0.08] text-white/70"
											: "bg-white/[0.04] text-white/30"
									}`}
								>
									{selectedObject.visible ? (
										<Eye className="w-3 h-3" />
									) : (
										<EyeOff className="w-3 h-3" />
									)}
									Visible
								</button>
							</div>

							{/* Model info */}
							{selectedObject.userData?.vibexeFactory && (
								<div className="text-[10px] text-white/25 space-y-0.5">
									<div>Factory: {selectedObject.userData.vibexeFactory}</div>
									{selectedObject.userData.vibexeArgs?.variant && (
										<div>
											Model: {selectedObject.userData.vibexeArgs.variant}{" "}
											({selectedObject.userData.vibexeArgs.color || "default"})
										</div>
									)}
								</div>
							)}

							{/* Material / Texture — hide for lights (they don't have materials) */}
							{!selectedObject.type?.includes("Light") && <Section title="Material">
								{selectedObject._textureUrl ? (
									<div className="space-y-1.5">
										<div className="flex items-center gap-2">
											<img
												src={selectedObject._textureUrl}
												alt="texture"
												className="w-9 h-9 rounded-full border border-white/10 object-cover flex-shrink-0 shadow-[inset_0_0_6px_rgba(0,0,0,0.25)]"
											/>
											<div className="flex-1 min-w-0">
												<div className="text-[10px] text-white/60 truncate">
													{TEXTURE_CATALOG.find((t) => textureUrl(t.filename) === selectedObject._textureUrl)?.displayName || "Custom"}
												</div>
											</div>
											<button
												type="button"
												onClick={() => {
													removeTexture(selectedObject.uuid);
													setTexturePickerOpen(false);
												}}
												className="p-1 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
												title="Remove texture"
											>
												<X className="w-3 h-3" />
											</button>
										</div>
										{/* Tiling controls */}
										<div className="flex gap-1.5">
											<DragNumberInput
												label="Tile X"
												value={selectedObject._textureTileX ?? 1}
												step={0.5}
												precision={1}
												color="#8b5cf6"
												labelClassName="w-8 text-left text-[9px]"
												onChange={(v) => updateTextureParams(selectedObject.uuid, Math.max(0.1, v), selectedObject._textureTileY ?? 1, selectedObject._textureRotation ?? 0, selectedObject._textureOffsetX ?? 0, selectedObject._textureOffsetY ?? 0)}
											/>
											<DragNumberInput
												label="Tile Y"
												value={selectedObject._textureTileY ?? 1}
												step={0.5}
												precision={1}
												color="#8b5cf6"
												labelClassName="w-8 text-left text-[9px]"
												onChange={(v) => updateTextureParams(selectedObject.uuid, selectedObject._textureTileX ?? 1, Math.max(0.1, v), selectedObject._textureRotation ?? 0, selectedObject._textureOffsetX ?? 0, selectedObject._textureOffsetY ?? 0)}
											/>
										</div>
										{/* Rotation control */}
										<div className="flex gap-1.5">
											<DragNumberInput
												label="Rot"
												value={selectedObject._textureRotation ?? 0}
												step={5}
												precision={0}
												color="#f59e0b"
												labelClassName="w-6 text-left text-[9px]"
												onChange={(v) => updateTextureParams(selectedObject.uuid, selectedObject._textureTileX ?? 1, selectedObject._textureTileY ?? 1, Math.max(0, Math.min(360, v)), selectedObject._textureOffsetX ?? 0, selectedObject._textureOffsetY ?? 0)}
											/>
										</div>
										{/* Offset controls */}
										<div className="flex gap-1.5">
											<DragNumberInput
												label="Off X"
												value={selectedObject._textureOffsetX ?? 0}
												step={0.05}
												precision={2}
												color="#06b6d4"
												labelClassName="w-7 text-left text-[9px]"
												onChange={(v) => updateTextureParams(selectedObject.uuid, selectedObject._textureTileX ?? 1, selectedObject._textureTileY ?? 1, selectedObject._textureRotation ?? 0, v, selectedObject._textureOffsetY ?? 0)}
											/>
											<DragNumberInput
												label="Off Y"
												value={selectedObject._textureOffsetY ?? 0}
												step={0.05}
												precision={2}
												color="#06b6d4"
												labelClassName="w-7 text-left text-[9px]"
												onChange={(v) => updateTextureParams(selectedObject.uuid, selectedObject._textureTileX ?? 1, selectedObject._textureTileY ?? 1, selectedObject._textureRotation ?? 0, selectedObject._textureOffsetX ?? 0, v)}
											/>
										</div>
										<button
											type="button"
											onClick={() => setTexturePickerOpen(!texturePickerOpen)}
											className="w-full text-[10px] text-white/30 hover:text-white/50 py-0.5 transition-colors"
										>
											{texturePickerOpen ? "Close" : "Replace texture..."}
										</button>
									</div>
								) : (
									<button
										type="button"
										onClick={() => setTexturePickerOpen(!texturePickerOpen)}
										className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] text-violet-300/70 bg-violet-500/[0.08] hover:bg-violet-500/[0.15] rounded transition-colors"
									>
										<Paintbrush className="w-3 h-3" />
										Browse Textures
									</button>
								)}
								{texturePickerOpen && (
									<div className="mt-1.5 space-y-1">
										{/* Category tabs — scrollable */}
										<div className="flex gap-0.5 overflow-x-auto pb-1 scrollbar-none">
											{TEXTURE_CATEGORIES.map((cat) => (
												<button
													key={cat.id}
													type="button"
													onClick={() => setTextureCategory(cat.id)}
													className={`text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
														textureCategory === cat.id
															? "bg-violet-500/20 text-violet-300"
															: "text-neutral-400 hover:text-neutral-300 hover:bg-white/[0.04]"
													}`}
												>
													{cat.label}
												</button>
											))}
										</div>
										{/* Circle thumbnail grid — 5 columns */}
										<div className="grid grid-cols-5 gap-1 max-h-[240px] overflow-y-auto scrollbar-thin py-0.5">
											{TEXTURE_CATALOG.filter((t) => t.category === textureCategory).map((tex) => {
												const url = textureUrl(tex.filename);
												const isActive = selectedObject._textureUrl === url;
												return (
													<button
														key={tex.id}
														type="button"
														onClick={() => {
															applyTexture(selectedObject.uuid, url, tex.defaultTileX, tex.defaultTileY, tex.hasPBR);
															setTexturePickerOpen(false);
														}}
														className={`relative w-[42px] h-[42px] mx-auto rounded-full overflow-hidden transition-all shadow-[inset_0_0_6px_rgba(0,0,0,0.25)] ${
															isActive
																? "ring-2 ring-violet-400 ring-offset-1 ring-offset-[#0f0f1a]"
																: "ring-1 ring-white/10 hover:ring-violet-400/60"
														}`}
														title={tex.displayName}
													>
														<img
															src={url}
															alt={tex.displayName}
															className="w-full h-full object-cover"
															loading="lazy"
														/>
													</button>
												);
											})}
										</div>
									</div>
								)}
							</Section>}

							{/* Animation Player (for AnimatedCharacter) */}
							{animationClips.length > 0 && (
								<Section title="Animations">
									<div className="space-y-0.5 max-h-[180px] overflow-y-auto scrollbar-thin">
										{animationClips.map((clip) => {
											const isActive = currentAnimClip === clip;
											const dur = animClipDurations[clip];
											const displayName = getDisplayName(clip);
											const isEditing = editingClip === clip;
											const isRenamed = !!animClipOverrides[clip];

											if (isEditing) {
												return (
													<div key={clip} className="flex items-center gap-1 px-1.5 py-0.5">
														<input
															ref={editInputRef}
															type="text"
															value={editValue}
															onChange={(e) => setEditValue(e.target.value)}
															onKeyDown={(e) => {
																if (e.key === "Enter") handleConfirmRename();
																if (e.key === "Escape") handleCancelRename();
															}}
															className="flex-1 min-w-0 px-1.5 py-0.5 text-[10px] bg-white/[0.1] border border-white/20 rounded text-white/90 outline-none focus:border-emerald-500/50"
														/>
														<button
															type="button"
															onClick={handleConfirmRename}
															className="p-0.5 rounded text-emerald-400 hover:bg-emerald-500/20 transition-colors"
															title="Save"
														>
															<Check className="w-3 h-3" />
														</button>
														<button
															type="button"
															onClick={handleCancelRename}
															className="p-0.5 rounded text-white/30 hover:bg-white/[0.08] transition-colors"
															title="Cancel"
														>
															<X className="w-3 h-3" />
														</button>
													</div>
												);
											}

											return (
												<div key={clip} className="group/clip flex items-center">
													<button
														type="button"
														onClick={() => selectedObject && playAnimation(selectedObject.uuid, clip)}
														className={`flex-1 flex items-center gap-1.5 px-2 py-1 text-[10px] rounded-l transition-colors text-left ${
															isActive
																? "bg-emerald-500/20 text-emerald-400"
																: "text-white/50 hover:bg-white/[0.06] hover:text-white/70"
														}`}
													>
														{isActive ? (
															animPlaybackState === "paused" ? (
																<Pause className="w-2.5 h-2.5 flex-shrink-0 text-amber-400" />
															) : (
																<span className="relative flex h-2.5 w-2.5 flex-shrink-0">
																	<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
																	<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
																</span>
															)
														) : (
															<Play className="w-2.5 h-2.5 flex-shrink-0 opacity-0 group-hover/clip:opacity-100 transition-opacity" />
														)}
														<span className={`truncate flex-1 ${isRenamed ? "italic" : ""}`} title={isRenamed ? `Original: ${clip}` : undefined}>
															{displayName}
														</span>
														{dur != null && (
															<span className="text-[9px] text-white/25 flex-shrink-0 tabular-nums">{dur.toFixed(1)}s</span>
														)}
													</button>
													<button
														type="button"
														onClick={(e) => handleStartRename(clip, e)}
														className="p-1 rounded-r text-white/0 group-hover/clip:text-white/30 hover:!text-white/60 hover:bg-white/[0.06] transition-colors"
														title="Rename clip"
													>
														<Pencil className="w-2.5 h-2.5" />
													</button>
												</div>
											);
										})}
									</div>

									{/* Transport controls */}
									{currentAnimClip && animPlaybackState !== "stopped" && selectedObject && (
										<div className="mt-1.5 space-y-1">
											<div className="flex items-center gap-1">
												{animPlaybackState === "playing" ? (
													<button
														type="button"
														onClick={() => pauseAnimation(selectedObject.uuid)}
														className="p-1 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors"
														title="Pause"
													>
														<Pause className="w-3 h-3" />
													</button>
												) : (
													<button
														type="button"
														onClick={() => resumeAnimation(selectedObject.uuid)}
														className="p-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
														title="Resume"
													>
														<Play className="w-3 h-3" />
													</button>
												)}
												<button
													type="button"
													onClick={() => stopAnimation(selectedObject.uuid)}
													className="p-1 rounded bg-white/[0.06] text-white/40 hover:bg-white/[0.12] hover:text-white/60 transition-colors"
													title="Stop"
												>
													<Square className="w-3 h-3" />
												</button>
												<span className="ml-auto text-[9px] text-white/30 tabular-nums">
													{fmtTime(animCurrentTime)} / {fmtTime(animClipDuration)}
												</span>
											</div>
											{/* Progress bar */}
											<div
												ref={progressBarRef}
												onClick={handleSeek}
												className="h-1.5 bg-white/[0.08] rounded-full cursor-pointer overflow-hidden group"
												title="Click to seek"
											>
												<div
													className={`h-full rounded-full transition-[width] duration-100 ${
														animPlaybackState === "paused" ? "bg-amber-400/60" : "bg-emerald-400/60"
													}`}
													style={{ width: animClipDuration > 0 ? `${(animCurrentTime / animClipDuration) * 100}%` : "0%" }}
												/>
											</div>
										</div>
									)}
								</Section>
							)}

							{/* Light Properties */}
							{selectedObject._isEditorLight && (
								<Section title={`${selectedObject._lightType === "spot" ? "Spot" : selectedObject._lightType === "point" ? "Point" : selectedObject._lightType === "directional" ? "Directional" : "Hemisphere"} Light`}>
									<div className="space-y-1.5">
										{/* Color */}
										<div className="flex items-center gap-2">
											<span className="text-[9px] text-white/40 w-10">Color</span>
											<input
												type="color"
												value={selectedObject._lightColor || "#ffffff"}
												onChange={(e) => updateLight(selectedObject.name, { color: e.target.value })}
												className="w-6 h-6 rounded border border-white/[0.15] bg-transparent cursor-pointer"
											/>
											<span className="text-[9px] text-white/30 font-mono">{selectedObject._lightColor || "#ffffff"}</span>
										</div>
										{/* Intensity */}
										<DragNumberInput
											label="Intensity"
											value={selectedObject._lightIntensity ?? 1}
											step={0.1}
											precision={1}
											color="#f59e0b"
											labelClassName="w-14 text-left text-[9px]"
											onChange={(v) => updateLight(selectedObject.name, { intensity: Math.max(0, v) })}
										/>
										{/* Distance — only for point/spot lights */}
										{(selectedObject._lightType === "point" || selectedObject._lightType === "spot") && (
											<DragNumberInput
												label="Distance"
												value={selectedObject._lightDistance ?? 50}
												step={1}
												precision={0}
												color="#8b5cf6"
												labelClassName="w-14 text-left text-[9px]"
												onChange={(v) => updateLight(selectedObject.name, { distance: Math.max(0, v) })}
											/>
										)}
										{/* Decay — only for point/spot lights */}
										{(selectedObject._lightType === "point" || selectedObject._lightType === "spot") && (
											<DragNumberInput
												label="Decay"
												value={selectedObject._lightDecay ?? 2}
												step={0.1}
												precision={1}
												color="#06b6d4"
												labelClassName="w-14 text-left text-[9px]"
												onChange={(v) => updateLight(selectedObject.name, { decay: Math.max(0, v) })}
											/>
										)}
										{/* Spot light extras */}
										{selectedObject._lightType === "spot" && (
											<>
												<DragNumberInput
													label="Angle"
													value={((selectedObject._lightAngle ?? Math.PI / 6) * 180 / Math.PI)}
													step={1}
													precision={0}
													color="#e74c3c"
													labelClassName="w-14 text-left text-[9px]"
													onChange={(v) => updateLight(selectedObject.name, { angle: Math.max(1, Math.min(90, v)) * Math.PI / 180 })}
												/>
												<DragNumberInput
													label="Penumbra"
													value={selectedObject._lightPenumbra ?? 0.1}
													step={0.05}
													precision={2}
													color="#2ecc71"
													labelClassName="w-14 text-left text-[9px]"
													onChange={(v) => updateLight(selectedObject.name, { penumbra: Math.max(0, Math.min(1, v)) })}
												/>
											</>
										)}
									</div>
								</Section>
							)}

							{/* Color */}
							{selectedObject._materialColor && (
								<div className="flex items-center gap-2">
									<span className="text-[10px] text-white/30">Color</span>
									<span
										className="w-4 h-4 rounded border border-white/[0.15]"
										style={{ backgroundColor: selectedObject._materialColor }}
									/>
									<span className="text-[10px] text-white/40 font-mono">
										{selectedObject._materialColor}
									</span>
								</div>
							)}

							{/* Actions */}
							<div className="flex gap-1.5 mt-1">
								<button
									type="button"
									onClick={focusSelected}
									className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] text-white/50 bg-white/[0.04] hover:bg-white/[0.08] rounded transition-colors"
									title="Focus camera (F)"
								>
									<Focus className="w-3 h-3" />
									Focus
								</button>
								<button
									type="button"
									onClick={duplicateSelected}
									className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] text-white/50 bg-white/[0.04] hover:bg-white/[0.08] rounded transition-colors"
									title="Duplicate (Ctrl+D)"
								>
									<Copy className="w-3 h-3" />
									Duplicate
								</button>
							</div>

							{/* Save as Prefab */}
							{selectedObject && (selectedObject.userData?.vibexeType === "decoration" || selectedObject.userData?.vibexeType === "AnimatedCharacter" || selectedObject.userData?.__spawned) && (
								<button
									type="button"
									onClick={() => {
										setPrefabNameValue(selectedObject.name || "My Prefab");
										setPrefabDialogOpen(true);
									}}
									className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] text-white/50 bg-white/[0.04] hover:bg-blue-500/20 hover:text-blue-300 rounded transition-colors mt-1"
									title="Save as reusable prefab"
								>
									<Box className="w-3 h-3" />
									Save as Prefab
								</button>
							)}

							{/* Ungroup (only for Group objects) */}
							{selectedObject?.userData?.vibexeType === "Group" && (
								<button
									type="button"
									onClick={ungroupSelected}
									className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] text-white/50 bg-white/[0.04] hover:bg-white/[0.08] rounded transition-colors mt-1"
								>
									<Layers className="w-3 h-3" />
									Ungroup
								</button>
							)}

							{/* Delete */}
							<button
								type="button"
								onClick={handleDelete}
								className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] text-red-400 bg-red-500/[0.08] hover:bg-red-500/[0.15] rounded transition-colors mt-1"
							>
								<Trash2 className="w-3 h-3" />
								Delete Object
							</button>
						</div>
					) : selectedUuids.length > 1 ? (
						<div className="p-3 space-y-3">
							<div>
								<div className="text-[13px] font-medium text-white/90">{selectedUuids.length} objects selected</div>
								<div className="text-[10px] text-white/30">Shift+click to add/remove</div>
							</div>
							<div className="space-y-1">
								<button
									type="button"
									onClick={() => {
										for (const uuid of selectedUuids) toggleVisibility(uuid);
									}}
									className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
								>
									<Eye className="w-3 h-3" /> Toggle Visibility
								</button>
								<button
									type="button"
									onClick={() => {
										for (const uuid of selectedUuids) toggleLock(uuid);
									}}
									className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
								>
									<Lock className="w-3 h-3" /> Toggle Lock
								</button>
								<button
									type="button"
									onClick={groupSelected}
									className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
								>
									<Layers className="w-3 h-3" /> Group Objects
								</button>
								<button
									type="button"
									onClick={() => setDeleteDialogOpen(true)}
									className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
								>
									<Trash2 className="w-3 h-3" /> Delete {selectedUuids.length} Objects
								</button>
							</div>
						</div>
					) : (
						<div className="px-3 py-8 text-center">
							<div className="text-[11px] text-white/25">
								Click an object to inspect
							</div>
						</div>
					)}
				</div>
			)}

			{activeTab === "settings" && settingsProps && (
				<GameSettingsContent
					settings={gameSettings}
					onChange={updateGameSettings}
					onSave={settingsProps.onSave}
					pickSpawnActive={pickSpawnActive}
					pickRespawnActive={pickRespawnActive}
					onTogglePickSpawn={togglePickSpawn}
					onTogglePickRespawn={togglePickRespawn}
					onResetSpawnToCamera={resetSpawnToCamera}
					onResetRespawnToCamera={resetRespawnToCamera}
					characterHalfHeight={characterHalfHeight}
				/>
			)}
			{activeTab === "settings" && !settingsProps && (
				<div className="px-3 py-8 text-center">
					<div className="text-[11px] text-white/25">
						Settings not available
					</div>
				</div>
			)}
			{/* Delete confirmation dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent variant="destructive">
					<DialogHeader>
						<DialogTitle>{selectedUuids.length > 1 ? `Delete ${selectedUuids.length} Objects` : "Delete Object"}</DialogTitle>
						<DialogDescription>
							{selectedUuids.length > 1
								? `Are you sure you want to delete ${selectedUuids.length} objects? This action can be undone with Ctrl+Z.`
								: `Are you sure you want to delete "${selectedObject?.name || "Unnamed"}"? This action can be undone with Ctrl+Z.`}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<button
								type="button"
								className="px-3 py-1.5 text-xs rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
							>
								Cancel
							</button>
						</DialogClose>
						<button
							type="button"
							onClick={handleConfirmDelete}
							className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
						>
							Delete
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Save as Prefab dialog */}
			<Dialog open={prefabDialogOpen} onOpenChange={setPrefabDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save as Prefab</DialogTitle>
						<DialogDescription>
							Save this object as a reusable prefab. You can spawn copies from the Asset Library.
						</DialogDescription>
					</DialogHeader>
					<div className="py-2">
						<label className="text-[11px] text-white/50 block mb-1">Prefab Name</label>
						<input
							type="text"
							value={prefabNameValue}
							onChange={(e) => setPrefabNameValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && prefabNameValue.trim()) {
									saveAsPrefab(prefabNameValue.trim());
									setPrefabDialogOpen(false);
								}
							}}
							className="w-full px-2 py-1.5 text-xs bg-white/[0.06] border border-white/10 rounded text-white/90 focus:outline-none focus:border-blue-500/50"
							autoFocus
						/>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<button
								type="button"
								className="px-3 py-1.5 text-xs rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
							>
								Cancel
							</button>
						</DialogClose>
						<button
							type="button"
							disabled={!prefabNameValue.trim()}
							onClick={() => {
								saveAsPrefab(prefabNameValue.trim());
								setPrefabDialogOpen(false);
							}}
							className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40"
						>
							Save Prefab
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function Section({
	title,
	children,
}: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<div className="text-[10px] text-white/30 mb-1">{title}</div>
			{children}
		</div>
	);
}
