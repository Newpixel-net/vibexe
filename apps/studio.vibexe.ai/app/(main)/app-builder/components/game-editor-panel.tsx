"use client";

/**
 * GameEditorPanel — Scene hierarchy + Inspector panel.
 * Overlaid on the right side of the viewport when editor is active.
 */

import { Copy, Eye, EyeOff, Focus, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { DragNumberInput } from "./drag-number-input";
import { SceneTreeNode } from "./scene-tree-node";
import { useGameEditor } from "../lib/game-editor-context";

export function GameEditorPanel() {
	const {
		sceneTree,
		selectedObject,
		selectObjectByUuid,
		updateProperty,
		deleteObject,
		focusSelected,
		duplicateSelected,
	} = useGameEditor();

	const handleTreeSelect = useCallback(
		(uuid: string) => {
			selectObjectByUuid(uuid);
		},
		[selectObjectByUuid],
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

	return (
		<div data-game-editor-panel className="absolute top-0 right-0 bottom-0 w-[260px] bg-[#0f0f1a]/95 backdrop-blur-xl border-l border-white/[0.08] flex flex-col z-30 overflow-hidden">
			{/* Scene Hierarchy */}
			<div className="flex-shrink-0 border-b border-white/[0.08]">
				<div className="px-3 py-2 text-[11px] font-semibold text-white/40 uppercase tracking-wider">
					Scene Hierarchy
				</div>
				<div className="max-h-[40%] overflow-y-auto px-1 pb-2 scrollbar-thin">
					{sceneTree ? (
						<SceneTreeNode
							node={sceneTree}
							depth={0}
							selectedUuid={selectedObject?.uuid || null}
							onSelect={handleTreeSelect}
						/>
					) : (
						<div className="px-3 py-4 text-[11px] text-white/30 text-center">
							Loading scene...
						</div>
					)}
				</div>
			</div>

			{/* Inspector */}
			<div className="flex-1 overflow-y-auto scrollbar-thin">
				{selectedObject ? (
					<div className="p-3 space-y-3">
						{/* Header */}
						<div>
							<div className="text-[13px] font-medium text-white/90 truncate">
								{selectedObject.name}
							</div>
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
