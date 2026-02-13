import { defaultName } from "@giselles-ai/node-registry";
import type {
	NodeId,
	NodeLike,
	OutputId,
} from "@giselles-ai/protocol";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import clsx from "clsx/lite";
import { useMemo } from "react";
import { useAppDesignerStore } from "../../app-designer";
import { NodeIcon } from "../../icons/node";
import { NodeShell } from "./node-shell";
import {
	getIconClasses,
	getIconContainerClasses,
	useNodeVisualStyle,
} from "./node-visual-style";

function getCategoryLabel(contentType: string): string {
	switch (contentType) {
		case "chatModel":
			return "Model";
		case "toolNode":
			return "Tool";
		case "memoryNode":
			return "Memory";
		default:
			return "";
	}
}

export function SmallCircleXyFlowNode({ id, selected }: NodeProps) {
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
		<SmallCircleNode
			node={node as NodeLike}
			selected={selected}
			highlighted={highlighted}
			connectedOutputIds={connectedOutputIds as OutputId[]}
		/>
	);
}

export function SmallCircleNode({
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
	const categoryLabel = getCategoryLabel(node.content.type);

	return (
		<NodeShell
			node={node}
			selected={selected}
			highlighted={highlighted}
			preview={preview}
			style={style}
			shapeClasses="rounded-full w-[80px] h-[80px] flex items-center justify-center"
			radiusClass="rounded-full"
		>
			{/* Category label above */}
			{categoryLabel && (
				<div className="absolute -top-[18px] left-1/2 -translate-x-1/2 whitespace-nowrap">
					<span className="text-[9px] text-inverse/40 font-medium uppercase tracking-wider">
						{categoryLabel}
					</span>
				</div>
			)}

			{/* Icon centered */}
			<div
				className={clsx(
					"w-[36px] h-[36px] flex items-center justify-center shrink-0 rounded-full",
					getIconContainerClasses(v),
				)}
			>
				<NodeIcon
					node={node}
					className={clsx("w-[20px] h-[20px]", getIconClasses(v))}
				/>
			</div>

			{/* Name below circle (absolute) */}
			<div className="absolute -bottom-[18px] left-1/2 -translate-x-1/2 whitespace-nowrap">
				<span className="text-[9px] font-medium text-inverse/60">
					{defaultName(node)}
				</span>
			</div>

			{/* Source handle at top (connecting to parent AI Agent) */}
			{!preview && (
				<Handle
					type="source"
					position={Position.Top}
					className={clsx(
						"!absolute !w-[10px] !h-[10px] !rounded-full !top-0 !left-1/2 !-translate-x-1/2 !-translate-y-1/2 !border-[1.5px]",
						"!border-generation-node-1",
						isOutputConnected ? "!bg-generation-node-1" : "!bg-background",
					)}
				/>
			)}
		</NodeShell>
	);
}
