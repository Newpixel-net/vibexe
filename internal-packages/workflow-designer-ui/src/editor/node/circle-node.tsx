import { defaultName } from "@giselles-ai/node-registry";
import type {
	InputId,
	NodeId,
	NodeLike,
	OutputId,
} from "@giselles-ai/protocol";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import clsx from "clsx/lite";
import { PlusIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useAppDesignerStore } from "../../app-designer";
import { NodeIcon } from "../../icons/node";
import { NodeShell } from "./node-shell";
import {
	getHandleBorderClass,
	getHandleActiveBgClass,
	getIconClasses,
	getIconContainerClasses,
	useNodeVisualStyle,
} from "./node-visual-style";

export function CircleXyFlowNode({ id, selected }: NodeProps) {
	const { node, connections, highlighted } = useAppDesignerStore((s) => ({
		node: s.nodes.find((node) => node.id === id),
		connections: s.connections ?? [],
		highlighted: s.ui.nodeState[id as NodeId]?.highlighted,
	}));

	const connectedOutputIds = useMemo(
		() =>
			connections
				.filter((connection) => connection.outputNode.id === id)
				.map((connection) => connection.outputId),
		[connections, id],
	);

	if (!node) {
		return null;
	}

	return (
		<CircleNode
			node={node as NodeLike}
			selected={selected}
			highlighted={highlighted}
			connectedOutputIds={connectedOutputIds as OutputId[]}
		/>
	);
}

export function CircleNode({
	node,
	selected,
	highlighted,
	connectedOutputIds = [],
	preview = false,
}: {
	node: NodeLike;
	selected?: boolean;
	preview?: boolean;
	highlighted?: boolean;
	connectedOutputIds?: OutputId[];
}) {
	const style = useNodeVisualStyle(node);
	const { v } = style;
	const isOutputConnected = connectedOutputIds.length > 0;

	const handlePlusClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			window.dispatchEvent(
				new CustomEvent("what-happens-next", {
					detail: { sourceNodeId: node.id },
				}),
			);
		},
		[node.id],
	);

	return (
		<NodeShell
			node={node}
			selected={selected}
			highlighted={highlighted}
			preview={preview}
			style={style}
			shapeClasses="rounded-full w-[100px] h-[100px] flex items-center justify-center"
			radiusClass="rounded-full"
		>
			{/* Icon centered */}
			<div
				className={clsx(
					"w-[48px] h-[48px] flex items-center justify-center shrink-0 rounded-full",
					getIconContainerClasses(v),
				)}
			>
				<NodeIcon
					node={node}
					className={clsx("w-[28px] h-[28px]", getIconClasses(v))}
				/>
			</div>

			{/* Name below circle (absolute) */}
			<div className="absolute -bottom-[20px] left-1/2 -translate-x-1/2 whitespace-nowrap">
				<span className="text-[10px] font-medium text-inverse/70">
					{defaultName(node)}
				</span>
			</div>

			{/* Output handle on right */}
			{!preview && (
				<>
					<Handle
						type="source"
						position={Position.Right}
						className={clsx(
							"!absolute !w-[12px] !h-[12px] !rounded-full !right-0 !top-1/2 !translate-x-1/2 !-translate-y-1/2 !border-[1.5px] !bg-background",
							getHandleBorderClass(v),
							isOutputConnected && getHandleActiveBgClass(v),
						)}
					/>
					<button
						type="button"
						onClick={handlePlusClick}
						className={clsx(
							"absolute -right-[32px] top-1/2 -translate-y-1/2",
							"w-[20px] h-[20px] rounded-full",
							"flex items-center justify-center",
							"bg-inverse/10 backdrop-blur-sm border border-inverse/20",
							"text-inverse/60 hover:text-inverse hover:bg-inverse/20",
							"opacity-0 group-hover:opacity-100 transition-opacity duration-150",
							"cursor-pointer z-10",
						)}
					>
						<PlusIcon className="w-[12px] h-[12px]" />
					</button>
				</>
			)}
		</NodeShell>
	);
}
