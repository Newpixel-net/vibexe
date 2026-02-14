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
} from "./node-visual-style";

/**
 * N8N-style configurable node: 256x96 wide horizontal rectangle.
 * Used for AI Agent nodes that accept sub-node connections (chatModel, tool, memory).
 * Icon on the left, name + subtitle on the right.
 * Bottom handles for sub-node connections.
 */
export function WideXyFlowNode({ id, selected }: NodeProps) {
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
		<WideNode
			node={node as NodeLike}
			selected={selected}
			highlighted={highlighted}
			connectedInputIds={connectedInputIds as InputId[]}
			connectedOutputIds={connectedOutputIds as OutputId[]}
		/>
	);
}

export function WideNode({
	node,
	selected,
	highlighted,
	connectedInputIds = [],
	connectedOutputIds = [],
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
	const isInputConnected = connectedInputIds.length > 0;
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
			shapeClasses="rounded-[8px] w-[224px] h-[96px] flex items-center px-[14px] gap-[10px]"
			radiusClass="rounded-[8px]"
		>
			{/* Icon on left */}
			<div
				className={clsx(
					"w-[40px] h-[40px] flex items-center justify-center shrink-0 rounded-full",
					getIconContainerClasses(v),
				)}
			>
				<NodeIcon
					node={node}
					className={clsx("w-[24px] h-[24px]", getIconClasses(v))}
				/>
			</div>

			{/* Name + subtitle on right */}
			<div className="flex-1 min-w-0 text-left">
				<EditableText
					className="group-data-[selected=false]:pointer-events-none **:data-input:w-full text-[13px] font-semibold"
					text={defaultName(node)}
					onValueChange={(value) => {
						if (value === defaultName(node)) return;
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
					<div className="text-[10px] text-inverse/50 truncate mt-[1px]">
						{subtitleText}
					</div>
				)}
			</div>

			{!preview && (
				<>
					{/* Input handle on left */}
					<Handle
						type="target"
						position={Position.Left}
						className={clsx(
							"!absolute !w-[16px] !h-[16px] !rounded-full !left-0 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !border-[1.5px] !bg-background",
							getHandleBorderClass(v),
							isInputConnected && getHandleActiveBgClass(v),
						)}
					/>

					{/* Output handle on right with "+" inside */}
					<Handle
						type="source"
						position={Position.Right}
						className={clsx(
							"!absolute !w-[16px] !h-[16px] !rounded-full !right-0 !top-1/2 !translate-x-1/2 !-translate-y-1/2 !border-[1.5px] !bg-background",
							"!overflow-visible group/handle",
							getHandleBorderClass(v),
							isOutputConnected && getHandleActiveBgClass(v),
						)}
					>
						<div
							role="button"
							tabIndex={-1}
							onClick={handlePlusClick}
							onKeyDown={() => {}}
							className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/handle:opacity-100 transition-opacity duration-150 cursor-pointer z-10 pointer-events-auto"
						>
							<PlusIcon className="w-[10px] h-[10px] text-inverse/80" />
						</div>
					</Handle>

					{/* Bottom handles for sub-node connections */}
					<BottomHandles nodeId={node.id} />
				</>
			)}
		</NodeShell>
	);
}

/**
 * Bottom handles for AI Agent node - Chat Model*, Memory, Tool ports
 */
function BottomHandles({ nodeId }: { nodeId: NodeId }) {
	const connections = useAppDesignerStore((s) => s.connections ?? []);

	const hasChatModel = useMemo(
		() =>
			connections.some(
				(c) =>
					c.inputNode.id === nodeId &&
					c.connectionType === "subNode" &&
					c.outputNode.content.type === "chatModel",
			),
		[connections, nodeId],
	);

	const hasMemory = useMemo(
		() =>
			connections.some(
				(c) =>
					c.inputNode.id === nodeId &&
					c.connectionType === "subNode" &&
					c.outputNode.content.type === "memoryNode",
			),
		[connections, nodeId],
	);

	const toolCount = useMemo(
		() =>
			connections.filter(
				(c) =>
					c.inputNode.id === nodeId &&
					c.connectionType === "subNode" &&
					c.outputNode.content.type === "toolNode",
			).length,
		[connections, nodeId],
	);

	const handleSubNodeAdd = useCallback(
		(handleType: string) => (e: React.MouseEvent) => {
			e.stopPropagation();
			window.dispatchEvent(
				new CustomEvent("sub-node-add", {
					detail: { parentNodeId: nodeId, handleType },
				}),
			);
		},
		[nodeId],
	);

	return (
		<div className="absolute -bottom-[28px] left-0 right-0 flex justify-around items-start px-[10px]">
			{/* Chat Model handle */}
			<div className="flex flex-col items-center gap-[2px]">
				<Handle
					type="target"
					id={"chatModel" as string}
					position={Position.Bottom}
					style={{ position: "relative", transform: "none", left: 0, top: 0 }}
					className={clsx(
						"!w-[10px] !h-[10px] !rounded-full !border-[1.5px] !border-generation-node-1",
						hasChatModel ? "!bg-generation-node-1" : "!bg-background",
					)}
				/>
				{!hasChatModel && (
					<button
						type="button"
						onClick={handleSubNodeAdd("chatModel")}
						className="text-[8px] text-inverse/40 hover:text-inverse/80 cursor-pointer flex items-center gap-[1px]"
					>
						<PlusIcon className="w-[8px] h-[8px]" />
						<span>Model*</span>
					</button>
				)}
				{hasChatModel && (
					<span className="text-[8px] text-inverse/40">Model*</span>
				)}
			</div>
			{/* Memory handle */}
			<div className="flex flex-col items-center gap-[2px]">
				<Handle
					type="target"
					id={"memory" as string}
					position={Position.Bottom}
					style={{ position: "relative", transform: "none", left: 0, top: 0 }}
					className={clsx(
						"!w-[10px] !h-[10px] !rounded-full !border-[1.5px] !border-generation-node-1",
						hasMemory ? "!bg-generation-node-1" : "!bg-background",
					)}
				/>
				{!hasMemory && (
					<button
						type="button"
						onClick={handleSubNodeAdd("memoryNode")}
						className="text-[8px] text-inverse/40 hover:text-inverse/80 cursor-pointer flex items-center gap-[1px]"
					>
						<PlusIcon className="w-[8px] h-[8px]" />
						<span>Memory</span>
					</button>
				)}
				{hasMemory && (
					<span className="text-[8px] text-inverse/40">Memory</span>
				)}
			</div>
			{/* Tool handle */}
			<div className="flex flex-col items-center gap-[2px]">
				<Handle
					type="target"
					id={"tool" as string}
					position={Position.Bottom}
					style={{ position: "relative", transform: "none", left: 0, top: 0 }}
					className={clsx(
						"!w-[10px] !h-[10px] !rounded-full !border-[1.5px] !border-generation-node-1",
						toolCount > 0 ? "!bg-generation-node-1" : "!bg-background",
					)}
				/>
				<button
					type="button"
					onClick={handleSubNodeAdd("toolNode")}
					className="text-[8px] text-inverse/40 hover:text-inverse/80 cursor-pointer flex items-center gap-[1px]"
				>
					<PlusIcon className="w-[8px] h-[8px]" />
					<span>Tool{toolCount > 0 ? ` (${toolCount})` : ""}</span>
				</button>
			</div>
		</div>
	);
}
