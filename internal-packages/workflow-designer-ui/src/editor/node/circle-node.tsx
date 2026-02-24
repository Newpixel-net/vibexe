import { defaultName } from "@vibexe-ai/node-registry";
import type {
	NodeId,
	NodeLike,
	OutputId,
} from "@vibexe-ai/protocol";
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

/**
 * N8N-style trigger node: 96x96 "D-shape".
 * Left side is pill-rounded (36px), right side is standard (8px).
 * border-radius: 36px 8px 8px 36px
 * Icon centered, name below outside. Output handle on right only.
 */

const D_SHAPE_CLASSES = "rounded-tl-[36px] rounded-bl-[36px] rounded-tr-[8px] rounded-br-[8px]";

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
			shapeClasses={clsx("w-[96px] h-[96px] flex items-center justify-center", D_SHAPE_CLASSES)}
			radiusClass={D_SHAPE_CLASSES}
		>
			{/* Icon centered */}
			<div
				className={clsx(
					"w-[40px] h-[40px] flex items-center justify-center shrink-0 rounded-[10px]",
					getIconContainerClasses(v),
				)}
			>
				<NodeIcon
					node={node}
					className={clsx("w-[24px] h-[24px]", getIconClasses(v))}
				/>
			</div>

			{/* Name below node (outside) */}
			<div className="absolute top-full mt-[6px] left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
				<span className="text-[13px] font-semibold text-inverse/70">
					{defaultName(node)}
				</span>
			</div>

			{/* Output handle on right with "+" inside */}
			{!preview && (
				<Handle
					type="source"
					position={Position.Right}
					className={clsx(
						"!absolute !w-[16px] !h-[16px] !rounded-full !right-0 !top-1/2 !border-[1.5px] !bg-background",
						"!overflow-visible group/handle",
						getHandleBorderClass(v),
						isOutputConnected && getHandleActiveBgClass(v),
					)}
				>
					<div
						role="button"
						tabIndex={-1}
						onClick={handlePlusClick}
						onMouseDown={(e) => e.stopPropagation()}
						onKeyDown={() => {}}
						className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/handle:opacity-100 transition-opacity duration-150 cursor-pointer z-10 pointer-events-auto"
					>
						<PlusIcon className="w-[10px] h-[10px] text-inverse/80" />
					</div>
				</Handle>
			)}
		</NodeShell>
	);
}
