"use client";

import { GlassSurfaceLayers } from "@giselle-internal/ui/glass-surface";
import {
	type PieceCatalogEntry,
	getAllCategories,
	getPiecesByCategory,
	isInstalledPiece,
	searchPieces,
} from "@giselles-ai/activepieces-adapter";
import {
	Capability,
	hasCapability,
	hasTierAccess,
	type LanguageModel,
	languageModels,
	type Tier,
} from "@giselles-ai/language-model";
import { chainTemplates, type ChainTemplate } from "@giselles-ai/giselle";
import {
	createAiAgentNode,
	createAppEntryNode,
	createContentGenerationNode,
	createDataQueryNode,
	createDataStoreNode,
	createDocumentVectorStoreNode,
	createEndNode,
	createFileNode,
	createGitHubVectorStoreNode,
	createImageGenerationNode,
	createIntegrationNode,
	createQueryNode,
	createTextGenerationNode,
	createTextNode,
	createTriggerNode,
	createWebPageNode,
} from "@giselles-ai/node-registry";
import {
	FileCategory,
	isImageGenerationLanguageModelData,
	isTextGenerationLanguageModelData,
	type NodeId,
} from "@giselles-ai/protocol";
import { useFeatureFlag } from "@giselles-ai/react";
import { useUsageLimits } from "@giselles-ai/react";
import clsx from "clsx/lite";
import {
	BotIcon,
	ChevronLeftIcon,
	ClockIcon,
	FlagIcon,
	GitBranchIcon,
	GlobeIcon,
	LayersIcon,
	LinkIcon,
	PlayIcon,
	SearchIcon,
	SparklesIcon,
	XIcon,
} from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	useAddNode,
	useAppDesignerStore,
	useConnectNodes,
	useWorkspaceActions,
} from "../../../app-designer";
import { ProviderIcon } from "../../tool/toolbar/model-components/provider-icon";
import { getAvailableModels } from "../../tool/toolbar/model-components/model-utils";
import { usePieceActions } from "../../tool/toolbar/integration-picker/use-piece-actions";

interface WhatHappensNextPanelProps {
	sourceNodeId: NodeId;
	onClose: () => void;
}

type PanelLevel =
	| "categories"
	| "ai-models"
	| "integrations"
	| "integration-actions"
	| "context";

interface CategoryItem {
	id: string;
	label: string;
	description: string;
	icon: ReactNode;
	targetLevel: PanelLevel;
}

// Provider display order and labels for the AI models view
const PROVIDER_ORDER = [
	"openai",
	"anthropic",
	"google",
	"xai",
	"nvidia",
	"perplexity",
	"fal",
] as const;

const PROVIDER_LABELS: Record<string, string> = {
	openai: "OpenAI",
	anthropic: "Anthropic",
	google: "Google",
	xai: "xAI",
	nvidia: "NVIDIA",
	perplexity: "Perplexity",
	fal: "Image Generation",
};

export function WhatHappensNextPanel({
	sourceNodeId,
	onClose,
}: WhatHappensNextPanelProps) {
	const [level, setLevel] = useState<PanelLevel>("categories");
	const [selectedPiece, setSelectedPiece] = useState<PieceCatalogEntry | null>(
		null,
	);
	const [searchQuery, setSearchQuery] = useState("");
	const searchInputRef = useRef<HTMLInputElement>(null);
	const addNode = useAddNode();
	const connectNodes = useConnectNodes();
	const { setUiNodeState } = useWorkspaceActions((a) => ({
		setUiNodeState: a.setUiNodeState,
	}));
	const { llmProviders, nodes } = useAppDesignerStore((s) => ({
		llmProviders: s.llmProviders,
		nodes: s.nodes,
	}));
	const {
		generateContentNode,
		dataStore: dataStoreFlag,
		stage: stageFlag,
	} = useFeatureFlag();

	const usageLimits = useUsageLimits();
	const userTier: Tier = (usageLimits?.featureTier as Tier) ?? "free";

	// Get the source node's position to place new node to the right
	const sourceNodePosition = useAppDesignerStore((s) => {
		const uiState = s.ui.nodeState[sourceNodeId];
		return uiState?.position ?? { x: 0, y: 0 };
	});

	const sourceNodeWidth = useAppDesignerStore((s) => {
		const uiState = s.ui.nodeState[sourceNodeId];
		return uiState?.measured?.width ?? 200;
	});

	const handleAddAndConnect = useCallback(
		(newNode: Parameters<typeof addNode>[0]) => {
			const position = {
				x: sourceNodePosition.x + sourceNodeWidth + 120,
				y: sourceNodePosition.y,
			};
			addNode(newNode, { position });
			connectNodes(sourceNodeId, newNode.id);
			setUiNodeState(newNode.id, { selected: true });
			onClose();
		},
		[
			addNode,
			connectNodes,
			sourceNodeId,
			sourceNodePosition,
			sourceNodeWidth,
			setUiNodeState,
			onClose,
		],
	);

	const categories: CategoryItem[] = useMemo(
		() => [
			{
				id: "ai",
				label: "AI Generation",
				description: "Generate text, images, or content with AI models",
				icon: <SparklesIcon className="w-[18px] h-[18px]" />,
				targetLevel: "ai-models" as PanelLevel,
			},
			{
				id: "integration",
				label: "Action in an app",
				description:
					"Do something in an app like Slack, Google Sheets, or Discord",
				icon: <GlobeIcon className="w-[18px] h-[18px]" />,
				targetLevel: "integrations" as PanelLevel,
			},
			{
				id: "context",
				label: "Context & Data",
				description: "Add input sources, data stores, and retrieval",
				icon: <LayersIcon className="w-[18px] h-[18px]" />,
				targetLevel: "context" as PanelLevel,
			},
		],
		[],
	);

	// Focus search on level change or when search appears
	useEffect(() => {
		setTimeout(() => searchInputRef.current?.focus(), 100);
	}, [level]);

	// Available AI models (ALL — both text and image generation)
	const availableModels = useMemo(
		() => languageModels.filter((model) => llmProviders.includes(model.provider)),
		[llmProviders],
	);

	// Recommended models (top 3: one from each major provider)
	const recommendedModels = useMemo(() => {
		const isFreeUser = userTier === "free";
		const openaiModels = getAvailableModels(
			isFreeUser ? ["gpt-5-nano"] : ["gpt-5.2"],
			"openai",
			llmProviders,
			availableModels,
		);
		const anthropicModels = getAvailableModels(
			isFreeUser ? ["claude-haiku-4.5"] : ["claude-opus-4.5"],
			"anthropic",
			llmProviders,
			availableModels,
		);
		const googleModels = getAvailableModels(
			isFreeUser ? ["gemini-2.5-flash-lite"] : ["gemini-3-flash"],
			"google",
			llmProviders,
			availableModels,
		);

		return isFreeUser
			? [
					...openaiModels.slice(0, 1),
					...googleModels.slice(0, 1),
					...anthropicModels.slice(0, 1),
				]
			: [
					...googleModels.slice(0, 1),
					...openaiModels.slice(0, 1),
					...anthropicModels.slice(0, 1),
				];
	}, [userTier, llmProviders, availableModels]);

	// Models grouped by provider (excluding recommended)
	const modelsByProvider = useMemo(() => {
		const recommendedIds = new Set(recommendedModels.map((m) => m.id));
		const groups: Record<string, LanguageModel[]> = {};
		for (const model of availableModels) {
			if (recommendedIds.has(model.id)) continue;
			if (!groups[model.provider]) {
				groups[model.provider] = [];
			}
			groups[model.provider].push(model);
		}
		return groups;
	}, [availableModels, recommendedModels]);

	// Integration pieces (installed only)
	const installedPieces = useMemo(() => {
		const allCategories = getAllCategories();
		const pieces: PieceCatalogEntry[] = [];
		for (const cat of allCategories) {
			for (const piece of getPiecesByCategory(cat)) {
				if (isInstalledPiece(piece.name)) {
					pieces.push(piece);
				}
			}
		}
		return pieces;
	}, []);

	const filteredPieces = useMemo(() => {
		if (!searchQuery.trim()) return installedPieces;
		return searchPieces(searchQuery).filter((p) => isInstalledPiece(p.name));
	}, [searchQuery, installedPieces]);

	const filteredModels = useMemo(() => {
		if (!searchQuery.trim()) return availableModels;
		const q = searchQuery.toLowerCase();
		return availableModels.filter(
			(m) =>
				m.id.toLowerCase().includes(q) ||
				m.provider.toLowerCase().includes(q),
		);
	}, [searchQuery, availableModels]);

	// Check if Start/End nodes already placed
	const hasAppEntryNode = useMemo(
		() => nodes.some((n) => n.content.type === "appEntry"),
		[nodes],
	);
	const hasEndNode = useMemo(
		() => nodes.some((n) => n.content.type === "end"),
		[nodes],
	);

	const handleSelectModel = useCallback(
		(model: LanguageModel) => {
			if (generateContentNode) {
				const registryId = model.id.includes("/")
					? model.id
					: `${model.provider}/${model.id}`;
				const newNode = createContentGenerationNode({
					id: registryId as Parameters<
						typeof createContentGenerationNode
					>[0]["id"],
				});
				handleAddAndConnect(newNode);
			} else {
				const languageModelData = {
					id: model.id,
					provider: model.provider,
					configurations: model.configurations,
				};
				if (isTextGenerationLanguageModelData(languageModelData)) {
					handleAddAndConnect(createTextGenerationNode(languageModelData));
				} else if (isImageGenerationLanguageModelData(languageModelData)) {
					handleAddAndConnect(createImageGenerationNode(languageModelData));
				}
			}
		},
		[handleAddAndConnect, generateContentNode],
	);

	const handleSelectModelForAgent = useCallback(
		(model: LanguageModel) => {
			const registryId = model.id.includes("/")
				? model.id
				: `${model.provider}/${model.id}`;
			const newNode = createAiAgentNode({
				id: registryId as Parameters<typeof createAiAgentNode>[0]["id"],
			});
			handleAddAndConnect(newNode);
		},
		[handleAddAndConnect],
	);

	const handleSelectChainTemplate = useCallback(
		(template: ChainTemplate) => {
			// Create AI Agent with a reasonable default model
			const defaultModels = availableModels.filter(
				(m) => hasCapability(m, Capability.TextGeneration),
			);
			const defaultModel = defaultModels[0];
			if (!defaultModel) return;

			const registryId = defaultModel.id.includes("/")
				? defaultModel.id
				: `${defaultModel.provider}/${defaultModel.id}`;
			const newNode = createAiAgentNode({
				id: registryId as Parameters<typeof createAiAgentNode>[0]["id"],
			});
			// Pre-apply template settings to the node content
			(newNode.content as Record<string, unknown>).chainTemplateId = template.id;
			(newNode.content as Record<string, unknown>).systemPrompt = template.systemPrompt;
			(newNode.content as Record<string, unknown>).structuredOutput = template.structuredOutput;
			// Set a descriptive name
			newNode.name = template.name;
			handleAddAndConnect(newNode);
		},
		[handleAddAndConnect, availableModels],
	);

	const [aiModelMode, setAiModelMode] = useState<
		"generation" | "agent-model-picker"
	>("generation");

	// Search results for categories-level search
	const searchResults = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return null;
		const matchingModels = availableModels
			.filter(
				(m) =>
					m.id.toLowerCase().includes(q) ||
					m.provider.toLowerCase().includes(q),
			)
			.slice(0, 5);
		const matchingPieces = searchPieces(searchQuery)
			.filter((p) => isInstalledPiece(p.name))
			.slice(0, 10);
		return { models: matchingModels, pieces: matchingPieces };
	}, [searchQuery, availableModels]);

	// Header title
	const headerTitle = useMemo(() => {
		if (level === "categories") return "What happens next?";
		if (level === "ai-models" && aiModelMode === "agent-model-picker")
			return "AI Agent";
		if (level === "ai-models") return "AI Generation";
		if (level === "integrations") return "Action in an app";
		if (level === "integration-actions")
			return selectedPiece?.displayName ?? "Actions";
		if (level === "context") return "Context & Data";
		return "What happens next?";
	}, [level, selectedPiece, aiModelMode]);

	return (
		<div
			className={clsx(
				"absolute top-4 right-4 bottom-[68px] z-20",
				"w-[320px] pointer-events-auto",
			)}
		>
			<div className="h-full relative rounded-[12px] shadow-xl">
				{/* Glass background */}
				<div
					className="absolute inset-0 -z-10 rounded-[12px] pointer-events-none"
					style={{
						backgroundColor:
							"color-mix(in srgb, var(--color-background, #00020b) 60%, transparent)",
					}}
				/>
				<GlassSurfaceLayers
					tone="default"
					borderStyle="solid"
					withBaseFill={false}
					blurClass="backdrop-blur-md"
					zIndexClass="z-0"
				/>

				{/* Content */}
				<div className="h-full overflow-hidden relative z-10 flex flex-col">
					{/* Header */}
					<div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/10">
						<div className="flex items-center gap-2">
							{level !== "categories" && (
								<button
									type="button"
									onClick={() => {
										if (level === "integration-actions") {
											setLevel("integrations");
											setSelectedPiece(null);
										} else if (level === "ai-models" && aiModelMode === "agent-model-picker") {
											setAiModelMode("generation");
										} else {
											setLevel("categories");
											setAiModelMode("generation");
										}
										setSearchQuery("");
									}}
									className="p-1 rounded hover:bg-white/10 text-inverse/60 hover:text-inverse transition-colors"
								>
									<ChevronLeftIcon className="w-4 h-4" />
								</button>
							)}
							<h3 className="text-[13px] font-semibold text-inverse">
								{headerTitle}
							</h3>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="p-1 rounded hover:bg-white/10 text-inverse/60 hover:text-inverse transition-colors"
						>
							<XIcon className="w-4 h-4" />
						</button>
					</div>

					{/* Search bar (shown in all views) */}
					<div className="px-3 py-2">
						<div className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-white/5 border border-white/10">
							<SearchIcon className="w-3.5 h-3.5 text-inverse/40" />
							<input
								ref={searchInputRef}
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search..."
								className="flex-1 bg-transparent text-[12px] text-inverse placeholder:text-inverse/30 outline-none"
							/>
						</div>
					</div>

					{/* Body */}
					<div className="flex-1 overflow-y-auto px-3 pb-3">
						{/* Categories level */}
						{level === "categories" && !searchResults && (
							<div className="space-y-1 pt-1">
								{categories.map((cat) => (
									<button
										key={cat.id}
										type="button"
										onClick={() => {
											setLevel(cat.targetLevel);
											setSearchQuery("");
										}}
										className={clsx(
											"w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px]",
											"hover:bg-white/8 transition-colors text-left group/cat",
										)}
									>
										<div className="w-[36px] h-[36px] rounded-[10px] bg-white/8 flex items-center justify-center text-inverse/70 group-hover/cat:text-inverse group-hover/cat:bg-white/12 transition-colors shrink-0">
											{cat.icon}
										</div>
										<div>
											<div className="text-[13px] font-medium text-inverse">
												{cat.label}
											</div>
											<div className="text-[11px] text-inverse/50">
												{cat.description}
											</div>
										</div>
									</button>
								))}

								{/* Flow category (inline, only when stage flag is on) */}
								{stageFlag && (
									<div className="pt-2 border-t border-white/5 mt-1">
										<div className="flex items-center gap-3 px-3 py-1.5">
											<div className="w-[36px] h-[36px] rounded-[10px] bg-white/8 flex items-center justify-center text-inverse/70 shrink-0">
												<GitBranchIcon className="w-[18px] h-[18px]" />
											</div>
											<div>
												<div className="text-[13px] font-medium text-inverse">
													Flow
												</div>
												<div className="text-[11px] text-inverse/50">
													Set up workflow start and end points
												</div>
											</div>
										</div>
										<div className="flex gap-2 px-3 pt-1 pb-1 ml-[48px]">
											<button
												type="button"
												disabled={hasAppEntryNode}
												onClick={() =>
													handleAddAndConnect(createAppEntryNode())
												}
												className={clsx(
													"flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-colors",
													hasAppEntryNode
														? "bg-white/3 text-inverse/25 cursor-not-allowed"
														: "bg-white/8 text-inverse/70 hover:bg-white/12 hover:text-inverse",
												)}
											>
												<PlayIcon className="w-3 h-3" />
												Start
											</button>
											<button
												type="button"
												disabled={hasEndNode}
												onClick={() =>
													handleAddAndConnect(createEndNode())
												}
												className={clsx(
													"flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-colors",
													hasEndNode
														? "bg-white/3 text-inverse/25 cursor-not-allowed"
														: "bg-white/8 text-inverse/70 hover:bg-white/12 hover:text-inverse",
												)}
											>
												<FlagIcon className="w-3 h-3" />
												End
											</button>
										</div>
									</div>
								)}

								{/* Triggers */}
								<div className="pt-2 border-t border-white/5 mt-1">
									<div className="flex items-center gap-3 px-3 py-1.5">
										<div className="w-[36px] h-[36px] rounded-[10px] bg-white/8 flex items-center justify-center text-inverse/70 shrink-0">
											<ClockIcon className="w-[18px] h-[18px]" />
										</div>
										<div>
											<div className="text-[13px] font-medium text-inverse">
												Triggers
											</div>
											<div className="text-[11px] text-inverse/50">
												Start workflows automatically
											</div>
										</div>
									</div>
									<div className="flex gap-2 px-3 pt-1 pb-1 ml-[48px]">
										<button
											type="button"
											onClick={() =>
												handleAddAndConnect(
													createTriggerNode("schedule"),
												)
											}
											className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-medium bg-white/8 text-inverse/70 hover:bg-white/12 hover:text-inverse transition-colors"
										>
											<ClockIcon className="w-3 h-3" />
											Schedule
										</button>
										<button
											type="button"
											onClick={() =>
												handleAddAndConnect(
													createTriggerNode("webhook"),
												)
											}
											className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-medium bg-white/8 text-inverse/70 hover:bg-white/12 hover:text-inverse transition-colors"
										>
											<LinkIcon className="w-3 h-3" />
											Webhook
										</button>
									</div>
								</div>

								{/* Quick Add */}
								<div className="pt-2 border-t border-white/5 mt-2">
									<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
										Quick Add
									</div>
									<div className="grid grid-cols-2 gap-1">
										<QuickAddButton
											label="Text Input"
											onClick={() =>
												handleAddAndConnect(createTextNode())
											}
										/>
										<QuickAddButton
											label="PDF Upload"
											onClick={() =>
												handleAddAndConnect(
													createFileNode(FileCategory.enum.pdf),
												)
											}
										/>
										<QuickAddButton
											label="Web Page"
											onClick={() =>
												handleAddAndConnect(createWebPageNode())
											}
										/>
										<QuickAddButton
											label="Vector Query"
											onClick={() =>
												handleAddAndConnect(createQueryNode())
											}
										/>
										{dataStoreFlag && (
											<>
												<QuickAddButton
													label="Data Store"
													onClick={() =>
														handleAddAndConnect(
															createDataStoreNode(),
														)
													}
												/>
												<QuickAddButton
													label="Data Query"
													onClick={() =>
														handleAddAndConnect(
															createDataQueryNode(),
														)
													}
												/>
											</>
										)}
										<QuickAddButton
											label="Vector Store"
											onClick={() =>
												handleAddAndConnect(
													createDocumentVectorStoreNode(),
												)
											}
										/>
									</div>
								</div>
							</div>
						)}

						{/* Global search results (shown at categories level when searching) */}
						{level === "categories" && searchResults && (
							<div className="space-y-3 pt-1">
								{/* AI model results */}
								{searchResults.models.length > 0 && (
									<div>
										<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
											AI Models
										</div>
										<div className="space-y-0.5">
											{searchResults.models.map((model) => (
												<button
													key={model.id}
													type="button"
													onClick={() => handleSelectModel(model)}
													className={clsx(
														"w-full flex items-center gap-3 px-3 py-2 rounded-[8px]",
														"hover:bg-white/8 transition-colors text-left",
													)}
												>
													<div className="w-[28px] h-[28px] rounded-[6px] bg-white/8 flex items-center justify-center shrink-0">
														<ProviderIcon
															model={model}
															className="w-4 h-4"
														/>
													</div>
													<div className="min-w-0">
														<div className="text-[12px] font-medium text-inverse truncate">
															{model.id}
														</div>
														<div className="text-[10px] text-inverse/40 capitalize">
															{PROVIDER_LABELS[model.provider] ??
																model.provider}
														</div>
													</div>
												</button>
											))}
										</div>
									</div>
								)}

								{/* Integration results */}
								{searchResults.pieces.length > 0 && (
									<div>
										<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
											Integrations
										</div>
										<div className="space-y-0.5">
											{searchResults.pieces.map((piece) => (
												<button
													key={piece.name}
													type="button"
													onClick={() => {
														setSelectedPiece(piece);
														setLevel("integration-actions");
														setSearchQuery("");
													}}
													className={clsx(
														"w-full flex items-center gap-3 px-3 py-2 rounded-[8px]",
														"hover:bg-white/8 transition-colors text-left",
													)}
												>
													{piece.logoUrl ? (
														<img
															src={piece.logoUrl}
															alt={piece.displayName}
															className="w-[28px] h-[28px] rounded-[6px] object-contain shrink-0"
														/>
													) : (
														<div className="w-[28px] h-[28px] rounded-[6px] bg-white/8 flex items-center justify-center shrink-0">
															<GlobeIcon className="w-3.5 h-3.5 text-inverse/60" />
														</div>
													)}
													<div className="min-w-0">
														<div className="text-[12px] font-medium text-inverse truncate">
															{piece.displayName}
														</div>
														<div className="text-[10px] text-inverse/40 truncate">
															{piece.category}
														</div>
													</div>
												</button>
											))}
										</div>
									</div>
								)}

								{/* No results */}
								{searchResults.models.length === 0 &&
									searchResults.pieces.length === 0 && (
										<div className="text-center text-inverse/40 text-[12px] py-6">
											No results found
										</div>
									)}
							</div>
						)}

						{/* AI Models level */}
						{level === "ai-models" && aiModelMode === "generation" && (
							<div className="space-y-3 pt-1">
								{/* AI Agent option */}
								{!searchQuery.trim() && (
									<div>
										<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
											Agent
										</div>
										<button
											type="button"
											onClick={() => {
												setAiModelMode("agent-model-picker");
												setSearchQuery("");
											}}
											className={clsx(
												"w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px]",
												"hover:bg-white/8 transition-colors text-left group/agent",
											)}
										>
											<div className="w-[28px] h-[28px] rounded-[6px] bg-purple-500/20 flex items-center justify-center shrink-0">
												<BotIcon className="w-4 h-4 text-purple-400" />
											</div>
											<div>
												<div className="text-[12px] font-medium text-inverse">
													AI Agent
												</div>
												<div className="text-[10px] text-inverse/40">
													Multi-step reasoning with tools
												</div>
											</div>
										</button>
									</div>
								)}

								{/* Chain Templates */}
								{!searchQuery.trim() && (
									<div>
										<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
											AI Chains
										</div>
										<div className="space-y-0.5">
											{chainTemplates.map((template) => (
												<button
													key={template.id}
													type="button"
													onClick={() =>
														handleSelectChainTemplate(template)
													}
													className={clsx(
														"w-full flex items-center gap-3 px-3 py-2 rounded-[8px]",
														"hover:bg-white/8 transition-colors text-left",
													)}
												>
													<div className="w-[28px] h-[28px] rounded-[6px] bg-blue-500/20 flex items-center justify-center shrink-0">
														<SparklesIcon className="w-3.5 h-3.5 text-blue-400" />
													</div>
													<div className="min-w-0">
														<div className="text-[12px] font-medium text-inverse truncate">
															{template.name}
														</div>
														<div className="text-[10px] text-inverse/40 line-clamp-1">
															{template.description}
														</div>
													</div>
												</button>
											))}
										</div>
									</div>
								)}
								{searchQuery.trim() ? (
									/* Flat filtered list when searching */
									<div className="space-y-0.5">
										{filteredModels.map((model) => (
											<ModelRow
												key={model.id}
												model={model}
												onClick={() => handleSelectModel(model)}
											/>
										))}
										{filteredModels.length === 0 && (
											<div className="text-center text-inverse/40 text-[12px] py-6">
												No models found
											</div>
										)}
									</div>
								) : (
									/* Grouped view with Recommended section */
									<>
										{/* Recommended */}
										{recommendedModels.length > 0 && (
											<div>
												<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
													Recommended
												</div>
												<div className="space-y-0.5">
													{recommendedModels.map((model) => (
														<ModelRow
															key={`rec-${model.id}`}
															model={model}
															onClick={() =>
																handleSelectModel(model)
															}
														/>
													))}
												</div>
											</div>
										)}

										{/* Models by provider */}
										{PROVIDER_ORDER.filter(
											(p) => modelsByProvider[p]?.length,
										).map((provider) => (
											<div key={provider}>
												<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
													{PROVIDER_LABELS[provider] ?? provider}
												</div>
												<div className="space-y-0.5">
													{modelsByProvider[provider].map(
														(model) => (
															<ModelRow
																key={model.id}
																model={model}
																onClick={() =>
																	handleSelectModel(model)
																}
															/>
														),
													)}
												</div>
											</div>
										))}
									</>
								)}
							</div>
						)}

						{/* AI Agent model picker */}
						{level === "ai-models" && aiModelMode === "agent-model-picker" && (
							<div className="space-y-3 pt-1">
								<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
									Select model for AI Agent
								</div>
								{(searchQuery.trim()
									? filteredModels.filter((m) =>
											hasCapability(m, Capability.TextGeneration),
										)
									: availableModels.filter((m) =>
											hasCapability(m, Capability.TextGeneration),
										)
								).map((model) => (
									<ModelRow
										key={`agent-${model.id}`}
										model={model}
										onClick={() => handleSelectModelForAgent(model)}
									/>
								))}
							</div>
						)}

						{/* Integrations level */}
						{level === "integrations" && (
							<div className="space-y-1 pt-1">
								{filteredPieces.map((piece) => (
									<button
										key={piece.name}
										type="button"
										onClick={() => {
											setSelectedPiece(piece);
											setLevel("integration-actions");
											setSearchQuery("");
										}}
										className={clsx(
											"w-full flex items-center gap-3 px-3 py-2 rounded-[8px]",
											"hover:bg-white/8 transition-colors text-left",
										)}
									>
										{piece.logoUrl ? (
											<img
												src={piece.logoUrl}
												alt={piece.displayName}
												className="w-[28px] h-[28px] rounded-[6px] object-contain shrink-0"
											/>
										) : (
											<div className="w-[28px] h-[28px] rounded-[6px] bg-white/8 flex items-center justify-center shrink-0">
												<GlobeIcon className="w-3.5 h-3.5 text-inverse/60" />
											</div>
										)}
										<div className="min-w-0">
											<div className="text-[12px] font-medium text-inverse truncate">
												{piece.displayName}
											</div>
											<div className="text-[10px] text-inverse/40 truncate">
												{piece.category}
											</div>
										</div>
									</button>
								))}
								{filteredPieces.length === 0 && (
									<div className="text-center text-inverse/40 text-[12px] py-6">
										No integrations found
									</div>
								)}
							</div>
						)}

						{/* Integration actions level */}
						{level === "integration-actions" && selectedPiece && (
							<IntegrationActionsView
								piece={selectedPiece}
								searchQuery={searchQuery}
								onSelectAction={(actionName, version) => {
									const newNode = createIntegrationNode({
										pieceName: selectedPiece.name,
										actionName,
										pieceVersion: version,
									});
									handleAddAndConnect(newNode);
								}}
							/>
						)}

						{/* Context & Data level */}
						{level === "context" && (
							<div className="space-y-3 pt-1">
								{/* Input Sources */}
								<div>
									<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
										Input Sources
									</div>
									<div className="space-y-0.5">
										<ContextButton
											label="Plain Text"
											description="Add free-form text input"
											onClick={() =>
												handleAddAndConnect(createTextNode())
											}
										/>
										<ContextButton
											label="PDF Upload"
											description="Upload a PDF document"
											onClick={() =>
												handleAddAndConnect(
													createFileNode(FileCategory.enum.pdf),
												)
											}
										/>
										<ContextButton
											label="Image Upload"
											description="Upload an image"
											onClick={() =>
												handleAddAndConnect(
													createFileNode(FileCategory.enum.image),
												)
											}
										/>
										<ContextButton
											label="Text File"
											description="Upload a text file"
											onClick={() =>
												handleAddAndConnect(
													createFileNode(FileCategory.enum.text),
												)
											}
										/>
										<ContextButton
											label="Web Page"
											description="Fetch content from a URL"
											onClick={() =>
												handleAddAndConnect(createWebPageNode())
											}
										/>
									</div>
								</div>

								{/* Data Storage */}
								<div>
									<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
										Data Storage
									</div>
									<div className="space-y-0.5">
										<ContextButton
											label="Document Vector Store"
											description="Semantic search over documents"
											onClick={() =>
												handleAddAndConnect(
													createDocumentVectorStoreNode(),
												)
											}
										/>
										<ContextButton
											label="GitHub Vector Store"
											description="Semantic search over GitHub repos"
											onClick={() =>
												handleAddAndConnect(
													createGitHubVectorStoreNode(),
												)
											}
										/>
										{dataStoreFlag && (
											<ContextButton
												label="Data Store"
												description="Structured data storage"
												onClick={() =>
													handleAddAndConnect(
														createDataStoreNode(),
													)
												}
											/>
										)}
									</div>
								</div>

								{/* Data Retrieval */}
								<div>
									<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
										Data Retrieval
									</div>
									<div className="space-y-0.5">
										<ContextButton
											label="Vector Query"
											description="Query stored knowledge"
											onClick={() =>
												handleAddAndConnect(createQueryNode())
											}
										/>
										{dataStoreFlag && (
											<ContextButton
												label="Data Query"
												description="Query structured data"
												onClick={() =>
													handleAddAndConnect(
														createDataQueryNode(),
													)
												}
											/>
										)}
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function ModelRow({
	model,
	onClick,
}: { model: LanguageModel; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={clsx(
				"w-full flex items-center gap-3 px-3 py-2 rounded-[8px]",
				"hover:bg-white/8 transition-colors text-left",
			)}
		>
			<div className="w-[28px] h-[28px] rounded-[6px] bg-white/8 flex items-center justify-center shrink-0">
				<ProviderIcon model={model} className="w-4 h-4" />
			</div>
			<div className="min-w-0">
				<div className="text-[12px] font-medium text-inverse truncate">
					{model.id}
				</div>
				<div className="text-[10px] text-inverse/40">
					{PROVIDER_LABELS[model.provider] ?? model.provider}
				</div>
			</div>
		</button>
	);
}

function QuickAddButton({
	label,
	onClick,
}: { label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={clsx(
				"px-2.5 py-1.5 rounded-[6px] text-[11px] text-inverse/70",
				"bg-white/5 hover:bg-white/10 transition-colors text-left",
			)}
		>
			{label}
		</button>
	);
}

function ContextButton({
	label,
	description,
	onClick,
}: { label: string; description: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={clsx(
				"w-full flex flex-col gap-0.5 px-3 py-2 rounded-[8px]",
				"hover:bg-white/8 transition-colors text-left",
			)}
		>
			<div className="text-[12px] font-medium text-inverse">{label}</div>
			<div className="text-[10px] text-inverse/40">{description}</div>
		</button>
	);
}

function IntegrationActionsView({
	piece,
	searchQuery,
	onSelectAction,
}: {
	piece: PieceCatalogEntry;
	searchQuery: string;
	onSelectAction: (actionName: string, version: string) => void;
}) {
	const { actions, version, loading } = usePieceActions(piece.name);

	const filteredActions = useMemo(() => {
		if (!searchQuery.trim()) return actions;
		const q = searchQuery.toLowerCase();
		return actions.filter(
			(a) =>
				a.displayName.toLowerCase().includes(q) ||
				a.name.toLowerCase().includes(q),
		);
	}, [actions, searchQuery]);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="w-5 h-5 border-2 border-inverse/20 border-t-inverse/60 rounded-full animate-spin" />
			</div>
		);
	}

	return (
		<div className="space-y-1 pt-1">
			{filteredActions.map((action) => (
				<button
					key={action.name}
					type="button"
					onClick={() => onSelectAction(action.name, version ?? "0.0.1")}
					className={clsx(
						"w-full flex flex-col gap-0.5 px-3 py-2 rounded-[8px]",
						"hover:bg-white/8 transition-colors text-left",
					)}
				>
					<div className="text-[12px] font-medium text-inverse">
						{action.displayName}
					</div>
					{action.description && (
						<div className="text-[10px] text-inverse/40 line-clamp-2">
							{action.description}
						</div>
					)}
				</button>
			))}
			{filteredActions.length === 0 && (
				<div className="text-center text-inverse/40 text-[12px] py-6">
					No actions found
				</div>
			)}
		</div>
	);
}
