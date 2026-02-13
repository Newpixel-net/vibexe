import { PopoverContent } from "@giselle-internal/ui/popover";
import { useToasts } from "@giselle-internal/ui/toast";
import type { NodeId, OperationNode } from "@giselles-ai/protocol";
import { isOperationNode } from "@giselles-ai/protocol";
import clsx from "clsx/lite";
import {
	CheckSquareIcon,
	CopyIcon,
	EyeIcon,
	EyeOffIcon,
	LayoutGridIcon,
	MousePointerClickIcon,
	PencilIcon,
	PinIcon,
	PinOffIcon,
	PlayIcon,
	SquareIcon,
	TrashIcon,
} from "lucide-react";
import { useCallback } from "react";
import {
	useAppDesignerStore,
	useClearSelection,
	useDeleteNode,
	useUpdateNodeData,
} from "../../app-designer";
import { useNodeManipulation } from "../node";
import type { ContextMenuProps } from "./types";

function MenuSeparator() {
	return <div className="h-px bg-white/10 my-[4px]" />;
}

function MenuItem({
	label,
	shortcut,
	icon: Icon,
	onClick,
	destructive,
	disabled,
}: {
	label: string;
	shortcut?: string;
	icon?: React.ComponentType<{ className?: string }>;
	onClick: () => void;
	destructive?: boolean;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={clsx(
				"w-full flex items-center justify-between gap-[16px] px-[10px] py-[6px] rounded-[4px] text-[12px] transition-colors",
				disabled
					? "text-white/30 cursor-not-allowed"
					: destructive
						? "text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
						: "text-white/80 hover:bg-white/10 hover:text-white cursor-pointer",
			)}
		>
			<span className="flex items-center gap-[8px]">
				{Icon && (
					<Icon
						className={clsx(
							"w-[14px] h-[14px]",
							disabled
								? "text-white/20"
								: destructive
									? "text-red-400"
									: "text-white/50",
						)}
					/>
				)}
				{label}
			</span>
			{shortcut && (
				<span className="text-[10px] text-white/30 font-mono">
					{shortcut}
				</span>
			)}
		</button>
	);
}

export function ContextMenu({
	id,
	top,
	left,
	right,
	bottom,
	onClose,
	onExecute,
	onSelectAll,
	onFitView,
	onTidyUp,
}: ContextMenuProps) {
	const { duplicate: duplicateNode, copy: copyNode } = useNodeManipulation();
	const deleteNode = useDeleteNode();
	const updateNodeData = useUpdateNodeData();
	const clearSelection = useClearSelection();
	const toast = useToasts();

	const node = useAppDesignerStore((s) =>
		s.nodes.find((n) => n.id === id),
	);
	const isDisabled =
		node && isOperationNode(node as any)
			? (node as unknown as OperationNode).disabled ?? false
			: false;
	const isPinned =
		node && isOperationNode(node as any)
			? (node as unknown as OperationNode).pinnedData != null
			: false;

	const handleExecute = useCallback(() => {
		onExecute?.();
		onClose();
	}, [onExecute, onClose]);

	const handleRename = useCallback(() => {
		// Dispatch custom event to trigger inline rename on the node
		window.dispatchEvent(
			new CustomEvent("node-rename", { detail: { nodeId: id } }),
		);
		onClose();
	}, [id, onClose]);

	const handleToggleDisabled = useCallback(() => {
		if (node && isOperationNode(node as any)) {
			updateNodeData(node as any, { disabled: !isDisabled } as any);
		}
		onClose();
	}, [node, isDisabled, updateNodeData, onClose]);

	const handleTogglePin = useCallback(() => {
		if (node && isOperationNode(node as any)) {
			if (isPinned) {
				// Unpin — clear pinned data
				updateNodeData(node as any, { pinnedData: undefined } as any);
			} else {
				// Pin — dispatch event to capture current output as pinned data
				window.dispatchEvent(
					new CustomEvent("node-pin-data", { detail: { nodeId: id } }),
				);
			}
		}
		onClose();
	}, [node, isPinned, updateNodeData, id, onClose]);

	const handleCopy = useCallback(() => {
		copyNode();
		onClose();
	}, [copyNode, onClose]);

	const handleDuplicate = useCallback(() => {
		duplicateNode(id, () => toast.error("Failed to duplicate node"));
		onClose();
	}, [id, duplicateNode, toast, onClose]);

	const handleSelectAll = useCallback(() => {
		onSelectAll?.();
		onClose();
	}, [onSelectAll, onClose]);

	const handleClearSelection = useCallback(() => {
		clearSelection();
		onClose();
	}, [clearSelection, onClose]);

	const handleFitView = useCallback(() => {
		onFitView?.();
		onClose();
	}, [onFitView, onClose]);

	const handleTidyUp = useCallback(() => {
		onTidyUp?.();
		onClose();
	}, [onTidyUp, onClose]);

	const handleDelete = useCallback(() => {
		deleteNode(id);
		onClose();
	}, [id, deleteNode, onClose]);

	const isOperation = node && isOperationNode(node as any);

	return (
		<div
			style={{ top, left, right, bottom }}
			className="fixed z-[1000]"
			role="menu"
			aria-label="Node actions"
		>
			<PopoverContent className="min-w-[200px] p-[4px]">
				{/* Execute */}
				{isOperation && onExecute && (
					<>
						<MenuItem
							label="Execute Step"
							icon={PlayIcon}
							onClick={handleExecute}
						/>
						<MenuSeparator />
					</>
				)}

				{/* Edit actions */}
				<MenuItem
					label="Rename"
					shortcut="F2"
					icon={PencilIcon}
					onClick={handleRename}
				/>
				<MenuItem
					label={isDisabled ? "Enable" : "Disable"}
					shortcut="D"
					icon={isDisabled ? EyeIcon : EyeOffIcon}
					onClick={handleToggleDisabled}
					disabled={!isOperation}
				/>
				<MenuItem
					label={isPinned ? "Unpin Data" : "Pin Data"}
					shortcut="P"
					icon={isPinned ? PinOffIcon : PinIcon}
					onClick={handleTogglePin}
					disabled={!isOperation}
				/>
				<MenuSeparator />

				{/* Clipboard */}
				<MenuItem
					label="Copy"
					shortcut={navigator.platform.includes("Mac") ? "\u2318C" : "Ctrl+C"}
					icon={CopyIcon}
					onClick={handleCopy}
				/>
				<MenuItem
					label="Duplicate"
					shortcut={navigator.platform.includes("Mac") ? "\u2318D" : "Ctrl+D"}
					icon={CopyIcon}
					onClick={handleDuplicate}
				/>
				<MenuSeparator />

				{/* Selection */}
				<MenuItem
					label="Select All"
					shortcut={navigator.platform.includes("Mac") ? "\u2318A" : "Ctrl+A"}
					icon={CheckSquareIcon}
					onClick={handleSelectAll}
				/>
				<MenuItem
					label="Clear Selection"
					icon={SquareIcon}
					onClick={handleClearSelection}
				/>
				<MenuItem
					label="Fit View"
					icon={LayoutGridIcon}
					onClick={handleFitView}
				/>
				<MenuItem
					label="Tidy Up"
					icon={LayoutGridIcon}
					onClick={handleTidyUp}
				/>
				<MenuSeparator />

				{/* Destructive */}
				<MenuItem
					label="Delete"
					shortcut="Del"
					icon={TrashIcon}
					onClick={handleDelete}
					destructive
				/>
			</PopoverContent>
		</div>
	);
}

export { ContextMenu as NodeContextMenu };
