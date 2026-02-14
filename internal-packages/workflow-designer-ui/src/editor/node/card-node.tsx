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
					<div className="text-[10px] text-inverse/40 truncate mt-[1px]">
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

/**
 * Output handle with "+" icon inside the dot on hover.
 * Clicking "+" opens "What happens next?" panel.
 * Dragging from the dot still creates a wire (unchanged React Flow behavior).
 */
function OutputHandle({
	id,
	top,
	v,
	nodeId,
	label,
	color,
	showPlus = true,
	isConnected = false,
}: {
	id: string;
	top: string;
	v: VariantType;
	nodeId: string;
	label?: string;
	color?: string;
	showPlus?: boolean;
	isConnected?: boolean;
}) {
	const onPlusClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			window.dispatchEvent(
				new CustomEvent("what-happens-next", {
					detail: { sourceNodeId: nodeId, outputId: id },
				}),
			);
		},
		[nodeId, id],
	);

	return (
		<Handle
			type="source"
			id={id}
			position={Position.Right}
			style={{ top }}
			className={clsx(
				"!absolute !w-[16px] !h-[16px] !rounded-full !right-0 !border-[1.5px] !bg-background",
				"!overflow-visible group/handle",
				getHandleBorderClass(v),
				isConnected && getHandleActiveBgClass(v),
			)}
		>
			{/* "+" overlay centered inside the dot */}
			{showPlus && (
				<div
					role="button"
					tabIndex={-1}
					onClick={onPlusClick}
					onKeyDown={() => {}}
					className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/handle:opacity-100 transition-opacity duration-150 cursor-pointer z-10 pointer-events-auto"
				>
					<PlusIcon className="w-[10px] h-[10px] text-inverse/80" />
				</div>
			)}
			{/* Label floats to the right of the dot */}
			{label && (
				<span
					className={clsx(
						"absolute text-[12px] font-normal whitespace-nowrap pointer-events-none",
						color ?? "text-inverse/50",
					)}
					style={{ left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" }}
				>
					{label}
				</span>
			)}
		</Handle>
	);
}

/**
 * N8N-style unified input handle with label inside.
 * Label is positioned to the left of the handle dot.
 */
function InputHandle({
	id,
	top,
	v,
	label,
	isConnected = false,
}: {
	id: string;
	top: string;
	v: VariantType;
	label?: string;
	isConnected?: boolean;
}) {
	return (
		<Handle
			type="target"
			id={id}
			position={Position.Left}
			style={{ top }}
			className={clsx(
				"!absolute !w-[16px] !h-[16px] !rounded-full !left-0 !border-[1.5px] !bg-background",
				"!overflow-visible",
				getHandleBorderClass(v),
				isConnected && getHandleActiveBgClass(v),
			)}
		>
			{label && (
				<span
					className="absolute text-[12px] font-normal pointer-events-none whitespace-nowrap text-inverse/50"
					style={{ right: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" }}
				>
					{label}
				</span>
			)}
		</Handle>
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
	const isOutputConnected = connectedOutputIds.length > 0;
	const isInputConnected = connectedInputIds.length > 0;
	const isMultiOutput =
		contentType === "if" ||
		contentType === "switch" ||
		contentType === "loop" ||
		contentType === "filter";

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

	// In N8N, sub-nodes and triggers don't have "+" buttons
	const isSubNode =
		contentType === "chatModel" ||
		contentType === "toolNode" ||
		contentType === "memoryNode";
	const isTriggerType =
		contentType === "trigger" ||
		contentType === "errorTrigger" ||
		contentType === "formTrigger";
	const showPlusButton = !isSubNode && !isTriggerType;

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
							"!absolute !w-[16px] !h-[16px] !rounded-full !left-0 !top-1/2 !border-[1.5px] !bg-background",
							getHandleBorderClass(v),
							isInputConnected && getHandleActiveBgClass(v),
						)}
					/>
				)
			)}

			{/* Output handle(s) — unified: row content is INSIDE the Handle */}
			{contentType === "if" ? (
				<IfOutputHandles v={v} nodeId={node.id} />
			) : contentType === "switch" ? (
				<SwitchOutputHandles v={v} node={node} />
			) : contentType === "loop" ? (
				<LoopOutputHandles v={v} nodeId={node.id} />
			) : contentType === "filter" ? (
				<FilterOutputHandles v={v} nodeId={node.id} />
			) : (
				<OutputHandle
					id="output"
					top="50%"
					v={v}
					nodeId={node.id}
					showPlus={showPlusButton}
					isConnected={isOutputConnected}
				/>
			)}
		</>
	);
}

/** If node: true/false labeled output handles */
function IfOutputHandles({ v, nodeId }: { v: VariantType; nodeId: string }) {
	const positions = getHandlePositions(2);
	return (
		<>
			<OutputHandle id="true" top={`${positions[0]}%`} v={v} nodeId={nodeId} label="true" color="text-emerald-400" />
			<OutputHandle id="false" top={`${positions[1]}%`} v={v} nodeId={nodeId} label="false" color="text-red-400" />
		</>
	);
}

/** Switch node: dynamic output handles from rules + optional fallback */
function SwitchOutputHandles({ v, node }: { v: VariantType; node: NodeLike }) {
	const handles = useMemo(() => {
		const content = node.content as any;
		const rules: Array<{ name: string; outputPortName: string }> =
			content.rules ?? [];
		const hasFallback = content.hasFallback ?? true;
		const result: Array<{ id: string; label: string }> = [];

		if (rules.length > 0) {
			for (let i = 0; i < rules.length; i++) {
				result.push({
					id: rules[i].outputPortName,
					label: `${i}`,
				});
			}
		} else {
			// No rules yet — show 2 default case handles
			result.push({ id: "rule_0", label: "0" });
			result.push({ id: "rule_1", label: "1" });
		}

		if (hasFallback) {
			result.push({ id: "fallback", label: "fb" });
		}
		return result;
	}, [node.content]);

	const positions = getHandlePositions(handles.length);

	return (
		<>
			{handles.map((h, i) => (
				<OutputHandle
					key={h.id}
					id={h.id}
					top={`${positions[i]}%`}
					v={v}
					nodeId={node.id}
					label={h.label}
				/>
			))}
		</>
	);
}

/** Loop node: done/loop labeled output handles (N8N: "loop" has no "+") */
function LoopOutputHandles({ v, nodeId }: { v: VariantType; nodeId: string }) {
	const positions = getHandlePositions(2);
	return (
		<>
			<OutputHandle id="done" top={`${positions[0]}%`} v={v} nodeId={nodeId} label="done" />
			<OutputHandle id="loop" top={`${positions[1]}%`} v={v} nodeId={nodeId} label="loop" showPlus={false} />
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
			<InputHandle id="input-1" top={`${positions[0]}%`} v={v} label="Input 1" isConnected={connectedInputIds.length > 0} />
			<InputHandle id="input-2" top={`${positions[1]}%`} v={v} label="Input 2" isConnected={connectedInputIds.length > 1} />
		</>
	);
}

/** Filter node: kept/discarded labeled output handles */
function FilterOutputHandles({ v, nodeId }: { v: VariantType; nodeId: string }) {
	const positions = getHandlePositions(2);
	return (
		<>
			<OutputHandle id="kept" top={`${positions[0]}%`} v={v} nodeId={nodeId} label="kept" color="text-emerald-400" />
			<OutputHandle id="discarded" top={`${positions[1]}%`} v={v} nodeId={nodeId} label="discarded" color="text-red-400" />
		</>
	);
}
