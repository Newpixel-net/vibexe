import { Node, type NodeId, type NodeLike, type OperationNode } from "@vibexe-ai/protocol";
import { isVectorStoreNode, isTriggerNode } from "@vibexe-ai/protocol";
import { useNodeGenerations } from "@vibexe-ai/react";
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
				(node as any).disabled && "opacity-70",
				requiresSetup && "opacity-80",
			)}
		>
			{!preview && <NodeHoverToolbar node={node as any} onExecute={onExecute} />}

			{/* Pinned data badge */}
			{(node as any).pinnedData != null && (
				<div className="absolute -top-2 -left-2 z-20 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500 text-white shadow-lg" title="Data pinned">
					<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>
				</div>
			)}

			{/* Disabled overlay — diagonal stripe pattern matching N8N */}
			{(node as any).disabled && (
				<div
					className={clsx(
						"absolute inset-0 z-[5] pointer-events-none overflow-hidden",
						radiusClass,
					)}
					style={clipStyle}
				>
					<svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
						<defs>
							<pattern
								id={`disabled-stripe-${node.id}`}
								patternUnits="userSpaceOnUse"
								width="8"
								height="8"
								patternTransform="rotate(-45)"
							>
								<line x1="0" y1="0" x2="0" y2="8"
									stroke="rgba(0,0,0,0.35)" strokeWidth="4" />
							</pattern>
						</defs>
						<rect width="100%" height="100%" fill={`url(#disabled-stripe-${node.id})`} />
					</svg>
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
