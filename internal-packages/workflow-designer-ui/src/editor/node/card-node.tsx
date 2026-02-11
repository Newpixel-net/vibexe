import {
	getCatalogEntry,
	getPieceCategoryColor,
} from "@giselles-ai/activepieces-adapter";
import { defaultName } from "@giselles-ai/node-registry";
import type {
	InputId,
	NodeId,
	NodeLike,
	OutputId,
} from "@giselles-ai/protocol";
import {
	isContentGenerationNode,
	isImageGenerationNode,
	isTextGenerationNode,
	isTriggerNode,
	isVectorStoreNode,
} from "@giselles-ai/protocol";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import clsx from "clsx/lite";
import { PlusIcon } from "lucide-react";
import { type CSSProperties, useCallback, useMemo } from "react";
import { useAppDesignerStore, useUpdateNodeData } from "../../app-designer";
import { NodeIcon } from "../../icons/node";
import { EditableText } from "../../ui/editable-text";
import { Tooltip } from "../../ui/tooltip";
import { NodeGenerationStatusBadge } from "./node-generation-status-badge";
import { nodeRequiresSetup, useNodeGenerationStatus } from "./node-utils";
import { DataStoreNodeInfo, DocumentNodeInfo, GitHubNodeInfo } from "./ui";
import { GitHubTriggerStatusBadge } from "./ui/github-trigger/status-badge";

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

/**
 * Abbreviating variant as v.
 */
function useVariant(node: NodeLike) {
	return useMemo(() => {
		const isText = node.content.type === "text";
		const isFile = node.content.type === "file";
		const isWebPage = node.content.type === "webPage";
		const isTextGeneration = node.content.type === "textGeneration";
		const isContentGeneration = node.content.type === "contentGeneration";
		const isImageGeneration = node.content.type === "imageGeneration";
		const isGithub = node.content.type === "github";
		const isVectorStore = node.content.type === "vectorStore";
		const isDataStore = node.content.type === "dataStore";
		const isTrigger = node.content.type === "trigger";
		const isAction = node.content.type === "action";
		const isQuery = node.content.type === "query";
		const isDataQuery = node.content.type === "dataQuery";
		const isIntegration = node.content.type === "integration";

		const isVectorStoreGithub =
			isVectorStore &&
			isVectorStoreNode(node) &&
			node.content.source.provider === "github";
		const isVectorStoreDocument =
			isVectorStore &&
			isVectorStoreNode(node) &&
			node.content.source.provider === "document";
		const isGithubTrigger = isTriggerNode(node, "github");

		const isFillIcon =
			isText || isFile || isWebPage || isGithub || isVectorStore || isAction || isIntegration;
		const isStrokeIcon =
			isTextGeneration ||
			isImageGeneration ||
			isTrigger ||
			isQuery ||
			isDataStore ||
			isDataQuery;

		const isDarkIconText =
			isText || isFile || isWebPage || isQuery || isDataStore || isDataQuery;
		const isLightIconText =
			isTextGeneration ||
			isImageGeneration ||
			isGithub ||
			isVectorStoreGithub ||
			isTrigger ||
			isAction ||
			isIntegration;

		return {
			isText,
			isFile,
			isWebPage,
			isTextGeneration,
			isContentGeneration,
			isImageGeneration,
			isGithub,
			isVectorStore,
			isDataStore,
			isTrigger,
			isAction,
			isQuery,
			isDataQuery,
			isIntegration,
			isVectorStoreGithub,
			isVectorStoreDocument,
			isGithubTrigger,
			isFillIcon,
			isStrokeIcon,
			isDarkIconText,
			isLightIconText,
		};
	}, [node]);
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
	const { currentGeneration, stopCurrentGeneration, showCompleteLabel } =
		useNodeGenerationStatus(node.id);
	const metadataTexts = useMemo(() => {
		const tmp: { label: string; tooltip: string }[] = [];
		if (isTextGenerationNode(node) || isImageGenerationNode(node)) {
			tmp.push({ label: node.content.llm.provider, tooltip: "LLM Provider" });
		}
		tmp.push({ label: node.id.substring(3, 11), tooltip: "Node ID" });
		return tmp;
	}, [node]);

	// Subtitle text for node type context
	const subtitleText = useMemo(() => {
		if (isTextGenerationNode(node)) {
			const modelId = node.content.llm.id ?? "";
			// Extract a readable name from model ID
			const parts = modelId.split("/");
			return parts[parts.length - 1] || node.content.llm.provider;
		}
		if (isContentGenerationNode(node)) {
			const modelId = node.content.languageModel.id ?? "";
			const parts = modelId.split("/");
			return parts[parts.length - 1] || node.content.languageModel.provider;
		}
		if (isImageGenerationNode(node)) {
			const modelId = node.content.llm.id ?? "";
			const parts = modelId.split("/");
			return parts[parts.length - 1] || node.content.llm.provider;
		}
		if (node.content.type === "integration") {
			const content = node.content as unknown as {
				pieceName: string;
				actionName: string;
			};
			const piece = getCatalogEntry(content.pieceName);
			const displayName = piece?.displayName ?? content.pieceName;
			return `${displayName} \u00b7 ${content.actionName.replace(/_/g, " ")}`;
		}
		if (node.content.type === "text") return "Text Prompt";
		if (node.content.type === "file") return "File Upload";
		if (node.content.type === "webPage") return "Web Page";
		if (node.content.type === "vectorStore") return "Vector Store";
		if (node.content.type === "dataStore") return "Data Store";
		if (node.content.type === "query") return "Knowledge Query";
		if (node.content.type === "dataQuery") return "Data Query";
		if (node.content.type === "trigger") return "Trigger";
		if (node.content.type === "action") return "Action";
		return null;
	}, [node]);

	const v = useVariant(node);

	// Per-piece category color override for integration nodes
	const integrationColorStyle = useMemo(() => {
		if (node.type !== "operation" || node.content.type !== "integration")
			return undefined;
		const pieceName = node.content.pieceName as string;
		const color = getPieceCategoryColor(pieceName);
		if (!color) return undefined;
		return {
			"--color-integration-node-1": color,
			"--shadow-integration-node-1": `0px 4px 12px ${color
				.replace("hsl(", "hsla(")
				.replace(")", ", 0.3)")}`,
		} as CSSProperties;
	}, [node]);

	const requiresSetup = nodeRequiresSetup(node);

	type VariantType = {
		isText: boolean;
		isFile: boolean;
		isWebPage: boolean;
		isTextGeneration: boolean;
		isContentGeneration: boolean;
		isImageGeneration: boolean;
		isGithub: boolean;
		isVectorStore: boolean;
		isDataStore: boolean;
		isTrigger: boolean;
		isAction: boolean;
		isQuery: boolean;
		isDataQuery: boolean;
		isIntegration: boolean;
		isVectorStoreGithub: boolean;
		isVectorStoreDocument: boolean;
		isGithubTrigger: boolean;
		isFillIcon: boolean;
		isStrokeIcon: boolean;
		isDarkIconText: boolean;
		isLightIconText: boolean;
	};
	const getNodeColorVariable = useCallback(
		(variant: VariantType): string | undefined => {
			if (variant.isText) return "var(--color-text-node-1)";
			if (variant.isFile) return "var(--color-file-node-1)";
			if (variant.isWebPage) return "var(--color-webPage-node-1)";
			if (variant.isTextGeneration) return "var(--color-generation-node-1)";
			if (variant.isContentGeneration) return "var(--color-generation-node-1)";
			if (variant.isImageGeneration)
				return "var(--color-image-generation-node-1)";
			if (
				variant.isGithub ||
				variant.isVectorStoreGithub ||
				variant.isVectorStoreDocument
			)
				return "var(--color-github-node-1)";
			if (variant.isDataStore) return "var(--color-data-store-node-1)";
			if (variant.isTrigger) return "var(--color-trigger-node-1)";
			if (variant.isAction) return "var(--color-action-node-1)";
			if (variant.isIntegration) return "var(--color-integration-node-1)";
			if (variant.isQuery) return "var(--color-query-node-1)";
			if (variant.isDataQuery) return "var(--color-data-query-node-1)";
			return undefined;
		},
		[],
	);

	const nodeRadiusClass = "rounded-[12px]";
	const nodeLayoutClass = "flex flex-col py-[12px] gap-[8px] min-w-[180px]";
	const stageShapeClass = "transition-all backdrop-blur-[4px]";
	const stageBackgroundClass = undefined;

	const borderGradientStyle = useMemo(() => {
		if (requiresSetup) return undefined;
		const colorVar = getNodeColorVariable(v);
		if (!colorVar) return undefined;

		return {
			backgroundImage: `linear-gradient(to bottom right, color-mix(in srgb, ${colorVar} 40%, transparent 60%), color-mix(in srgb, ${colorVar} 70%, transparent 30%) 50%, ${colorVar})`,
		};
	}, [v, requiresSetup, getNodeColorVariable]);

	const backgroundGradientStyle = useMemo(() => {
		if (requiresSetup) return undefined;
		const colorVar = getNodeColorVariable(v);
		if (!colorVar) return undefined;

		// Stronger gradient for generation & integration nodes
		const isGenOrIntegration =
			v.isTextGeneration || v.isContentGeneration || v.isImageGeneration || v.isIntegration;
		const [s1, s2, s3] = isGenOrIntegration
			? ["30%", "15%", "8%"]
			: ["20%", "10%", "5%"];

		return {
			backgroundImage: `radial-gradient(ellipse farthest-corner at center, color-mix(in srgb, ${colorVar} ${s1}, transparent) 0%, color-mix(in srgb, ${colorVar} ${s2}, transparent) 50%, color-mix(in srgb, ${colorVar} ${s3}, transparent) 75%, transparent 100%)`,
		};
	}, [v, requiresSetup, getNodeColorVariable]);

	// Outer glow shadow for richer visual effect
	const glowShadowStyle = useMemo(() => {
		if (requiresSetup) return undefined;
		const colorVar = getNodeColorVariable(v);
		if (!colorVar) return undefined;

		return {
			filter: `drop-shadow(0 0 12px color-mix(in srgb, ${colorVar} 25%, transparent 75%))`,
		} as CSSProperties;
	}, [v, requiresSetup, getNodeColorVariable]);

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
				"group relative rounded-[12px]",
				nodeLayoutClass,
				// Stage Request / Stage Response are rendered as pill nodes, so avoid animating layout/border-radius.
				stageShapeClass,
				stageBackgroundClass,
				"bg-transparent",
				!selected &&
					!highlighted &&
					"shadow-[4px_4px_8px_4px_rgba(0,_0,_0,_0.5)]",
				selected && v.isText && "shadow-text-node-1",
				selected && v.isFile && "shadow-file-node-1",
				selected && v.isWebPage && "shadow-webPage-node-1",
				selected && v.isTextGeneration && "shadow-generation-node-1",
				selected && v.isContentGeneration && "shadow-generation-node-1",
				selected && v.isImageGeneration && "shadow-image-generation-node-1",
				selected && v.isGithub && "shadow-github-node-1",
				selected && v.isVectorStoreGithub && "shadow-github-node-1",
				selected && v.isVectorStoreDocument && "shadow-github-node-1",
				selected && v.isTrigger && "shadow-trigger-node-1",
				selected && v.isAction && "shadow-action-node-1",
				selected && v.isIntegration && "shadow-integration-node-1",
				selected && v.isQuery && "shadow-query-node-1",
				selected && v.isDataStore && "shadow-data-store-node-1",
				selected && v.isDataQuery && "shadow-data-query-node-1",
				selected && "shadow-[0px_0px_20px_1px_rgba(0,_0,_0,_0.4)]",
				selected &&
					v.isTrigger &&
					"shadow-[0px_0px_20px_1px_hsla(220,_15%,_50%,_0.4)]",
				highlighted && v.isText && "shadow-text-node-1",
				highlighted && v.isFile && "shadow-file-node-1",
				highlighted && v.isWebPage && "shadow-webPage-node-1",
				highlighted && v.isTextGeneration && "shadow-generation-node-1",
				highlighted && v.isContentGeneration && "shadow-generation-node-1",
				highlighted && v.isImageGeneration && "shadow-image-generation-node-1",
				highlighted && v.isGithub && "shadow-github-node-1",
				highlighted && v.isVectorStoreGithub && "shadow-github-node-1",
				highlighted && v.isVectorStoreDocument && "shadow-github-node-1",
				highlighted && v.isTrigger && "shadow-trigger-node-1",
				highlighted && v.isAction && "shadow-action-node-1",
				highlighted && v.isIntegration && "shadow-integration-node-1",
				highlighted && v.isQuery && "shadow-query-node-1",
				highlighted && v.isDataStore && "shadow-data-store-node-1",
				highlighted && v.isDataQuery && "shadow-data-query-node-1",
				highlighted && "shadow-[0px_0px_20px_1px_rgba(0,_0,_0,_0.4)]",
				highlighted &&
					v.isTrigger &&
					"shadow-[0px_0px_20px_1px_hsla(220,_15%,_50%,_0.4)]",
				preview && "opacity-50",
				!preview && "min-h-[72px]",
				requiresSetup && "opacity-80",
			)}
		>
			<NodeGenerationStatusBadge
				node={node}
				currentGeneration={currentGeneration}
				showCompleteLabel={showCompleteLabel}
				onStopCurrentGeneration={stopCurrentGeneration}
			/>
			<div
				className={clsx("absolute z-[-1] inset-0", nodeRadiusClass)}
				style={backgroundGradientStyle}
			/>
			<div
				className={clsx(
					"absolute z-0 inset-0 border-[2px] mask-fill",
					nodeRadiusClass,
					requiresSetup
						? "border-black/60 border-dashed [border-width:2px]"
						: "border-transparent",
					!borderGradientStyle && "bg-gradient-to-br",
					!borderGradientStyle &&
						v.isText &&
						"from-text-node-1/40 via-text-node-1/70 to-text-node-1",
					!borderGradientStyle &&
						v.isFile &&
						"from-file-node-1/40 via-file-node-1/70 to-file-node-1",
					!borderGradientStyle &&
						v.isWebPage &&
						"from-webPage-node-1/40 via-webPage-node-1/70 to-webPage-node-1",
					!borderGradientStyle &&
						v.isTextGeneration &&
						"from-generation-node-1/40 via-generation-node-1/70 to-generation-node-1",
					!borderGradientStyle &&
						v.isContentGeneration &&
						"from-generation-node-1/40 via-generation-node-1/70 to-generation-node-1",
					!borderGradientStyle &&
						v.isImageGeneration &&
						"from-image-generation-node-1/40 via-image-generation-node-1/70 to-image-generation-node-1",
					!borderGradientStyle &&
						v.isGithub &&
						"from-github-node-1/40 via-github-node-1/70 to-github-node-1",
					!borderGradientStyle &&
						v.isVectorStoreGithub &&
						"from-github-node-1/40 via-github-node-1/70 to-github-node-1",
					!borderGradientStyle &&
						v.isVectorStoreDocument &&
						"from-github-node-1/40 via-github-node-1/70 to-github-node-1",
					!borderGradientStyle &&
						v.isTrigger &&
						"from-trigger-node-1/40 via-trigger-node-1/70 to-trigger-node-1",
					!borderGradientStyle &&
						v.isAction &&
						"from-action-node-1/40 via-action-node-1/70 to-action-node-1",
					!borderGradientStyle &&
						v.isIntegration &&
						"from-integration-node-1/40 via-integration-node-1/70 to-integration-node-1",
					!borderGradientStyle &&
						v.isQuery &&
						"from-query-node-1/40 via-query-node-1/70 to-query-node-1",
					!borderGradientStyle &&
						v.isDataStore &&
						"from-data-store-node-1/40 via-data-store-node-1/70 to-data-store-node-1",
					!borderGradientStyle &&
						v.isDataQuery &&
						"from-data-query-node-1/40 via-data-query-node-1/70 to-data-query-node-1",
				)}
				style={borderGradientStyle}
			/>
			{/* Colored left accent stripe for integration nodes */}
			{v.isIntegration && !requiresSetup && (
				<div
					className={clsx("absolute left-0 top-[16px] bottom-[16px] w-[3px] z-[1] rounded-full")}
					style={{
						backgroundColor: "var(--color-integration-node-1)",
					}}
				/>
			)}
			{isTriggerNode(node, "github") &&
				node.content.state.status === "configured" && (
					<div className="absolute top-[-20px] left-0 z-10">
						<GitHubTriggerStatusBadge
							triggerId={node.content.state.flowTriggerId}
						/>
					</div>
				)}
			<div className={clsx("px-[16px] relative")}>
				<div className="flex items-center gap-[10px]">
					<div
						className={clsx(
							"w-[44px] h-[44px] flex items-center justify-center shrink-0",
							"rounded-[12px]",
							v.isText && "bg-text-node-1",
							v.isFile && "bg-file-node-1",
							v.isWebPage && "bg-webPage-node-1",
							v.isTextGeneration && "bg-generation-node-1",
							v.isContentGeneration && "bg-generation-node-1",
							v.isImageGeneration && "bg-image-generation-node-1",
							v.isGithub && "bg-github-node-1",
							v.isVectorStoreGithub && "bg-github-node-1",
							v.isVectorStoreDocument && "bg-github-node-1",
							v.isTrigger && "bg-trigger-node-1",
							v.isAction && "bg-action-node-1",
							v.isIntegration && "bg-integration-node-1",
							v.isQuery && "bg-query-node-1",
							v.isDataStore && "bg-data-store-node-1",
							v.isDataQuery && "bg-data-query-node-1",
						)}
					>
						<NodeIcon
							node={node}
							className={clsx(
								"w-[24px] h-[24px]",
								v.isText && "fill-current",
								v.isFile && "fill-current",
								v.isWebPage && "fill-current",
								v.isTextGeneration && "fill-current",
								v.isContentGeneration && "fill-current",
								v.isImageGeneration && "fill-current",
								v.isVectorStore &&
									!v.isVectorStoreGithub &&
									"stroke-current fill-none",
								v.isVectorStoreGithub && "fill-current",
								v.isVectorStoreDocument && "stroke-current fill-none",
								v.isTrigger && !v.isGithubTrigger && "stroke-current fill-none",
								v.isGithubTrigger && "fill-current",
								v.isAction && "fill-current",
								v.isQuery && "stroke-current fill-none",
								v.isDataStore && "stroke-current fill-none",
								v.isDataQuery && "stroke-current fill-none",
								v.isGithub && "fill-current",
								v.isText && "text-background",
								v.isFile && "text-background",
								v.isWebPage && "text-background",
								v.isTextGeneration && "text-inverse",
								v.isImageGeneration && "text-inverse",
								v.isGithub && "text-background",
								v.isVectorStoreGithub && "text-background",
								v.isVectorStoreDocument && "text-background",
								v.isTrigger && !v.isGithubTrigger && "text-inverse",
								v.isGithubTrigger && "text-background",
								v.isAction && "text-inverse",
								v.isIntegration && "text-inverse",
								v.isQuery && "text-background",
								v.isDataStore && "text-background",
								v.isDataQuery && "text-background",
							)}
						/>
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-[2px] pl-[4px] text-[10px] font-mono [&>*:not(:last-child)]:after:content-['/'] [&>*:not(:last-child)]:after:ml-[2px] [&>*:not(:last-child)]:after:text-text/60">
							{metadataTexts.map((item) => (
								<div key={item.label} className="text-[10px] text-inverse">
									{selected ? (
										<Tooltip text={item.tooltip} variant="dark">
											<button type="button">{item.label}</button>
										</Tooltip>
									) : (
										item.label
									)}
								</div>
							))}
						</div>
						<EditableText
							className="group-data-[selected=false]:pointer-events-none **:data-input:w-full"
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
							<div className="pl-[4px] text-[10px] text-inverse/50 truncate max-w-[160px] mt-[1px]">
								{subtitleText}
							</div>
						)}
					</div>
				</div>
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

	return (
		<>
			{/* Input handle - centered vertically on left edge */}
			{node.type === "operation" &&
				node.content.type !== "trigger" &&
				node.content.type !== "appEntry" && (
					<Handle
						type="target"
						position={Position.Left}
						className={clsx(
							"!absolute !w-[11px] !h-[11px] !rounded-full !left-0 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !border-[1.5px] !bg-background",
							v.isTextGeneration && "!border-generation-node-1",
							v.isTextGeneration && isInputConnected && "!bg-generation-node-1",
							v.isContentGeneration && "!border-generation-node-1",
							v.isContentGeneration && isInputConnected && "!bg-generation-node-1",
							v.isImageGeneration && "!border-image-generation-node-1",
							v.isImageGeneration && isInputConnected && "!bg-image-generation-node-1",
							v.isAction && "!border-action-node-1",
							v.isAction && isInputConnected && "!bg-action-node-1",
							v.isIntegration && "!border-integration-node-1",
							v.isIntegration && isInputConnected && "!bg-integration-node-1",
							v.isQuery && "!border-query-node-1",
							v.isQuery && isInputConnected && "!bg-query-node-1",
							v.isDataQuery && "!border-data-query-node-1",
							v.isDataQuery && isInputConnected && "!bg-data-query-node-1",
						)}
					/>
				)}

			{/* Output handle - centered vertically on right edge */}
			<Handle
				type="source"
				position={Position.Right}
				className={clsx(
					"!absolute !w-[12px] !h-[12px] !rounded-full !right-0 !top-1/2 !translate-x-1/2 !-translate-y-1/2 !border-[1.5px]",
					!isOutputConnected && "!bg-background",
					v.isTextGeneration && "!border-generation-node-1",
					v.isTextGeneration && isOutputConnected && "!bg-generation-node-1",
					v.isContentGeneration && "!border-generation-node-1",
					v.isContentGeneration && isOutputConnected && "!bg-generation-node-1",
					v.isImageGeneration && "!border-image-generation-node-1",
					v.isImageGeneration && isOutputConnected && "!bg-image-generation-node-1",
					v.isGithub && "!border-github-node-1",
					v.isGithub && isOutputConnected && "!bg-github-node-1",
					v.isVectorStoreGithub && "!border-github-node-1",
					v.isVectorStoreGithub && isOutputConnected && "!bg-github-node-1",
					v.isVectorStoreDocument && "!border-github-node-1",
					v.isVectorStoreDocument && isOutputConnected && "!bg-github-node-1",
					v.isText && "!border-text-node-1",
					v.isText && isOutputConnected && "!bg-text-node-1",
					v.isFile && "!border-file-node-1",
					v.isFile && isOutputConnected && "!bg-file-node-1",
					v.isWebPage && "!border-webPage-node-1",
					v.isWebPage && isOutputConnected && "!bg-webPage-node-1",
					v.isTrigger && "!border-trigger-node-1",
					v.isTrigger && isOutputConnected && "!bg-trigger-node-1",
					v.isAction && "!border-action-node-1",
					v.isAction && isOutputConnected && "!bg-action-node-1",
					v.isIntegration && "!border-integration-node-1",
					v.isIntegration && isOutputConnected && "!bg-integration-node-1",
					v.isQuery && "!border-query-node-1",
					v.isQuery && isOutputConnected && "!bg-query-node-1",
					v.isDataStore && "!border-data-store-node-1",
					v.isDataStore && isOutputConnected && "!bg-data-store-node-1",
					v.isDataQuery && "!border-data-query-node-1",
					v.isDataQuery && isOutputConnected && "!bg-data-query-node-1",
				)}
			/>

			{/* Plus button - outside right edge, past the output handle */}
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
