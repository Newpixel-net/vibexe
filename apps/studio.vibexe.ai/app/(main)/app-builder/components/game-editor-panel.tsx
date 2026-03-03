"use client";

/**
 * GameEditorPanel — Scene hierarchy + Inspector panel.
 * Overlaid on the right side of the viewport when editor is active.
 */

import { Check, Copy, Eye, EyeOff, Focus, Package, Pause, Pencil, Play, Search, Square, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DragNumberInput } from "./drag-number-input";
import { SceneTreeNode } from "./scene-tree-node";
import { useGameEditor } from "../lib/game-editor-context";
import { GameEditorPalette } from "./game-editor-palette";

export function GameEditorPanel() {
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
		isPaletteOpen,
		togglePalette,
		renameObject,
		toggleVisibility,
		hierarchySearch,
		setHierarchySearch,
	} = useGameEditor();

	const progressBarRef = useRef<HTMLDivElement>(null);
	const [editingClip, setEditingClip] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const editInputRef = useRef<HTMLInputElement>(null);
	const [editingName, setEditingName] = useState(false);
	const [nameValue, setNameValue] = useState("");
	const nameInputRef = useRef<HTMLInputElement>(null);

	// Auto-fetch animation clips when an AnimatedCharacter is selected
	useEffect(() => {
		if (selectedObject?.userData?.vibexeType === "AnimatedCharacter" && selectedObject.uuid) {
			getAnimations(selectedObject.uuid);
			// Extract model ID from mesh name: "Character_Warrior_figure_Animations" → "Warrior_figure_Animations"
			const name = selectedObject.name || "";
			const modelId = name.startsWith("Character_") ? name.slice(10) : name;
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

	// Helper: get original clip name from what might be a display name
	const getOriginalName = useCallback((clipName: string) => {
		// animationClips always stores original names
		return clipName;
	}, []);

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
			// Never allow selecting the scene root — causes TransformControls infinite recursion
			if (sceneTree && uuid === sceneTree.uuid) return;
			selectObjectByUuid(uuid);
		},
		[selectObjectByUuid, sceneTree],
	);

	// Double-click in hierarchy = select + frame selected (Unity-style)
	const handleTreeDoubleClick = useCallback(
		(uuid: string) => {
			if (sceneTree && uuid === sceneTree.uuid) return;
			selectAndFocus(uuid);
		},
		[selectAndFocus, sceneTree],
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
		deleteObject(selectedObject.uuid);
	}, [selectedObject, deleteObject]);

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

	// Reset name editing when selection changes
	useEffect(() => {
		setEditingName(false);
	}, [selectedObject?.uuid]);

	// Hierarchy visibility toggle
	const handleToggleVisibility = useCallback(
		(uuid: string) => {
			toggleVisibility(uuid);
		},
		[toggleVisibility],
	);

	const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		if (!selectedObject || !animClipDuration) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		seekAnimation(selectedObject.uuid, ratio * animClipDuration);
	}, [selectedObject, animClipDuration, seekAnimation]);

	const fmtTime = (s: number) => s.toFixed(1) + "s";

	return (
		<div data-game-editor-panel className="absolute top-0 right-0 bottom-0 w-[260px] bg-[#0f0f1a]/95 backdrop-blur-xl border-l border-white/[0.08] flex flex-col z-30 overflow-hidden">
			{/* Scene Hierarchy */}
			<div className="flex-shrink-0 border-b border-white/[0.08]">
				<div className="flex items-center justify-between px-3 py-2">
					<span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
						Scene Hierarchy
					</span>
					<button
						type="button"
						onClick={togglePalette}
						className={`p-1 rounded transition-colors ${isPaletteOpen ? "bg-emerald-500/20 text-emerald-400" : "text-white/30 hover:text-white/60 hover:bg-white/[0.06]"}`}
						title="Object Palette"
					>
						<Package className="w-3.5 h-3.5" />
					</button>
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
				<div className="max-h-[40vh] overflow-y-auto px-1 pb-2 scrollbar-thin">
					{sceneTree ? (
						<SceneTreeNode
							node={sceneTree}
							depth={0}
							selectedUuid={selectedObject?.uuid || null}
							onSelect={handleTreeSelect}
							onDoubleClick={handleTreeDoubleClick}
							onToggleVisibility={handleToggleVisibility}
							searchFilter={hierarchySearch ? hierarchySearch.toLowerCase() : undefined}
						/>
					) : (
						<div className="px-3 py-4 text-[11px] text-white/30 text-center">
							Loading scene...
						</div>
					)}
				</div>
			</div>

			{/* Palette */}
			{isPaletteOpen && (
				<div className="flex-shrink-0 border-b border-white/[0.08]">
					<GameEditorPalette />
				</div>
			)}

			{/* Inspector */}
			<div className="flex-1 overflow-y-auto scrollbar-thin">
				{selectedObject ? (
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
						<Section title="Rotation °">
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

								{/* Transport controls — visible when a clip is active */}
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
				) : (
					<div className="px-3 py-8 text-center">
						<div className="text-[11px] text-white/25">
							Click an object to inspect
						</div>
					</div>
				)}
			</div>
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
