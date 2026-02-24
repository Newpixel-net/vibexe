import { defaultName } from "@vibexe-ai/node-registry";
import type {
	InputId,
	NodeId,
	NodeLike,
	OutputId,
} from "@vibexe-ai/protocol";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import clsx from "clsx/lite";
import { PlusIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useAppDesignerStore } from "../../app-designer";
import { NodeIcon } from "../../icons/node";
import { NodeGenerationStatusBadge } from "./node-generation-status-badge";
import {
	STAGE_NODE_BG_CLASS,
	STAGE_NODE_BORDER_CLASS,
	STAGE_NODE_HANDLE_BG_CLASS,
	useNodeGenerationStatus,
} from "./node-utils";

export function PillXyFlowNode({ id, selected }: NodeProps) {
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
		<PillNode
			node={node}
			selected={selected}
			highlighted={highlighted}
			connectedInputIds={connectedInputIds}
			connectedOutputIds={connectedOutputIds}
		/>
	);
}

export function PillNode({
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
	const {
		currentGeneration,
		stopCurrentGeneration,
		showCompleteLabel,
		showFailedLabel,
	} = useNodeGenerationStatus(node.id as NodeId);
	const isStartNodeConnectedToEndNode = useAppDesignerStore((s) =>
		s.isStartNodeConnectedToEndNode(),
	);

	const isAppEntryAnyOutputConnected = connectedOutputIds.length > 0;
	const endPrimaryInputId = node.inputs?.[0]?.id ?? "blank-handle";
	const isEndAnyInputConnected =
		(connectedInputIds?.length ?? 0) > 0 ||
		connectedInputIds?.some((id) => id === endPrimaryInputId);

	const isAppEntry = node.content.type === "appEntry";
	const isEnd = node.content.type === "end";
	const requiresSetup = !isStartNodeConnectedToEndNode;

	const stageBackgroundClass =
		(isAppEntry || isEnd) && !requiresSetup ? STAGE_NODE_BG_CLASS : undefined;

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
		<div
			data-type={node.type}
			data-content-type={node.content.type}
			data-selected={selected}
			data-highlighted={highlighted}
			data-preview={preview}
			data-current-generation-status={currentGeneration?.status}
			className={clsx(
				"group relative rounded-full",
				"flex items-center gap-[8px] px-[14px] py-[8px] rounded-full",
				"backdrop-blur-[4px]",
				selected || highlighted
					? "shadow-[0px_0px_24px_2px_rgba(0,_0,_0,_0.4)] shadow-trigger-node-1"
					: "shadow-[4px_4px_8px_4px_rgba(0,_0,_0,_0.5)]",
				preview && "opacity-50",
				stageBackgroundClass,
				!stageBackgroundClass && requiresSetup ? "opacity-80" : undefined,
				!stageBackgroundClass && !requiresSetup
					? "bg-trigger-node-1"
					: undefined,
			)}
			style={
				!requiresSetup && !preview
					? {
							filter:
								"drop-shadow(0 0 10px hsla(220, 15%, 50%, 0.2))",
						}
					: undefined
			}
		>
			<NodeGenerationStatusBadge
				node={node}
				currentGeneration={currentGeneration}
				showCompleteLabel={showCompleteLabel}
				showFailedLabel={showFailedLabel}
				onStopCurrentGeneration={stopCurrentGeneration}
			/>

			{selected && (
				<div
					className={clsx(
						"absolute inset-0 -z-10 pointer-events-none",
						"rounded-full",
						"shadow-[0_0_22px_4px_hsla(220,_15%,_50%,_0.7)]",
					)}
				/>
			)}
			<div
				className={clsx(
					"absolute z-0 inset-0 border-[2px] mask-fill",
					"rounded-full",
					"bg-gradient-to-br",
					requiresSetup
						? "border-black/60 border-dashed from-trigger-node-1/40 via-trigger-node-1/70 to-trigger-node-1"
						: "border-transparent from-inverse/80 via-inverse/30 to-inverse/60",
				)}
			/>
			{isAppEntry && (
				<Handle
					type="source"
					position={Position.Right}
					className={clsx(
						"!absolute !w-[16px] !h-[16px] !rounded-full !border-[1.5px] !right-[-0.5px] !top-1/2",
						"!overflow-visible group/handle",
						STAGE_NODE_BORDER_CLASS,
						isAppEntryAnyOutputConnected
							? `${STAGE_NODE_HANDLE_BG_CLASS} [box-shadow:0_0_0_1.5px_rgba(0,0,0,0.8)]`
							: "!bg-background",
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
			{isEnd && (
				<Handle
					type="target"
					position={Position.Left}
					className={clsx(
						"!absolute !w-[16px] !h-[16px] !rounded-full !border-[1.5px] !left-[-0.5px] !top-1/2",
						STAGE_NODE_BORDER_CLASS,
						isEndAnyInputConnected
							? `${STAGE_NODE_HANDLE_BG_CLASS} [box-shadow:0_0_0_1.5px_rgba(0,0,0,0.8)]`
							: "!bg-background",
					)}
				/>
			)}
			<div
				className={clsx(
					"w-[28px] h-[28px] flex items-center justify-center rounded-full bg-inverse shrink-0",
				)}
			>
				<NodeIcon
					node={node}
					className={clsx(
						"w-[14px] h-[14px] stroke-current fill-none text-gray-900",
					)}
				/>
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-[14px] font-medium text-inverse leading-none truncate">
					{defaultName(node)}
				</p>
			</div>
		</div>
	);
}
