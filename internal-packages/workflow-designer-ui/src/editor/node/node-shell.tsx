import { Node, type NodeId, type NodeLike, type OperationNode } from "@giselles-ai/protocol";
import { isVectorStoreNode, isTriggerNode } from "@giselles-ai/protocol";
import { useNodeGenerations } from "@giselles-ai/react";
import clsx from "clsx/lite";
import { type CSSProperties, type ReactNode, useCallback } from "react";
import { useAppDesignerStore, useWorkspaceActions } from "../../app-designer";
import { NodeGenerationStatusBadge } from "./node-generation-status-badge";
import { NodeHoverToolbar } from "./node-hover-toolbar";
import { nodeRequiresSetup, useNodeGenerationStatus } from "./node-utils";
import {
	type NodeVisualStyleResult,
	getBorderGradientClasses,
	getSelectionShadowClasses,
} from "./node-visual-style";
import { GitHubTriggerStatusBadge } from "./ui/github-trigger/status-badge";

interface NodeShellProps {
	node: NodeLike;
	selected?: boolean;
	highlighted?: boolean;
	preview?: boolean;
	style: NodeVisualStyleResult;
	/** Shape-specific outer classes: e.g. "rounded-[8px] w-[96px] h-[96px] flex items-center justify-center" */
	shapeClasses: string;
	/** Inner layer radius class: "rounded-[8px]" or "rounded-full" */
	radiusClass: string;
	/** Optional clip-path for non-rounded shapes */
	clipPath?: string;
	/** Optional additional inline styles (e.g. dynamic height) */
	additionalStyle?: CSSProperties;
	children: ReactNode;
}

/** Hook to provide single-node execution from the hover toolbar */
function useNodeExecute(node: NodeLike, preview?: boolean) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const connections = useAppDesignerStore((s) => s.connections);
	const nodes = useAppDesignerStore((s) => s.nodes);
	const setUiNodeState = useWorkspaceActions((a) => a.setUiNodeState);

	const isOperation = node.type === "operation";
	const {
		createAndStartGenerationRunner,
		isGenerating,
		stopGenerationRunner,
	} = useNodeGenerations({
		nodeId: (isOperation ? node.id : "noop") as NodeId,
		origin: { type: "studio", workspaceId },
	});

	const onExecute = useCallback(() => {
		if (!isOperation || preview) return;
		if (isGenerating) {
			stopGenerationRunner();
			return;
		}
		setUiNodeState(node.id as NodeId, { showError: false });
		const incomingConnections = connections.filter(
			(c) => c.inputNode.id === node.id,
		);
		const sourceNodes = incomingConnections
			.map((c) => nodes.find((n) => n.id === c.outputNode.id))
			.filter((n): n is OperationNode => Node.safeParse(n).success);
		createAndStartGenerationRunner({
			origin: { type: "studio", workspaceId },
			operationNode: node as OperationNode,
			sourceNodes,
			connections: incomingConnections,
		});
	}, [isOperation, preview, isGenerating, stopGenerationRunner, setUiNodeState, node, connections, nodes, createAndStartGenerationRunner, workspaceId]);

	return isOperation && !preview ? onExecute : undefined;
}

export function NodeShell({
	node,
	selected,
	highlighted,
	preview,
	style,
	shapeClasses,
	radiusClass,
	clipPath,
	additionalStyle,
	children,
}: NodeShellProps) {
	const {
		v,
		requiresSetup,
		borderGradientStyle,
		backgroundGradientStyle,
		glowShadowStyle,
		integrationColorStyle,
	} = style;

	const {
		currentGeneration,
		stopCurrentGeneration,
		showCompleteLabel,
		showFailedLabel,
	} = useNodeGenerationStatus(node.id as NodeId);

	const onExecute = useNodeExecute(node, preview);

	const clipStyle: CSSProperties | undefined = clipPath
		? { clipPath }
		: undefined;

	return (
		<div
			data-type={node.type}
			data-content-type={node.content.type}
			data-selected={selected}
			data-highlighted={highlighted}
			data-preview={preview}
			data-current-generation-status={currentGeneration?.status}
			data-vector-store-source-provider={
				isVectorStoreNode(node) ? node.content.source.provider : undefined
			}
			style={{ ...integrationColorStyle, ...glowShadowStyle, ...additionalStyle }}
			className={clsx(
				"group relative",
				shapeClasses,
				"transition-all backdrop-blur-[4px] bg-transparent",
				getSelectionShadowClasses(selected, highlighted, v),
				preview && "opacity-50",
				requiresSetup && "opacity-80",
			)}
		>
			{!preview && <NodeHoverToolbar node={node as any} onExecute={onExecute} />}

			{/* Disabled overlay */}
			{(node as any).disabled && (
				<div
					className={clsx(
						"absolute inset-0 z-[5] bg-black/40 pointer-events-none flex items-center justify-center",
						radiusClass,
					)}
					style={clipStyle}
				>
					<span className="text-[11px] font-medium text-white/60 tracking-wide uppercase">
						Disabled
					</span>
				</div>
			)}

			<NodeGenerationStatusBadge
				node={node}
				currentGeneration={currentGeneration}
				showCompleteLabel={showCompleteLabel}
				showFailedLabel={showFailedLabel}
				onStopCurrentGeneration={stopCurrentGeneration}
			/>

			{/* Unconfigured node warning badge */}
			{requiresSetup && (
				<div className="absolute -top-2 -right-2 z-20 flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold shadow-lg animate-pulse">
					!
				</div>
			)}

			{/* Background gradient */}
			<div
				className={clsx("absolute z-[-1] inset-0", radiusClass)}
				style={
					clipStyle
						? { ...clipStyle, ...backgroundGradientStyle }
						: backgroundGradientStyle
				}
			/>

			{/* Border gradient */}
			<div
				className={clsx(
					"absolute z-0 inset-0 border-[2px] mask-fill",
					radiusClass,
					getBorderGradientClasses(
						v,
						!!borderGradientStyle,
						requiresSetup,
					),
				)}
				style={
					clipStyle
						? { ...clipStyle, ...borderGradientStyle }
						: borderGradientStyle
				}
			/>

			{/* GitHub trigger badge */}
			{isTriggerNode(node, "github") &&
				node.content.state.status === "configured" && (
					<div className="absolute top-[-20px] left-0 z-10">
						<GitHubTriggerStatusBadge
							triggerId={node.content.state.flowTriggerId}
						/>
					</div>
				)}

			{children}
		</div>
	);
}
