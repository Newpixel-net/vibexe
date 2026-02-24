import { createAppEntryNode } from "@vibexe-ai/node-registry";
import {
	isAppEntryNode,
	isEndNode,
	isOperationNode,
	type NodeLike,
	type OperationNode,
} from "@vibexe-ai/protocol";
import { useFeatureFlag } from "@vibexe-ai/react";
import { useKeyPress } from "@xyflow/react";
import { useCallback, useEffect, useRef } from "react";
import {
	useAppDesignerStore,
	useDeleteNodes,
	useUndoRedoActions,
	useUpdateNodeData,
	useWorkspaceActions,
} from "../../app-designer";
import { useNodeManipulation } from "../node";
import {
	addNodeTool,
	moveTool,
	selectContextTool,
	selectIntegrationTool,
	selectLanguageModelTool,
	selectLanguageModelV2Tool,
	useToolbar,
} from "../tool/toolbar";
import type { Tool } from "../tool/types";

type InputShortcutPolicy = "ignore" | "modifierOnly" | "always";

/** Check if focus is on a text-editable element (input, textarea, contenteditable). */
function isEditingText(): boolean {
	const el = document.activeElement;
	if (!el) return false;
	const tag = el.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	if ((el as HTMLElement).isContentEditable) return true;
	return false;
}

// Browser shortcuts that should be prevented when canvas is focused
const BROWSER_SHORTCUTS_TO_PREVENT = [
	{ key: "d", modifiers: ["meta", "ctrl"] }, // Bookmark
	{ key: "a", modifiers: ["meta", "ctrl"] }, // Select all (browser)
];

// Custom hook for handling key actions with repeat prevention
function useKeyAction(
	key: string | string[],
	action: () => void,
	enabled: boolean = false,
	options: {
		inputShortcutPolicy?: InputShortcutPolicy;
		preventDefault?: boolean;
	} = {
		inputShortcutPolicy: "ignore",
	},
) {
	const wasPressed = useRef(false);

	const useKeyPressOptions = {
		actInsideInputWithModifier: options.inputShortcutPolicy === "modifierOnly",
		preventDefault: options.preventDefault,
	};

	const isPressed = useKeyPress(key, useKeyPressOptions);

	useEffect(() => {
		if (isPressed && !wasPressed.current && enabled) {
			action();
		}
		wasPressed.current = isPressed;
	}, [isPressed, enabled, action]);
}

function useToolAction(key: string, toolFunction: () => Tool, enabled = true) {
	const toolbar = useToolbar();
	const currentShortcutScope = useAppDesignerStore(
		(s) => s.currentShortcutScope,
	);
	const isCanvasFocused = currentShortcutScope === "canvas";
	const canUseToolShortcuts = isCanvasFocused && !!toolbar && enabled;

	useKeyAction(
		key,
		() => toolbar?.setSelectedTool(toolFunction()),
		canUseToolShortcuts,
	);
}

interface UseKeyboardShortcutsOptions {
	onGenerate?: () => void;
}

export function useKeyboardShortcuts(
	options: UseKeyboardShortcutsOptions = {},
) {
	const currentShortcutScope = useAppDesignerStore(
		(s) => s.currentShortcutScope,
	);
	const nodes = useAppDesignerStore((s) => s.nodes) as (NodeLike & { selected?: boolean })[];
	const { generateContentNode } = useFeatureFlag();
	const {
		copy: handleCopy,
		paste: handlePaste,
		duplicate: handleDuplicate,
	} = useNodeManipulation();
	const { undo, redo } = useUndoRedoActions((s) => ({
		undo: s.undo,
		redo: s.redo,
	}));
	const deleteNodes = useDeleteNodes();
	const updateNodeData = useUpdateNodeData();
	const { setUiNodeState } = useWorkspaceActions((a) => ({
		setUiNodeState: a.setUiNodeState,
	}));
	const { onGenerate } = options;

	const isCanvasFocused = currentShortcutScope === "canvas";
	const isPropertiesPanelFocused = currentShortcutScope === "properties-panel";
	const isStageFlowAlreadyPlaced =
		nodes.some((node) => isAppEntryNode(node)) ||
		nodes.some((node) => isEndNode(node));

	// Tool shortcuts using the simplified hook
	useToolAction(
		"a",
		() => addNodeTool(createAppEntryNode()),
		!isStageFlowAlreadyPlaced,
	);
	useToolAction("i", selectIntegrationTool);
	useToolAction("c", selectContextTool);
	useToolAction("m", selectLanguageModelTool, !generateContentNode);
	useToolAction("m", selectLanguageModelV2Tool, generateContentNode);
	useToolAction("Escape", moveTool);

	// Generate shortcut for properties panel
	useKeyAction(
		["Meta+Enter", "Control+Enter"],
		() => onGenerate?.(),
		isPropertiesPanelFocused && !!onGenerate,
		{ inputShortcutPolicy: "modifierOnly" },
	);

	// Copy/Paste/Duplicate shortcuts
	useKeyAction(["Meta+c", "Control+c"], handleCopy, isCanvasFocused);
	useKeyAction(
		["Meta+v", "Control+v"],
		handlePaste,
		isCanvasFocused,
		{ preventDefault: false }, // Preserve browser paste events for FilePanel listeners
	);
	useKeyAction(["Meta+d", "Control+d"], handleDuplicate, isCanvasFocused);

	// Undo/Redo shortcuts
	useKeyAction(["Meta+z", "Control+z"], undo, isCanvasFocused, {
		inputShortcutPolicy: "modifierOnly",
		preventDefault: true,
	});
	useKeyAction(
		["Meta+Shift+z", "Control+Shift+z"],
		redo,
		isCanvasFocused,
		{ inputShortcutPolicy: "modifierOnly", preventDefault: true },
	);

	// Select All shortcut
	useKeyAction(
		["Meta+a", "Control+a"],
		useCallback(() => {
			for (const n of nodes) {
				setUiNodeState(n.id, { selected: true });
			}
		}, [nodes, setUiNodeState]),
		isCanvasFocused,
		{ preventDefault: true },
	);

	// D key — toggle disable on selected node (skip when editing text)
	useKeyAction(
		"d",
		useCallback(() => {
			if (isEditingText()) return;
			const selectedNode = nodes.find(
				(n) => n.selected && isOperationNode(n),
			);
			if (!selectedNode) return;
			const opNode = selectedNode as unknown as OperationNode;
			updateNodeData(opNode, {
				disabled: !(opNode.disabled ?? false),
			} as any);
		}, [nodes, updateNodeData]),
		isCanvasFocused,
	);

	// P key — toggle pin on selected node (skip when editing text)
	useKeyAction(
		"p",
		useCallback(() => {
			if (isEditingText()) return;
			const selectedNode = nodes.find(
				(n) => n.selected && isOperationNode(n),
			);
			if (!selectedNode) return;
			const opNode = selectedNode as unknown as OperationNode;
			if (opNode.pinnedData != null) {
				// Unpin
				updateNodeData(opNode, { pinnedData: undefined } as any);
			} else {
				// Pin — dispatch event to capture current output
				window.dispatchEvent(
					new CustomEvent("node-pin-data", {
						detail: { nodeId: selectedNode.id },
					}),
				);
			}
		}, [nodes, updateNodeData]),
		isCanvasFocused,
	);

	// F2 key — rename selected node
	useKeyAction(
		"F2",
		useCallback(() => {
			const selectedNode = nodes.find((n) => n.selected);
			if (!selectedNode) return;
			window.dispatchEvent(
				new CustomEvent("node-rename", {
					detail: { nodeId: selectedNode.id },
				}),
			);
		}, [nodes]),
		isCanvasFocused,
	);

	// Delete/Backspace — delete selected nodes (skip when editing text)
	useKeyAction(
		["Delete", "Backspace"],
		useCallback(() => {
			if (isEditingText()) return;
			const selectedNodeIds = nodes
				.filter((n) => n.selected)
				.map((n) => n.id);
			if (selectedNodeIds.length > 0) {
				deleteNodes(selectedNodeIds);
			}
		}, [nodes, deleteNodes]),
		isCanvasFocused,
	);

	// Shift+S — create sticky note at viewport center
	useKeyAction(
		"Shift+s",
		useCallback(() => {
			window.dispatchEvent(new CustomEvent("add-sticky-note"));
		}, []),
		isCanvasFocused,
	);

	// Enter — open properties panel of selected node
	useKeyAction(
		"Enter",
		useCallback(() => {
			const selectedNode = nodes.find((n) => n.selected);
			if (!selectedNode) return;
			window.dispatchEvent(
				new CustomEvent("open-properties", {
					detail: { nodeId: selectedNode.id },
				}),
			);
		}, [nodes]),
		isCanvasFocused,
	);

	// Ctrl+0 — fit to view
	useKeyAction(
		["Meta+0", "Control+0"],
		useCallback(() => {
			window.dispatchEvent(new CustomEvent("fit-view"));
		}, []),
		isCanvasFocused,
		{ inputShortcutPolicy: "modifierOnly", preventDefault: true },
	);

	// ? — show keyboard shortcuts overlay
	useKeyAction(
		"Shift+?",
		useCallback(() => {
			window.dispatchEvent(new CustomEvent("toggle-shortcuts-overlay"));
		}, []),
		isCanvasFocused,
	);

	// Return handler for preventing browser default shortcuts
	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (!isCanvasFocused) return;

			const shouldPrevent = BROWSER_SHORTCUTS_TO_PREVENT.some((shortcut) => {
				const keyMatches = event.key.toLowerCase() === shortcut.key;
				const modifierMatches = shortcut.modifiers.some((mod) => {
					if (mod === "meta") return event.metaKey;
					if (mod === "ctrl") return event.ctrlKey;
					return false;
				});
				return keyMatches && modifierMatches;
			});

			if (shouldPrevent) {
				event.preventDefault();
			}
		},
		[isCanvasFocused],
	);

	return {
		handleKeyDown,
	};
}
