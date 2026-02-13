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
	type VariantType,
	getHandleActiveBgClass,
	getHandleBorderClass,
	getIconClasses,
	getIconContainerClasses,
	useNodeVisualStyle,
	useVariant,
} from "./node-visual-style";
import { DataStoreNodeInfo, DocumentNodeInfo, GitHubNodeInfo } from "./ui";

export function CardXyFlowNode({ id, selected }: NodeProps) {
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
		<NodeComponent
			node={node as NodeLike}
			selected={selected}
			highlighted={highlighted}
			connectedInputIds={connectedInputIds as InputId[]}
			connectedOutputIds={connectedOutputIds as OutputId[]}
		/>
	);
}

export function NodeComponent({
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

	return (
		<NodeShell
			node={node}
			selected={selected}
			highlighted={highlighted}
			preview={preview}
			style={style}
			shapeClasses="rounded-[12px] flex flex-col items-center py-[14px] px-[10px] gap-[6px] w-[160px]"
			radiusClass="rounded-[12px]"
		>
			{/* Icon centered at top */}
			<div
				className={clsx(
					"w-[44px] h-[44px] flex items-center justify-center shrink-0 rounded-[12px]",
					getIconContainerClasses(v),
				)}
			>
				<NodeIcon
					node={node}
					className={clsx("w-[24px] h-[24px]", getIconClasses(v))}
				/>
			</div>
			{/* Name + subtitle centered below icon */}
			<div className="w-full text-center min-w-0">
				<EditableText
					className="group-data-[selected=false]:pointer-events-none **:data-input:w-full **:text-center text-[13px] font-semibold"
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
					<div className="text-[10px] text-inverse/50 truncate mt-[2px]">
						{subtitleText}
					</div>
				)}
			</div>
			<DataStoreNodeInfo node={node} />
			<DocumentNodeInfo node={node} />
			<GitHubNodeInfo node={node} />
			{!preview && (
				<InputOutput
					node={node}
					connectedInputIds={connectedInputIds}
					connectedOutputIds={connectedOutputIds}
				/>
			)}
			{/* Bottom handles for AI Agent sub-node connections */}
			{!preview && v.isAiAgent && (
				<BottomHandles nodeId={node.id} />
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

function InputOutput({
	node,
	connectedInputIds = [],
	connectedOutputIds = [],
}: {
	node: NodeLike;
	connectedInputIds?: InputId[];
	connectedOutputIds?: OutputId[];
}) {
	const v = useVariant(node);
	const isInputConnected = connectedInputIds?.length > 0;
	const isOutputConnected = connectedOutputIds?.length > 0;

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

	// Multi-port labeled handles for loop/merge/filter
	const isLoop = node.content.type === "loop";
	const isMerge = node.content.type === "merge";
	const isFilter = node.content.type === "filter";

	return (
		<>
			{/* Input handle(s) */}
			{node.type === "operation" &&
				node.content.type !== "trigger" &&
				node.content.type !== "appEntry" &&
				node.content.type !== "chatModel" &&
				node.content.type !== "toolNode" &&
				node.content.type !== "memoryNode" &&
				node.content.type !== "errorTrigger" &&
				node.content.type !== "formTrigger" && (
					<>
						{isMerge ? (
							<MergeInputHandles v={v} connectedInputIds={connectedInputIds} />
						) : (
							<Handle
								type="target"
								position={Position.Left}
								className={clsx(
									"!absolute !w-[11px] !h-[11px] !rounded-full !left-0 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !border-[1.5px] !bg-background",
									getHandleBorderClass(v),
									isInputConnected && getHandleActiveBgClass(v),
								)}
							/>
						)}
					</>
				)}

			{/* Output handle(s) */}
			{isLoop ? (
				<LoopOutputHandles v={v} />
			) : isFilter ? (
				<FilterOutputHandles v={v} />
			) : (
				<Handle
					type="source"
					position={Position.Right}
					className={clsx(
						"!absolute !w-[12px] !h-[12px] !rounded-full !right-0 !top-1/2 !translate-x-1/2 !-translate-y-1/2 !border-[1.5px]",
						"!bg-background",
						getHandleBorderClass(v),
						isOutputConnected && getHandleActiveBgClass(v),
					)}
				/>
			)}

			{/* Plus button */}
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
	);
}

/** Loop node: "done" and "loop" labeled output handles */
function LoopOutputHandles({ v }: { v: VariantType }) {
	return (
		<>
			<Handle
				type="source"
				id="done"
				position={Position.Right}
				style={{ top: "35%" }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
				)}
			/>
			<span className="absolute right-[-44px] text-[9px] text-inverse/50 pointer-events-none" style={{ top: "calc(35% - 5px)" }}>
				done
			</span>
			<Handle
				type="source"
				id="loop"
				position={Position.Right}
				style={{ top: "65%" }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
				)}
			/>
			<span className="absolute right-[-44px] text-[9px] text-inverse/50 pointer-events-none" style={{ top: "calc(65% - 5px)" }}>
				loop
			</span>
		</>
	);
}

/** Merge node: 2 labeled input handles */
function MergeInputHandles({ v, connectedInputIds }: { v: VariantType; connectedInputIds: InputId[] }) {
	return (
		<>
			<Handle
				type="target"
				id="input-1"
				position={Position.Left}
				style={{ top: "35%" }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !left-0 !-translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
					connectedInputIds.length > 0 && getHandleActiveBgClass(v),
				)}
			/>
			<span className="absolute left-[-52px] text-[9px] text-inverse/50 pointer-events-none" style={{ top: "calc(35% - 5px)" }}>
				Input 1
			</span>
			<Handle
				type="target"
				id="input-2"
				position={Position.Left}
				style={{ top: "65%" }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !left-0 !-translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
					connectedInputIds.length > 1 && getHandleActiveBgClass(v),
				)}
			/>
			<span className="absolute left-[-52px] text-[9px] text-inverse/50 pointer-events-none" style={{ top: "calc(65% - 5px)" }}>
				Input 2
			</span>
		</>
	);
}

/** Filter node: "kept" and "discarded" labeled output handles */
function FilterOutputHandles({ v }: { v: VariantType }) {
	return (
		<>
			<Handle
				type="source"
				id="kept"
				position={Position.Right}
				style={{ top: "35%" }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
				)}
			/>
			<span className="absolute right-[-44px] text-[9px] text-inverse/50 pointer-events-none" style={{ top: "calc(35% - 5px)" }}>
				kept
			</span>
			<Handle
				type="source"
				id="discarded"
				position={Position.Right}
				style={{ top: "65%" }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
				)}
			/>
			<span className="absolute right-[-62px] text-[9px] text-inverse/50 pointer-events-none" style={{ top: "calc(65% - 5px)" }}>
				discarded
			</span>
		</>
	);
}
