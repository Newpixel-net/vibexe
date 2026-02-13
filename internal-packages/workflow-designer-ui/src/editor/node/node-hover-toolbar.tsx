"use client";

import type { NodeId, OperationNode } from "@giselles-ai/protocol";
import { isOperationNode } from "@giselles-ai/protocol";
import clsx from "clsx/lite";
import {
	CopyIcon,
	EyeIcon,
	EyeOffIcon,
	PlayIcon,
	TrashIcon,
} from "lucide-react";
import { useCallback } from "react";
import {
	useDeleteNode,
	useUpdateNodeData,
} from "../../app-designer";
import { useNodeManipulation } from "./use-node-manipulation";

interface NodeHoverToolbarProps {
	node: { id: NodeId; type: string; content: { type: string }; disabled?: boolean };
	onExecute?: () => void;
}

export function NodeHoverToolbar({ node, onExecute }: NodeHoverToolbarProps) {
	const updateNodeData = useUpdateNodeData();
	const deleteNode = useDeleteNode();
	const { duplicate } = useNodeManipulation();

	const isDisabled = (node as OperationNode).disabled ?? false;

	const handleToggleDisabled = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (isOperationNode(node as any)) {
				updateNodeData(node as any, {
					disabled: !isDisabled,
				} as any);
			}
		},
		[node, isDisabled, updateNodeData],
	);

	const handleDuplicate = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			duplicate(node.id);
		},
		[node.id, duplicate],
	);

	const handleDelete = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			deleteNode({ nodeId: node.id });
		},
		[node.id, deleteNode],
	);

	const handleExecute = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			onExecute?.();
		},
		[onExecute],
	);

	const btnClass =
		"p-[5px] rounded-[4px] hover:bg-white/20 transition-colors cursor-pointer";

	return (
		<div
			className={clsx(
				"absolute -top-[38px] left-1/2 -translate-x-1/2 z-10",
				"flex items-center gap-[2px] px-[4px] py-[3px]",
				"rounded-[8px] bg-black/80 backdrop-blur-sm border border-white/10",
				"opacity-0 group-hover:opacity-100 transition-opacity duration-150",
				"pointer-events-none group-hover:pointer-events-auto",
			)}
		>
			{onExecute && (
				<button
					type="button"
					className={btnClass}
					onClick={handleExecute}
					title="Execute this node"
				>
					<PlayIcon className="w-[14px] h-[14px] text-green-400" />
				</button>
			)}
			<button
				type="button"
				className={btnClass}
				onClick={handleToggleDisabled}
				title={isDisabled ? "Enable node" : "Disable node"}
			>
				{isDisabled ? (
					<EyeIcon className="w-[14px] h-[14px] text-yellow-400" />
				) : (
					<EyeOffIcon className="w-[14px] h-[14px] text-white/70" />
				)}
			</button>
			<button
				type="button"
				className={btnClass}
				onClick={handleDuplicate}
				title="Duplicate node"
			>
				<CopyIcon className="w-[14px] h-[14px] text-white/70" />
			</button>
			<button
				type="button"
				className={btnClass}
				onClick={handleDelete}
				title="Delete node"
			>
				<TrashIcon className="w-[14px] h-[14px] text-red-400" />
			</button>
		</div>
	);
}
