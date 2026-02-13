import type { NodeId, NodeLike } from "@giselles-ai/protocol";
import { isVectorStoreNode, isTriggerNode } from "@giselles-ai/protocol";
import clsx from "clsx/lite";
import type { CSSProperties, ReactNode } from "react";
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
	/** Shape-specific outer classes: e.g. "rounded-[12px] w-[160px] flex flex-col items-center py-[14px] px-[10px] gap-[6px]" */
	shapeClasses: string;
	/** Inner layer radius class: "rounded-[12px]" or "rounded-full" */
	radiusClass: string;
	/** Optional clip-path for non-rounded shapes (diamond) */
	clipPath?: string;
	children: ReactNode;
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
			style={{ ...integrationColorStyle, ...glowShadowStyle }}
			className={clsx(
				"group relative",
				shapeClasses,
				"transition-all backdrop-blur-[4px] bg-transparent",
				getSelectionShadowClasses(selected, highlighted, v),
				preview && "opacity-50",
				requiresSetup && "opacity-80",
			)}
		>
			{!preview && <NodeHoverToolbar node={node as any} />}

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
