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

/**
 * N8N-style default action node: 96x96 rounded square.
 * Icon centered, name + subtitle positioned below outside.
 * Height grows for multi-output nodes (switch with 3+ cases).
 */
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

/** Compute how many output handles a node needs */
function getOutputHandleCount(node: NodeLike): number {
	const type = node.content.type;
	if (type === "if") return 2;
	if (type === "switch") {
		const cases = (node.content as any).cases ?? [];
		return cases.length > 0 ? cases.length : 2;
	}
	if (type === "loop") return 2;
	if (type === "filter") return 2;
	return 1;
}

/** Compute how many input handles a node needs */
function getInputHandleCount(node: NodeLike): number {
	if (node.content.type === "merge") return 2;
	return 1;
}

/** Compute vertical positions (as percentages) for distributed handles */
function getHandlePositions(count: number): number[] {
	if (count <= 1) return [50];
	if (count === 2) return [35, 65];
	return Array.from({ length: count }, (_, i) =>
		25 + (i * 50) / (count - 1),
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

	// Compute dynamic height for multi-output nodes
	const outputCount = getOutputHandleCount(node);
	const inputCount = getInputHandleCount(node);
	const maxHandles = Math.max(outputCount, inputCount, 1);
	const nodeHeight = 96 + Math.max(0, maxHandles - 2) * 32;

	return (
		<NodeShell
			node={node}
			selected={selected}
			highlighted={highlighted}
			preview={preview}
			style={style}
			shapeClasses="rounded-[8px] w-[96px] flex items-center justify-center"
			radiusClass="rounded-[8px]"
			additionalStyle={{ height: `${nodeHeight}px` }}
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
				<NodeHandles
					node={node}
					connectedInputIds={connectedInputIds ?? []}
					connectedOutputIds={connectedOutputIds ?? []}
				/>
			)}
		</NodeShell>
	);
}

/** Per-output "+" button positioned next to a specific handle */
function HandlePlusButton({
	nodeId,
	outputId,
	top,
}: { nodeId: string; outputId: string; top: string }) {
	const onClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			window.dispatchEvent(
				new CustomEvent("what-happens-next", {
					detail: { sourceNodeId: nodeId, outputId },
				}),
			);
		},
		[nodeId, outputId],
	);

	return (
		<button
			type="button"
			onClick={onClick}
			className={clsx(
				"absolute -right-[28px]",
				"w-[16px] h-[16px] rounded-full",
				"flex items-center justify-center",
				"bg-inverse/10 backdrop-blur-sm border border-inverse/20",
				"text-inverse/60 hover:text-inverse hover:bg-inverse/20",
				"opacity-0 group-hover:opacity-100 transition-opacity duration-150",
				"cursor-pointer z-10",
			)}
			style={{ top }}
		>
			<PlusIcon className="w-[10px] h-[10px]" />
		</button>
	);
}

/** All handle rendering for card nodes (input, output, multi-port) */
function NodeHandles({
	node,
	connectedInputIds,
	connectedOutputIds,
}: {
	node: NodeLike;
	connectedInputIds: InputId[];
	connectedOutputIds: OutputId[];
}) {
	const v = useVariant(node);
	const contentType = node.content.type;
	const isInputConnected = connectedInputIds.length > 0;
	const isOutputConnected = connectedOutputIds.length > 0;
	const isMultiOutput =
		contentType === "if" ||
		contentType === "switch" ||
		contentType === "loop" ||
		contentType === "filter";

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

	// Determine if this node needs input handles
	const showInput =
		node.type === "operation" &&
		contentType !== "trigger" &&
		contentType !== "appEntry" &&
		contentType !== "chatModel" &&
		contentType !== "toolNode" &&
		contentType !== "memoryNode" &&
		contentType !== "errorTrigger" &&
		contentType !== "formTrigger";

	return (
		<>
			{/* Input handle(s) */}
			{showInput && (
				contentType === "merge" ? (
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
				)
			)}

			{/* Output handle(s) */}
			{contentType === "if" ? (
				<IfOutputHandles v={v} nodeId={node.id} />
			) : contentType === "switch" ? (
				<SwitchOutputHandles v={v} node={node} />
			) : contentType === "loop" ? (
				<LoopOutputHandles v={v} nodeId={node.id} />
			) : contentType === "filter" ? (
				<FilterOutputHandles v={v} nodeId={node.id} />
			) : (
				<Handle
					type="source"
					position={Position.Right}
					className={clsx(
						"!absolute !w-[12px] !h-[12px] !rounded-full !right-0 !top-1/2 !translate-x-1/2 !-translate-y-1/2 !border-[1.5px] !bg-background",
						getHandleBorderClass(v),
						isOutputConnected && getHandleActiveBgClass(v),
					)}
				/>
			)}

			{/* Single plus button for single-output nodes only */}
			{!isMultiOutput && (
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
			)}
		</>
	);
}

/** Handle label pill - dark background like N8N */
function HandleLabel({
	text,
	side,
	top,
	color,
}: {
	text: string;
	side: "left" | "right";
	top: string;
	color?: string;
}) {
	return (
		<span
			className={clsx(
				"absolute text-[9px] font-medium pointer-events-none",
				"px-[5px] py-[1px] rounded-[4px] bg-black/70 backdrop-blur-sm",
				color ?? "text-inverse/70",
			)}
			style={{
				[side]: side === "right" ? "-44px" : "-52px",
				top,
			}}
		>
			{text}
		</span>
	);
}

/** If node: true/false labeled output handles */
function IfOutputHandles({ v, nodeId }: { v: VariantType; nodeId: string }) {
	const positions = getHandlePositions(2);
	return (
		<>
			<Handle
				type="source"
				id="true"
				position={Position.Right}
				style={{ top: `${positions[0]}%` }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
				)}
			/>
			<HandleLabel
				text="true"
				side="right"
				top={`calc(${positions[0]}% - 7px)`}
				color="text-emerald-400"
			/>
			<HandlePlusButton nodeId={nodeId} outputId="true" top={`calc(${positions[0]}% - 8px)`} />
			<Handle
				type="source"
				id="false"
				position={Position.Right}
				style={{ top: `${positions[1]}%` }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
				)}
			/>
			<HandleLabel
				text="false"
				side="right"
				top={`calc(${positions[1]}% - 7px)`}
				color="text-red-400"
			/>
			<HandlePlusButton nodeId={nodeId} outputId="false" top={`calc(${positions[1]}% - 8px)`} />
		</>
	);
}

/** Switch node: dynamic case output handles */
function SwitchOutputHandles({ v, node }: { v: VariantType; node: NodeLike }) {
	const switchCases = useMemo(() => {
		const content = node.content as any;
		const cases = content.cases ?? [];
		return cases.length > 0
			? cases.map((_: unknown, i: number) => `Case ${i}`)
			: ["Case 0", "Case 1"];
	}, [node.content]);

	const positions = getHandlePositions(switchCases.length);

	return (
		<>
			{switchCases.map((label: string, i: number) => (
				<span key={label}>
					<Handle
						type="source"
						id={`case-${i}`}
						position={Position.Right}
						style={{ top: `${positions[i]}%` }}
						className={clsx(
							"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
							getHandleBorderClass(v),
						)}
					/>
					<HandleLabel
						text={label}
						side="right"
						top={`calc(${positions[i]}% - 7px)`}
					/>
					<HandlePlusButton nodeId={node.id} outputId={`case-${i}`} top={`calc(${positions[i]}% - 8px)`} />
				</span>
			))}
		</>
	);
}

/** Loop node: done/loop labeled output handles */
function LoopOutputHandles({ v, nodeId }: { v: VariantType; nodeId: string }) {
	const positions = getHandlePositions(2);
	return (
		<>
			<Handle
				type="source"
				id="done"
				position={Position.Right}
				style={{ top: `${positions[0]}%` }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
				)}
			/>
			<HandleLabel
				text="done"
				side="right"
				top={`calc(${positions[0]}% - 7px)`}
			/>
			<HandlePlusButton nodeId={nodeId} outputId="done" top={`calc(${positions[0]}% - 8px)`} />
			<Handle
				type="source"
				id="loop"
				position={Position.Right}
				style={{ top: `${positions[1]}%` }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
				)}
			/>
			<HandleLabel
				text="loop"
				side="right"
				top={`calc(${positions[1]}% - 7px)`}
			/>
			<HandlePlusButton nodeId={nodeId} outputId="loop" top={`calc(${positions[1]}% - 8px)`} />
		</>
	);
}

/** Merge node: 2 labeled input handles */
function MergeInputHandles({
	v,
	connectedInputIds,
}: { v: VariantType; connectedInputIds: InputId[] }) {
	const positions = getHandlePositions(2);
	return (
		<>
			<Handle
				type="target"
				id="input-1"
				position={Position.Left}
				style={{ top: `${positions[0]}%` }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !left-0 !-translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
					connectedInputIds.length > 0 && getHandleActiveBgClass(v),
				)}
			/>
			<HandleLabel
				text="Input 1"
				side="left"
				top={`calc(${positions[0]}% - 7px)`}
			/>
			<Handle
				type="target"
				id="input-2"
				position={Position.Left}
				style={{ top: `${positions[1]}%` }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !left-0 !-translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
					connectedInputIds.length > 1 && getHandleActiveBgClass(v),
				)}
			/>
			<HandleLabel
				text="Input 2"
				side="left"
				top={`calc(${positions[1]}% - 7px)`}
			/>
		</>
	);
}

/** Filter node: kept/discarded labeled output handles */
function FilterOutputHandles({ v, nodeId }: { v: VariantType; nodeId: string }) {
	const positions = getHandlePositions(2);
	return (
		<>
			<Handle
				type="source"
				id="kept"
				position={Position.Right}
				style={{ top: `${positions[0]}%` }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
				)}
			/>
			<HandleLabel
				text="kept"
				side="right"
				top={`calc(${positions[0]}% - 7px)`}
				color="text-emerald-400"
			/>
			<HandlePlusButton nodeId={nodeId} outputId="kept" top={`calc(${positions[0]}% - 8px)`} />
			<Handle
				type="source"
				id="discarded"
				position={Position.Right}
				style={{ top: `${positions[1]}%` }}
				className={clsx(
					"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
					getHandleBorderClass(v),
				)}
			/>
			<HandleLabel
				text="discarded"
				side="right"
				top={`calc(${positions[1]}% - 7px)`}
				color="text-red-400"
			/>
			<HandlePlusButton nodeId={nodeId} outputId="discarded" top={`calc(${positions[1]}% - 8px)`} />
		</>
	);
}
