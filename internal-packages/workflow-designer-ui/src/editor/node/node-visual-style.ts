import {
	getCatalogEntry,
	getPieceCategoryColor,
} from "@giselles-ai/activepieces-adapter";
import type { NodeLike } from "@giselles-ai/protocol";
import {
	isAiAgentNode,
	isChatModelNode,
	isContentGenerationNode,
	isImageGenerationNode,
	isTextGenerationNode,
	isTriggerNode,
	isVectorStoreNode,
} from "@giselles-ai/protocol";
import clsx from "clsx/lite";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { nodeRequiresSetup } from "./node-utils";

export interface VariantType {
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
	isAiAgent: boolean;
	isChatModel: boolean;
	isToolNode: boolean;
	isMemoryNode: boolean;
	isVectorStoreGithub: boolean;
	isVectorStoreDocument: boolean;
	isGithubTrigger: boolean;
	isFlowControl: boolean;
	isDataTransform: boolean;
	isBranching: boolean;
	isLoop: boolean;
	isMerge: boolean;
	isWait: boolean;
	isCode: boolean;
	isDataProcessing: boolean;
	isErrorTrigger: boolean;
	isDataTable: boolean;
	isFormTrigger: boolean;
	isFillIcon: boolean;
	isStrokeIcon: boolean;
	isDarkIconText: boolean;
	isLightIconText: boolean;
}

export function useVariant(node: NodeLike): VariantType {
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
		const isAiAgent = node.content.type === "aiAgent";
		const isChatModel = node.content.type === "chatModel";
		const isToolNode = node.content.type === "toolNode";
		const isMemoryNode = node.content.type === "memoryNode";

		const isFlowControl =
			node.content.type === "if" ||
			node.content.type === "switch" ||
			node.content.type === "merge" ||
			node.content.type === "loop" ||
			node.content.type === "wait" ||
			node.content.type === "executeSubWorkflow" ||
			node.content.type === "respondToWebhook";
		const isDataTransform =
			node.content.type === "code" ||
			node.content.type === "filter" ||
			node.content.type === "editFields" ||
			node.content.type === "sort" ||
			node.content.type === "customVariables" ||
			node.content.type === "aggregate" ||
			node.content.type === "summarize" ||
			node.content.type === "limit" ||
			node.content.type === "removeDuplicates" ||
			node.content.type === "renameKeys" ||
			node.content.type === "splitOut" ||
			node.content.type === "compareDatasets";
		const isErrorTrigger = node.content.type === "errorTrigger";
		const isDataTable = node.content.type === "dataTable";
		const isFormTrigger = node.content.type === "formTrigger";

		const isBranching =
			node.content.type === "if" || node.content.type === "switch";
		const isLoop = node.content.type === "loop";
		const isMerge = node.content.type === "merge";
		const isWait = node.content.type === "wait";
		const isCode = node.content.type === "code";
		const isDataProcessing =
			node.content.type === "filter" ||
			node.content.type === "editFields" ||
			node.content.type === "sort" ||
			node.content.type === "aggregate" ||
			node.content.type === "summarize" ||
			node.content.type === "limit" ||
			node.content.type === "removeDuplicates" ||
			node.content.type === "renameKeys" ||
			node.content.type === "splitOut" ||
			node.content.type === "compareDatasets";

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
			isDataQuery ||
			isAiAgent ||
			isChatModel ||
			isToolNode ||
			isMemoryNode ||
			isFlowControl ||
			isDataTransform ||
			isErrorTrigger ||
			isDataTable ||
			isFormTrigger;

		const isDarkIconText =
			isText || isFile || isWebPage || isQuery || isDataStore || isDataQuery;
		const isLightIconText =
			isTextGeneration ||
			isImageGeneration ||
			isGithub ||
			isVectorStoreGithub ||
			isTrigger ||
			isAction ||
			isIntegration ||
			isAiAgent ||
			isChatModel ||
			isToolNode ||
			isMemoryNode ||
			isFlowControl ||
			isDataTransform ||
			isErrorTrigger ||
			isDataTable ||
			isFormTrigger;

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
			isAiAgent,
			isChatModel,
			isToolNode,
			isMemoryNode,
			isVectorStoreGithub,
			isVectorStoreDocument,
			isGithubTrigger,
			isFlowControl,
			isDataTransform,
			isErrorTrigger,
			isDataTable,
			isFormTrigger,
			isBranching,
			isLoop,
			isMerge,
			isWait,
			isCode,
			isDataProcessing,
			isFillIcon,
			isStrokeIcon,
			isDarkIconText,
			isLightIconText,
		};
	}, [node]);
}

export function getNodeColorVariable(v: VariantType): string | undefined {
	if (v.isText) return "var(--color-text-node-1)";
	if (v.isFile) return "var(--color-file-node-1)";
	if (v.isWebPage) return "var(--color-webPage-node-1)";
	if (v.isTextGeneration) return "var(--color-generation-node-1)";
	if (v.isContentGeneration) return "var(--color-generation-node-1)";
	if (v.isAiAgent) return "var(--color-generation-node-1)";
	if (v.isChatModel) return "var(--color-generation-node-1)";
	if (v.isImageGeneration) return "var(--color-image-generation-node-1)";
	if (v.isGithub || v.isVectorStoreGithub || v.isVectorStoreDocument)
		return "var(--color-github-node-1)";
	if (v.isDataStore) return "var(--color-data-store-node-1)";
	if (v.isTrigger) return "var(--color-trigger-node-1)";
	if (v.isAction) return "var(--color-action-node-1)";
	if (v.isIntegration) return "var(--color-integration-node-1)";
	if (v.isQuery) return "var(--color-query-node-1)";
	if (v.isDataQuery) return "var(--color-data-query-node-1)";
	if (v.isBranching) return "var(--color-branching-node-1)";
	if (v.isLoop) return "var(--color-flow-control-node-1)";
	if (v.isMerge) return "var(--color-merge-node-1)";
	if (v.isWait) return "var(--color-wait-node-1)";
	if (v.isCode) return "var(--color-data-transform-node-1)";
	if (v.isDataProcessing) return "var(--color-data-processing-node-1)";
	if (v.isErrorTrigger) return "var(--color-error-trigger-node-1)";
	if (v.isDataTable) return "var(--color-data-store-node-1)";
	if (v.isFormTrigger) return "var(--color-trigger-node-1)";
	// Wave 10 nodes — fall through to flow control / data transform color
	if (v.isFlowControl) return "var(--color-flow-control-node-1)";
	if (v.isDataTransform) return "var(--color-data-processing-node-1)";
	return undefined;
}

export function computeBorderGradientStyle(
	colorVar: string | undefined,
	requiresSetup: boolean,
): CSSProperties | undefined {
	if (requiresSetup || !colorVar) return undefined;
	return {
		backgroundImage: `linear-gradient(to bottom right, color-mix(in srgb, ${colorVar} 40%, transparent 60%), color-mix(in srgb, ${colorVar} 70%, transparent 30%) 50%, ${colorVar})`,
	};
}

export function computeBackgroundGradientStyle(
	colorVar: string | undefined,
	v: VariantType,
	requiresSetup: boolean,
): CSSProperties | undefined {
	if (requiresSetup || !colorVar) return undefined;
	const isGenOrIntegration =
		v.isTextGeneration ||
		v.isContentGeneration ||
		v.isImageGeneration ||
		v.isIntegration ||
		v.isAiAgent ||
		v.isChatModel;
	const [s1, s2, s3] = isGenOrIntegration
		? ["30%", "15%", "8%"]
		: ["20%", "10%", "5%"];
	return {
		backgroundImage: `radial-gradient(ellipse farthest-corner at center, color-mix(in srgb, ${colorVar} ${s1}, transparent) 0%, color-mix(in srgb, ${colorVar} ${s2}, transparent) 50%, color-mix(in srgb, ${colorVar} ${s3}, transparent) 75%, transparent 100%)`,
	};
}

export function computeGlowShadowStyle(
	colorVar: string | undefined,
	requiresSetup: boolean,
): CSSProperties | undefined {
	if (requiresSetup || !colorVar) return undefined;
	return {
		filter: `drop-shadow(0 0 12px color-mix(in srgb, ${colorVar} 25%, transparent 75%))`,
	} as CSSProperties;
}

export function getSelectionShadowClasses(
	selected: boolean | undefined,
	highlighted: boolean | undefined,
	v: VariantType,
): string {
	return clsx(
		!selected &&
			!highlighted &&
			"shadow-[4px_4px_8px_4px_rgba(0,_0,_0,_0.5)]",
		selected && v.isText && "shadow-text-node-1",
		selected && v.isFile && "shadow-file-node-1",
		selected && v.isWebPage && "shadow-webPage-node-1",
		selected && v.isTextGeneration && "shadow-generation-node-1",
		selected && v.isContentGeneration && "shadow-generation-node-1",
		selected && v.isAiAgent && "shadow-generation-node-1",
		selected && v.isChatModel && "shadow-generation-node-1",
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
		selected && v.isBranching && "shadow-branching-node-1",
		selected && v.isLoop && "shadow-flow-control-node-1",
		selected && v.isMerge && "shadow-merge-node-1",
		selected && v.isWait && "shadow-wait-node-1",
		selected && v.isCode && "shadow-data-transform-node-1",
		selected && v.isDataProcessing && "shadow-data-processing-node-1",
		selected && v.isErrorTrigger && "shadow-error-trigger-node-1",
		selected && v.isDataTable && "shadow-data-store-node-1",
		selected && v.isFormTrigger && "shadow-trigger-node-1",
		selected && "shadow-[0px_0px_20px_1px_rgba(0,_0,_0,_0.4)]",
		selected &&
			v.isTrigger &&
			"shadow-[0px_0px_20px_1px_hsla(220,_15%,_50%,_0.4)]",
		highlighted && v.isText && "shadow-text-node-1",
		highlighted && v.isFile && "shadow-file-node-1",
		highlighted && v.isWebPage && "shadow-webPage-node-1",
		highlighted && v.isTextGeneration && "shadow-generation-node-1",
		highlighted && v.isContentGeneration && "shadow-generation-node-1",
		highlighted && v.isAiAgent && "shadow-generation-node-1",
		highlighted && v.isChatModel && "shadow-generation-node-1",
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
		highlighted && v.isBranching && "shadow-branching-node-1",
		highlighted && v.isLoop && "shadow-flow-control-node-1",
		highlighted && v.isMerge && "shadow-merge-node-1",
		highlighted && v.isWait && "shadow-wait-node-1",
		highlighted && v.isCode && "shadow-data-transform-node-1",
		highlighted && v.isDataProcessing && "shadow-data-processing-node-1",
		highlighted && v.isErrorTrigger && "shadow-error-trigger-node-1",
		highlighted && v.isDataTable && "shadow-data-store-node-1",
		highlighted && v.isFormTrigger && "shadow-trigger-node-1",
		highlighted && "shadow-[0px_0px_20px_1px_rgba(0,_0,_0,_0.4)]",
		highlighted &&
			v.isTrigger &&
			"shadow-[0px_0px_20px_1px_hsla(220,_15%,_50%,_0.4)]",
	);
}

export function getBorderGradientClasses(
	v: VariantType,
	hasBorderGradientStyle: boolean,
	requiresSetup: boolean,
): string {
	return clsx(
		requiresSetup
			? "border-black/60 border-dashed [border-width:2px]"
			: "border-transparent",
		!hasBorderGradientStyle && "bg-gradient-to-br",
		!hasBorderGradientStyle &&
			v.isText &&
			"from-text-node-1/40 via-text-node-1/70 to-text-node-1",
		!hasBorderGradientStyle &&
			v.isFile &&
			"from-file-node-1/40 via-file-node-1/70 to-file-node-1",
		!hasBorderGradientStyle &&
			v.isWebPage &&
			"from-webPage-node-1/40 via-webPage-node-1/70 to-webPage-node-1",
		!hasBorderGradientStyle &&
			v.isTextGeneration &&
			"from-generation-node-1/40 via-generation-node-1/70 to-generation-node-1",
		!hasBorderGradientStyle &&
			v.isContentGeneration &&
			"from-generation-node-1/40 via-generation-node-1/70 to-generation-node-1",
		!hasBorderGradientStyle &&
			v.isAiAgent &&
			"from-generation-node-1/40 via-generation-node-1/70 to-generation-node-1",
		!hasBorderGradientStyle &&
			v.isChatModel &&
			"from-generation-node-1/40 via-generation-node-1/70 to-generation-node-1",
		!hasBorderGradientStyle &&
			v.isImageGeneration &&
			"from-image-generation-node-1/40 via-image-generation-node-1/70 to-image-generation-node-1",
		!hasBorderGradientStyle &&
			v.isGithub &&
			"from-github-node-1/40 via-github-node-1/70 to-github-node-1",
		!hasBorderGradientStyle &&
			v.isVectorStoreGithub &&
			"from-github-node-1/40 via-github-node-1/70 to-github-node-1",
		!hasBorderGradientStyle &&
			v.isVectorStoreDocument &&
			"from-github-node-1/40 via-github-node-1/70 to-github-node-1",
		!hasBorderGradientStyle &&
			v.isTrigger &&
			"from-trigger-node-1/40 via-trigger-node-1/70 to-trigger-node-1",
		!hasBorderGradientStyle &&
			v.isAction &&
			"from-action-node-1/40 via-action-node-1/70 to-action-node-1",
		!hasBorderGradientStyle &&
			v.isIntegration &&
			"from-integration-node-1/40 via-integration-node-1/70 to-integration-node-1",
		!hasBorderGradientStyle &&
			v.isQuery &&
			"from-query-node-1/40 via-query-node-1/70 to-query-node-1",
		!hasBorderGradientStyle &&
			v.isDataStore &&
			"from-data-store-node-1/40 via-data-store-node-1/70 to-data-store-node-1",
		!hasBorderGradientStyle &&
			v.isDataQuery &&
			"from-data-query-node-1/40 via-data-query-node-1/70 to-data-query-node-1",
		!hasBorderGradientStyle &&
			v.isBranching &&
			"from-branching-node-1/40 via-branching-node-1/70 to-branching-node-1",
		!hasBorderGradientStyle &&
			v.isLoop &&
			"from-flow-control-node-1/40 via-flow-control-node-1/70 to-flow-control-node-1",
		!hasBorderGradientStyle &&
			v.isMerge &&
			"from-merge-node-1/40 via-merge-node-1/70 to-merge-node-1",
		!hasBorderGradientStyle &&
			v.isWait &&
			"from-wait-node-1/40 via-wait-node-1/70 to-wait-node-1",
		!hasBorderGradientStyle &&
			v.isCode &&
			"from-data-transform-node-1/40 via-data-transform-node-1/70 to-data-transform-node-1",
		!hasBorderGradientStyle &&
			v.isDataProcessing &&
			"from-data-processing-node-1/40 via-data-processing-node-1/70 to-data-processing-node-1",
		!hasBorderGradientStyle &&
			v.isErrorTrigger &&
			"from-error-trigger-node-1/40 via-error-trigger-node-1/70 to-error-trigger-node-1",
		!hasBorderGradientStyle &&
			v.isDataTable &&
			"from-data-store-node-1/40 via-data-store-node-1/70 to-data-store-node-1",
		!hasBorderGradientStyle &&
			v.isFormTrigger &&
			"from-trigger-node-1/40 via-trigger-node-1/70 to-trigger-node-1",
	);
}

export function getIconContainerClasses(v: VariantType): string {
	return clsx(
		v.isText && "bg-text-node-1",
		v.isFile && "bg-file-node-1",
		v.isWebPage && "bg-webPage-node-1",
		v.isTextGeneration && "bg-generation-node-1",
		v.isContentGeneration && "bg-generation-node-1",
		v.isAiAgent && "bg-generation-node-1",
		v.isChatModel && "bg-generation-node-1",
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
		v.isBranching && "bg-branching-node-1",
		v.isLoop && "bg-flow-control-node-1",
		v.isMerge && "bg-merge-node-1",
		v.isWait && "bg-wait-node-1",
		v.isCode && "bg-data-transform-node-1",
		v.isDataProcessing && "bg-data-processing-node-1",
		v.isErrorTrigger && "bg-error-trigger-node-1",
		v.isDataTable && "bg-data-store-node-1",
		v.isFormTrigger && "bg-trigger-node-1",
		v.isToolNode && "bg-generation-node-1",
		v.isMemoryNode && "bg-generation-node-1",
	);
}

export function getIconClasses(v: VariantType): string {
	return clsx(
		v.isText && "fill-current",
		v.isFile && "fill-current",
		v.isWebPage && "fill-current",
		v.isTextGeneration && "fill-current",
		v.isContentGeneration && "fill-current",
		v.isAiAgent && "stroke-current fill-none",
		v.isChatModel && "stroke-current fill-none",
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
		v.isAiAgent && "text-inverse",
		v.isChatModel && "text-inverse",
		v.isQuery && "text-background",
		v.isDataStore && "text-background",
		v.isDataQuery && "text-background",
		v.isFlowControl && "stroke-current fill-none",
		v.isDataTransform && "stroke-current fill-none",
		v.isErrorTrigger && "stroke-current fill-none",
		v.isDataTable && "stroke-current fill-none",
		v.isFormTrigger && "stroke-current fill-none",
		v.isFlowControl && "text-inverse",
		v.isDataTransform && "text-inverse",
		v.isErrorTrigger && "text-inverse",
		v.isDataTable && "text-inverse",
		v.isFormTrigger && "text-inverse",
		v.isToolNode && "stroke-current fill-none text-inverse",
		v.isMemoryNode && "stroke-current fill-none text-inverse",
	);
}

export function getHandleBorderClass(v: VariantType): string {
	return clsx(
		v.isTextGeneration && "!border-generation-node-1",
		v.isContentGeneration && "!border-generation-node-1",
		v.isAiAgent && "!border-generation-node-1",
		v.isChatModel && "!border-generation-node-1",
		v.isImageGeneration && "!border-image-generation-node-1",
		v.isGithub && "!border-github-node-1",
		v.isVectorStoreGithub && "!border-github-node-1",
		v.isVectorStoreDocument && "!border-github-node-1",
		v.isText && "!border-text-node-1",
		v.isFile && "!border-file-node-1",
		v.isWebPage && "!border-webPage-node-1",
		v.isTrigger && "!border-trigger-node-1",
		v.isAction && "!border-action-node-1",
		v.isIntegration && "!border-integration-node-1",
		v.isQuery && "!border-query-node-1",
		v.isDataStore && "!border-data-store-node-1",
		v.isDataQuery && "!border-data-query-node-1",
		v.isBranching && "!border-branching-node-1",
		v.isLoop && "!border-flow-control-node-1",
		v.isMerge && "!border-merge-node-1",
		v.isWait && "!border-wait-node-1",
		v.isCode && "!border-data-transform-node-1",
		v.isDataProcessing && "!border-data-processing-node-1",
		v.isErrorTrigger && "!border-error-trigger-node-1",
		v.isDataTable && "!border-data-store-node-1",
		v.isFormTrigger && "!border-trigger-node-1",
		v.isToolNode && "!border-generation-node-1",
		v.isMemoryNode && "!border-generation-node-1",
	);
}

export function getHandleActiveBgClass(v: VariantType): string {
	return clsx(
		v.isTextGeneration && "!bg-generation-node-1",
		v.isContentGeneration && "!bg-generation-node-1",
		v.isAiAgent && "!bg-generation-node-1",
		v.isChatModel && "!bg-generation-node-1",
		v.isImageGeneration && "!bg-image-generation-node-1",
		v.isGithub && "!bg-github-node-1",
		v.isVectorStoreGithub && "!bg-github-node-1",
		v.isVectorStoreDocument && "!bg-github-node-1",
		v.isText && "!bg-text-node-1",
		v.isFile && "!bg-file-node-1",
		v.isWebPage && "!bg-webPage-node-1",
		v.isTrigger && "!bg-trigger-node-1",
		v.isAction && "!bg-action-node-1",
		v.isIntegration && "!bg-integration-node-1",
		v.isQuery && "!bg-query-node-1",
		v.isDataStore && "!bg-data-store-node-1",
		v.isDataQuery && "!bg-data-query-node-1",
		v.isBranching && "!bg-branching-node-1",
		v.isLoop && "!bg-flow-control-node-1",
		v.isMerge && "!bg-merge-node-1",
		v.isWait && "!bg-wait-node-1",
		v.isCode && "!bg-data-transform-node-1",
		v.isDataProcessing && "!bg-data-processing-node-1",
		v.isErrorTrigger && "!bg-error-trigger-node-1",
		v.isDataTable && "!bg-data-store-node-1",
		v.isFormTrigger && "!bg-trigger-node-1",
		v.isToolNode && "!bg-generation-node-1",
		v.isMemoryNode && "!bg-generation-node-1",
	);
}

export function getSubtitleText(node: NodeLike): string | null {
	if (isTextGenerationNode(node)) {
		const modelId = node.content.llm.id ?? "";
		const parts = modelId.split("/");
		return parts[parts.length - 1] || node.content.llm.provider;
	}
	if (isContentGenerationNode(node)) {
		const modelId = node.content.languageModel.id ?? "";
		const parts = modelId.split("/");
		return parts[parts.length - 1] || node.content.languageModel.provider;
	}
	if (isAiAgentNode(node)) {
		const modelId = node.content.languageModel.id ?? "";
		const parts = modelId.split("/");
		const agentType = (node.content as { agentType?: string }).agentType ?? "tools";
		const typeLabels: Record<string, string> = {
			tools: "Agent",
			conversational: "Chat",
			react: "ReAct",
			planAndExecute: "Plan\u00b7Exec",
			sql: "SQL",
		};
		const label = typeLabels[agentType] ?? "Agent";
		return `${label} \u00b7 ${parts[parts.length - 1] || node.content.languageModel.provider}`;
	}
	if (isChatModelNode(node)) {
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
	if (node.content.type === "if") return "Condition";
	if (node.content.type === "switch") return "Branch Router";
	if (node.content.type === "merge") return "Merge Branches";
	if (node.content.type === "loop") return "Loop Items";
	if (node.content.type === "wait") return "Wait / Delay";
	if (node.content.type === "code") return "JavaScript";
	if (node.content.type === "filter") return "Filter Items";
	if (node.content.type === "editFields") return "Edit Fields";
	if (node.content.type === "sort") return "Sort Items";
	if (node.content.type === "errorTrigger") return "Error Handler";
	if (node.content.type === "dataTable") return "Data Table";
	if (node.content.type === "formTrigger") return "Form Input";
	if (node.content.type === "executeSubWorkflow") return "Sub-Workflow";
	if (node.content.type === "respondToWebhook") return "HTTP Response";
	if (node.content.type === "customVariables") return "Team Variables";
	if (node.content.type === "aggregate") return "Aggregate Items";
	if (node.content.type === "summarize") return "Summarize Data";
	if (node.content.type === "limit") return "Limit Results";
	if (node.content.type === "removeDuplicates") return "Remove Duplicates";
	if (node.content.type === "renameKeys") return "Rename Keys";
	if (node.content.type === "splitOut") return "Split Out Items";
	if (node.content.type === "compareDatasets") return "Compare Datasets";
	return null;
}

export function getIntegrationColorStyle(
	node: NodeLike,
): CSSProperties | undefined {
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
}

export interface NodeVisualStyleResult {
	v: VariantType;
	colorVar: string | undefined;
	requiresSetup: boolean;
	borderGradientStyle: CSSProperties | undefined;
	backgroundGradientStyle: CSSProperties | undefined;
	glowShadowStyle: CSSProperties | undefined;
	integrationColorStyle: CSSProperties | undefined;
	subtitleText: string | null;
}

export function useNodeVisualStyle(node: NodeLike): NodeVisualStyleResult {
	const v = useVariant(node);
	const colorVar = getNodeColorVariable(v);
	const requiresSetup = nodeRequiresSetup(node);

	const borderGradientStyle = useMemo(
		() => computeBorderGradientStyle(colorVar, requiresSetup),
		[colorVar, requiresSetup],
	);
	const backgroundGradientStyle = useMemo(
		() => computeBackgroundGradientStyle(colorVar, v, requiresSetup),
		[colorVar, v, requiresSetup],
	);
	const glowShadowStyle = useMemo(
		() => computeGlowShadowStyle(colorVar, requiresSetup),
		[colorVar, requiresSetup],
	);
	const integrationColorStyle = useMemo(
		() => getIntegrationColorStyle(node),
		[node],
	);
	const subtitleText = useMemo(() => getSubtitleText(node), [node]);

	return {
		v,
		colorVar,
		requiresSetup,
		borderGradientStyle,
		backgroundGradientStyle,
		glowShadowStyle,
		integrationColorStyle,
		subtitleText,
	};
}
