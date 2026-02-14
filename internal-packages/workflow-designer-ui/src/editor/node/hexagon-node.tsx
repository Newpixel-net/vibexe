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
import { useAppDesignerStore, useUpdateNodeData } from "../../app-designer";
import { NodeIcon } from "../../icons/node";
import { EditableText } from "../../ui/editable-text";
import { NodeShell } from "./node-shell";
import {
	getHandleActiveBgClass,
	getHandleBorderClass,
	getIconClasses,
	getIconContainerClasses,
	useNodeVisualStyle,
	useVariant,
} from "./node-visual-style";

const HEXAGON_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

/**
 * Hexagon-shaped node for Code nodes.
 * 96x96 with a hexagon clip-path.
 */
export function HexagonXyFlowNode({ id, selected }: NodeProps) {
	const { node, connections, highlighted } = useAppDesignerStore((s) => ({
		node: s.nodes.find((node) => node.id === id),
		connections: s.connections ?? [],
		highlighted: s.ui.nodeState[id as NodeId]?.highlighted,
	}));

	const connectedInputIds = useMemo(
		() =>
			connections
				.filter((connection) => connection.inputNode.id === id)
				.map((connection) => connection.inputId),
		[connections, id],
	);
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
		<HexagonNodeComponent
			node={node as NodeLike}
			selected={selected}
			highlighted={highlighted}
			connectedInputIds={connectedInputIds as InputId[]}
			connectedOutputIds={connectedOutputIds as OutputId[]}
		/>
	);
}

function HexagonNodeComponent({
	node,
	selected,
	highlighted,
	connectedInputIds,
	connectedOutputIds,
	preview = false,
}: {
	node: NodeLike;
	selected?: boolean;
	preview?: boolean;
	highlighted?: boolean;
	connectedInputIds?: InputId[];
	connectedOutputIds?: OutputId[];
}) {
	const updateNodeData = useUpdateNodeData();
	const style = useNodeVisualStyle(node);
	const { v, subtitleText } = style;
	const variant = useVariant(node);

	const isInputConnected = (connectedInputIds ?? []).length > 0;
	const isOutputConnected = (connectedOutputIds ?? []).length > 0;

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
			shapeClasses="w-[96px] h-[96px] flex items-center justify-center"
			radiusClass="rounded-none"
			clipPath={HEXAGON_CLIP}
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

			{/* Name + subtitle below node (outside) */}
			<div className="absolute top-full mt-[6px] left-1/2 -translate-x-1/2 w-[130px] text-center pointer-events-auto">
				<EditableText
					className="group-data-[selected=false]:pointer-events-none **:data-input:w-full **:text-center text-[11px] font-semibold"
					text={defaultName(node)}
					onValueChange={(value) => {
						if (value === defaultName(node)) {
							return;
						}
						if (value.trim().length === 0) {
							updateNodeData(node, { name: undefined });
							return;
						}
						updateNodeData(node, { name: value });
					}}
					onClickToEditMode={(e) => {
						if (!selected) {
							e.preventDefault();
							return;
						}
						e.stopPropagation();
					}}
				/>
				{subtitleText && (
					<div className="text-[9px] text-inverse/40 truncate mt-[1px]">
						{subtitleText}
					</div>
				)}
			</div>

			{/* Handles */}
			{!preview && (
				<>
					{/* Input handle */}
					<Handle
						type="target"
						position={Position.Left}
						className={clsx(
							"!absolute !w-[14px] !h-[14px] !rounded-full !left-0 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !border-[1.5px] !bg-background",
							getHandleBorderClass(variant),
							isInputConnected && getHandleActiveBgClass(variant),
						)}
					/>

					{/* Output handle */}
					<Handle
						type="source"
						position={Position.Right}
						className={clsx(
							"!absolute !w-[14px] !h-[14px] !rounded-full !right-0 !top-1/2 !translate-x-1/2 !-translate-y-1/2 !border-[1.5px] !bg-background",
							getHandleBorderClass(variant),
							isOutputConnected && getHandleActiveBgClass(variant),
						)}
					/>

					{/* Plus button */}
					<button
						type="button"
						onClick={handlePlusClick}
						className={clsx(
							"absolute -right-[28px] top-1/2 -translate-y-1/2",
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
