"use client";

/**
 * Visual Edit Toolbar
 *
 * Floating toolbar that appears when an element is selected in Visual Edit mode.
 * Contains 10 action buttons matching Base44's design.
 * Positioned near the selected element, above or below based on viewport space.
 */

import {
	ALargeSmall,
	CircleDot,
	Code2,
	FileCode,
	Paintbrush,
	Space,
	Sparkles,
	Square,
	Trash2,
	Type,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";
import {
	deleteElementFromSource,
	resolveElementSource,
} from "../lib/element-source-resolver";
import { useVisualEdit } from "../lib/visual-edit-context";
import type { RightPanelView } from "./right-panel-tabs";
import {
	ColorsPanel,
	CornerRadiusPanel,
	OpacityPanel,
	SpacingPanel,
	TailwindClassesPanel,
	TextContentPanel,
	TextStylePanel,
} from "./visual-edit-panels";

type PanelType =
	| "edit"
	| "text"
	| "style"
	| "colors"
	| "opacity"
	| "spacing"
	| "radius"
	| "tailwind"
	| null;

/** Container elements where text editing doesn't apply */
const CONTAINER_TAGS = new Set([
	"div",
	"section",
	"nav",
	"header",
	"footer",
	"main",
	"aside",
	"ul",
	"ol",
	"form",
	"article",
]);

interface VisualEditToolbarProps {
	/** Bounding rect of the Sandpack iframe relative to the viewport */
	iframeBounds: DOMRect | null;
	/** All project files (for source resolution) */
	files: AppFile[];
	/** Callback to update a file */
	onFileUpdate: (fileId: string, content: string) => void;
	/** Callback to switch view */
	onViewChange: (view: RightPanelView) => void;
	/** Callback to select a file in code view */
	onFileSelect: (fileId: string) => void;
}

export function VisualEditToolbar({
	iframeBounds,
	files,
	onFileUpdate,
	onViewChange,
	onFileSelect,
}: VisualEditToolbarProps) {
	const { selectedElement, deselectElement, sendVisualEditMessage, sendToIframe } =
		useVisualEdit();
	const [activePanel, setActivePanel] = useState<PanelType>(null);
	const [editPrompt, setEditPrompt] = useState("");
	const [confirmDelete, setConfirmDelete] = useState(false);
	const toolbarRef = useRef<HTMLDivElement>(null);

	// Reset panel when selection changes
	useEffect(() => {
		setActivePanel(null);
		setEditPrompt("");
		setConfirmDelete(false);
	}, [selectedElement]);

	const isContainer = useMemo(
		() =>
			selectedElement
				? CONTAINER_TAGS.has(selectedElement.tagName.toLowerCase())
				: false,
		[selectedElement],
	);

	// Calculate toolbar position
	const toolbarStyle = useMemo(() => {
		if (!selectedElement || !iframeBounds) return { display: "none" as const };

		const elRect = selectedElement.boundingRect;
		const absTop = iframeBounds.top + elRect.top;
		const absLeft = iframeBounds.left + elRect.left;
		const spaceAbove = absTop;
		const toolbarHeight = 48;

		let top: number;
		if (spaceAbove > toolbarHeight + 8) {
			top = absTop - toolbarHeight - 8;
		} else {
			top = absTop + elRect.height + 8;
		}

		let left = absLeft;
		// Clamp to right edge
		const toolbarWidth = 440;
		if (left + toolbarWidth > window.innerWidth - 16) {
			left = window.innerWidth - toolbarWidth - 16;
		}
		if (left < 8) left = 8;

		return {
			position: "fixed" as const,
			top: `${top}px`,
			left: `${left}px`,
			zIndex: 50,
		};
	}, [selectedElement, iframeBounds]);

	const handlePanelToggle = useCallback(
		(panel: PanelType) => {
			setActivePanel((prev) => (prev === panel ? null : panel));
			setConfirmDelete(false);
		},
		[],
	);

	// Edit Element — send AI prompt
	const handleEditSubmit = useCallback(() => {
		if (!editPrompt.trim() || !selectedElement) return;
		const msg = `[VISUAL EDIT] Element: <${selectedElement.tagName}> with classes "${selectedElement.className}"\nText content: "${selectedElement.textContent.slice(0, 100)}"\nUser request: ${editPrompt.trim()}`;
		sendVisualEditMessage(msg);
		setEditPrompt("");
		setActivePanel(null);
	}, [editPrompt, selectedElement, sendVisualEditMessage]);

	// View in Code
	const handleViewInCode = useCallback(() => {
		if (!selectedElement) return;
		const source = resolveElementSource(selectedElement, files);
		if (source) {
			onFileSelect(source.fileId);
			onViewChange("code");
		}
	}, [selectedElement, files, onFileSelect, onViewChange]);

	// Delete Element
	const handleDelete = useCallback(() => {
		if (!confirmDelete) {
			setConfirmDelete(true);
			return;
		}
		if (!selectedElement) return;
		const source = resolveElementSource(selectedElement, files);
		if (source) {
			const file = files.find((f) => f.id === source.fileId);
			if (file?.content) {
				const newContent = deleteElementFromSource(
					file.content,
					source.lineNumber,
					selectedElement.tagName,
				);
				onFileUpdate(source.fileId, newContent);
			}
		}
		deselectElement();
	}, [confirmDelete, selectedElement, files, onFileUpdate, deselectElement]);

	// Handle className updates from panels
	const handleClassNameUpdate = useCallback(
		(newClassName: string) => {
			if (!selectedElement) return;
			// Instant preview via iframe
			sendToIframe({
				type: "visual-edit-update-style",
				selector: selectedElement.selector,
				property: "className",
				value: newClassName,
			});
			// Update source file
			const source = resolveElementSource(selectedElement, files);
			if (source) {
				const file = files.find((f) => f.id === source.fileId);
				if (file?.content) {
					const lines = file.content.split("\n");
					const idx = source.lineNumber - 1;
					if (idx >= 0 && idx < lines.length) {
						// Replace className="old" with className="new"
						lines[idx] = lines[idx].replace(
							/className="[^"]*"/,
							`className="${newClassName}"`,
						);
						onFileUpdate(source.fileId, lines.join("\n"));
					}
				}
			}
		},
		[selectedElement, files, onFileUpdate, sendToIframe],
	);

	// Handle text content updates from text panel
	const handleTextUpdate = useCallback(
		(newText: string) => {
			if (!selectedElement) return;
			const source = resolveElementSource(selectedElement, files);
			if (source) {
				const file = files.find((f) => f.id === source.fileId);
				if (file?.content) {
					const oldText = selectedElement.textContent.trim();
					if (oldText) {
						const newContent = file.content.replace(oldText, newText);
						onFileUpdate(source.fileId, newContent);
					}
				}
			}
		},
		[selectedElement, files, onFileUpdate],
	);

	if (!selectedElement) return null;

	const buttons = [
		{
			id: "edit" as PanelType,
			icon: Sparkles,
			label: "Edit Element",
			show: true,
			color: "text-violet-400",
		},
		{
			id: "text" as PanelType,
			icon: Type,
			label: "Text",
			show: !isContainer,
			color: "text-blue-400",
		},
		{
			id: "style" as PanelType,
			icon: ALargeSmall,
			label: "Style",
			show: !isContainer,
			color: "text-cyan-400",
		},
		{
			id: "colors" as PanelType,
			icon: Paintbrush,
			label: "Colors",
			show: true,
			color: "text-pink-400",
		},
		{
			id: "opacity" as PanelType,
			icon: CircleDot,
			label: "Opacity",
			show: true,
			color: "text-amber-400",
		},
		{
			id: "spacing" as PanelType,
			icon: Space,
			label: "Spacing",
			show: true,
			color: "text-green-400",
		},
		{
			id: "radius" as PanelType,
			icon: Square,
			label: "Radius",
			show: true,
			color: "text-orange-400",
		},
		{
			id: "tailwind" as PanelType,
			icon: Code2,
			label: "Tailwind",
			show: true,
			color: "text-teal-400",
		},
	];

	return (
		<div ref={toolbarRef} style={toolbarStyle}>
			{/* Main toolbar */}
			<div className="flex items-center gap-0.5 p-1 rounded-xl bg-[#1a1a2e]/95 border border-white/[0.12] shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
				{buttons
					.filter((b) => b.show)
					.map((btn) => {
						const Icon = btn.icon;
						const isActive = activePanel === btn.id;
						return (
							<button
								key={btn.id}
								type="button"
								onClick={() => handlePanelToggle(btn.id)}
								className={`p-2 rounded-lg transition-all duration-150 ${
									isActive
										? "bg-white/[0.12] scale-105"
										: "hover:bg-white/[0.06]"
								}`}
								title={btn.label}
							>
								<Icon
									className={`w-4 h-4 ${isActive ? btn.color : "text-white/50 hover:text-white/80"}`}
								/>
							</button>
						);
					})}

				<div className="w-px h-5 bg-white/[0.08] mx-0.5" />

				{/* View in Code */}
				<button
					type="button"
					onClick={handleViewInCode}
					className="p-2 rounded-lg hover:bg-white/[0.06] transition-all"
					title="View in Code"
				>
					<FileCode className="w-4 h-4 text-white/50 hover:text-white/80" />
				</button>

				{/* Delete */}
				<button
					type="button"
					onClick={handleDelete}
					className={`p-2 rounded-lg transition-all ${
						confirmDelete
							? "bg-red-500/20 text-red-400"
							: "hover:bg-white/[0.06] text-white/50 hover:text-white/80"
					}`}
					title={confirmDelete ? "Click again to confirm delete" : "Delete Element"}
				>
					<Trash2 className="w-4 h-4" />
				</button>

				{/* Close */}
				<button
					type="button"
					onClick={deselectElement}
					className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-all"
					title="Deselect"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>

			{/* Sub-panels */}
			{activePanel === "edit" && (
				<div className="mt-2 p-3 rounded-xl bg-[#1a1a2e]/95 border border-white/[0.12] shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150 min-w-[300px]">
					<div className="flex gap-2">
						<input
							type="text"
							value={editPrompt}
							onChange={(e) => setEditPrompt(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleEditSubmit();
								if (e.key === "Escape") setActivePanel(null);
							}}
							placeholder="What do you want to change?"
							className="flex-1 px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.1] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
							autoFocus
						/>
						<button
							type="button"
							onClick={handleEditSubmit}
							disabled={!editPrompt.trim()}
							className="px-3 py-2 text-sm rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white disabled:opacity-30 transition-all"
						>
							<Sparkles className="w-4 h-4" />
						</button>
					</div>
				</div>
			)}

			{activePanel === "text" && selectedElement && (
				<TextContentPanel
					textContent={selectedElement.textContent}
					onUpdate={handleTextUpdate}
					onClose={() => setActivePanel(null)}
				/>
			)}

			{activePanel === "style" && selectedElement && (
				<TextStylePanel
					className={selectedElement.className}
					onUpdate={handleClassNameUpdate}
					onClose={() => setActivePanel(null)}
				/>
			)}

			{activePanel === "colors" && selectedElement && (
				<ColorsPanel
					className={selectedElement.className}
					onUpdate={handleClassNameUpdate}
					onClose={() => setActivePanel(null)}
				/>
			)}

			{activePanel === "opacity" && selectedElement && (
				<OpacityPanel
					className={selectedElement.className}
					onUpdate={handleClassNameUpdate}
					onClose={() => setActivePanel(null)}
				/>
			)}

			{activePanel === "spacing" && selectedElement && (
				<SpacingPanel
					className={selectedElement.className}
					onUpdate={handleClassNameUpdate}
					onClose={() => setActivePanel(null)}
				/>
			)}

			{activePanel === "radius" && selectedElement && (
				<CornerRadiusPanel
					className={selectedElement.className}
					onUpdate={handleClassNameUpdate}
					onClose={() => setActivePanel(null)}
				/>
			)}

			{activePanel === "tailwind" && selectedElement && (
				<TailwindClassesPanel
					className={selectedElement.className}
					onUpdate={handleClassNameUpdate}
					onClose={() => setActivePanel(null)}
				/>
			)}
		</div>
	);
}
