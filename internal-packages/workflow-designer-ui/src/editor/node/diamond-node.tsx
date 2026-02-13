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
	getHandleActiveBgClass,
	getHandleBorderClass,
	getIconClasses,
	getIconContainerClasses,
	useNodeVisualStyle,
} from "./node-visual-style";

const DIAMOND_CLIP = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";

export function DiamondXyFlowNode({ id, selected }: NodeProps) {
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
		<DiamondNode
			node={node as NodeLike}
			selected={selected}
			highlighted={highlighted}
			connectedInputIds={connectedInputIds as InputId[]}
			connectedOutputIds={connectedOutputIds as OutputId[]}
		/>
	);
}

export function DiamondNode({
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
	const style = useNodeVisualStyle(node);
	const { v } = style;
	const isInputConnected = connectedInputIds.length > 0;
	const isIf = node.content.type === "if";
	const isSwitch = node.content.type === "switch";

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

	// Switch node: get case count from content
	const switchCases = useMemo(() => {
		if (!isSwitch) return [];
		const content = node.content as any;
		const cases = content.cases ?? [];
		return cases.length > 0
			? cases.map((_: unknown, i: number) => `Case ${i}`)
			: ["Case 0", "Case 1"];
	}, [node.content, isSwitch]);

	return (
		<NodeShell
			node={node}
			selected={selected}
			highlighted={highlighted}
			preview={preview}
			style={style}
			shapeClasses="w-[120px] h-[120px] flex items-center justify-center"
			radiusClass="rounded-none"
			clipPath={DIAMOND_CLIP}
		>
			{/* Diamond-shaped visual background */}
			<div
				className="absolute inset-0 z-[-2]"
				style={{ clipPath: DIAMOND_CLIP, backgroundColor: "rgba(0,0,0,0.3)" }}
			/>

			{/* Icon centered in diamond */}
			<div
				className={clsx(
					"w-[40px] h-[40px] flex items-center justify-center shrink-0 rounded-[8px]",
					getIconContainerClasses(v),
				)}
			>
				<NodeIcon
					node={node}
					className={clsx("w-[22px] h-[22px]", getIconClasses(v))}
				/>
			</div>

			{/* Name below diamond (absolute) */}
			<div className="absolute -bottom-[20px] left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
				<span className="text-[10px] font-medium text-inverse/70">
					{defaultName(node)}
				</span>
			</div>

			{!preview && (
				<>
					{/* Input handle at left point */}
					<Handle
						type="target"
						position={Position.Left}
						className={clsx(
							"!absolute !w-[11px] !h-[11px] !rounded-full !left-0 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !border-[1.5px] !bg-background",
							getHandleBorderClass(v),
							isInputConnected && getHandleActiveBgClass(v),
						)}
					/>

					{/* If node: true/false output handles */}
					{isIf && (
						<>
							<Handle
								type="source"
								id="true"
								position={Position.Right}
								style={{ top: "35%" }}
								className={clsx(
									"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
									getHandleBorderClass(v),
								)}
							/>
							<span
								className="absolute text-[9px] font-medium text-emerald-400/80 pointer-events-none"
								style={{ right: "-36px", top: "calc(35% - 6px)" }}
							>
								true
							</span>
							<Handle
								type="source"
								id="false"
								position={Position.Right}
								style={{ top: "65%" }}
								className={clsx(
									"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
									getHandleBorderClass(v),
								)}
							/>
							<span
								className="absolute text-[9px] font-medium text-red-400/80 pointer-events-none"
								style={{ right: "-40px", top: "calc(65% - 6px)" }}
							>
								false
							</span>
						</>
					)}

					{/* Switch node: case output handles */}
					{isSwitch && (
						<>
							{switchCases.map((label: string, i: number) => {
								const total = switchCases.length;
								const topPercent = total <= 1 ? 50 : 25 + (i * 50) / (total - 1);
								return (
									<span key={label}>
										<Handle
											type="source"
											id={`case-${i}`}
											position={Position.Right}
											style={{ top: `${topPercent}%` }}
											className={clsx(
												"!absolute !w-[10px] !h-[10px] !rounded-full !right-0 !translate-x-1/2 !border-[1.5px] !bg-background",
												getHandleBorderClass(v),
											)}
										/>
										<span
											className="absolute text-[9px] text-inverse/50 pointer-events-none"
											style={{
												right: "-50px",
												top: `calc(${topPercent}% - 6px)`,
											}}
										>
											{label}
										</span>
									</span>
								);
							})}
						</>
					)}

					{/* Plus button */}
					<button
						type="button"
						onClick={handlePlusClick}
						className={clsx(
							"absolute -right-[36px] top-1/2 -translate-y-1/2",
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
