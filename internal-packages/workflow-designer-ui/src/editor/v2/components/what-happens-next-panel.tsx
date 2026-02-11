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
	type LanguageModel,
	languageModels,
} from "@giselles-ai/language-model";
import {
	createContentGenerationNode,
	createDataQueryNode,
	createDataStoreNode,
	createDocumentVectorStoreNode,
	createFileNode,
	createIntegrationNode,
	createQueryNode,
	createTextNode,
	createWebPageNode,
} from "@giselles-ai/node-registry";
import { FileCategory, type NodeId } from "@giselles-ai/protocol";
import { useFeatureFlag } from "@giselles-ai/react";
import clsx from "clsx/lite";
import {
	BrainCircuitIcon,
	CableIcon,
	ChevronLeftIcon,
	DatabaseIcon,
	FileTextIcon,
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
import { usePieceActions } from "../../tool/toolbar/integration-picker/use-piece-actions";

interface WhatHappensNextPanelProps {
	sourceNodeId: NodeId;
	onClose: () => void;
}

type PanelLevel = "categories" | "ai-models" | "integrations" | "integration-actions" | "context";

interface CategoryItem {
	id: string;
	label: string;
	description: string;
	icon: ReactNode;
	targetLevel: PanelLevel;
}

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
	const { generateContentNode, dataStore: dataStoreFlag } = useFeatureFlag();

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
			// Select the new node
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
				id: "ai-models",
				label: "AI Model",
				description: "Generate text or images with AI",
				icon: <SparklesIcon className="w-[18px] h-[18px]" />,
				targetLevel: "ai-models" as PanelLevel,
			},
			{
				id: "integrations",
				label: "Integration",
				description: "Connect to external apps & services",
				icon: <CableIcon className="w-[18px] h-[18px]" />,
				targetLevel: "integrations" as PanelLevel,
			},
			{
				id: "context",
				label: "Context Source",
				description: "Add text, files, or web content",
				icon: <FileTextIcon className="w-[18px] h-[18px]" />,
				targetLevel: "context" as PanelLevel,
			},
			{
				id: "data",
				label: "Data & Knowledge",
				description: "Vector stores, queries, data stores",
				icon: <DatabaseIcon className="w-[18px] h-[18px]" />,
				targetLevel: "context" as PanelLevel, // Handled inline
			},
		],
		[],
	);

	// Focus search on level change
	useEffect(() => {
		if (level !== "categories") {
			setTimeout(() => searchInputRef.current?.focus(), 100);
		}
	}, [level]);

	// Available AI models
	const availableModels = useMemo(
		() =>
			languageModels.filter(
				(model) =>
					llmProviders.includes(model.provider) &&
					hasCapability(model, Capability.TextGeneration),
			),
		[llmProviders],
	);

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

	const handleSelectModel = useCallback(
		(model: LanguageModel) => {
			if (generateContentNode) {
				// Construct the registry-format model ID (provider/modelId)
				const registryId = model.id.includes("/")
					? model.id
					: `${model.provider}/${model.id}`;
				const newNode = createContentGenerationNode({
					id: registryId as Parameters<typeof createContentGenerationNode>[0]["id"],
				});
				handleAddAndConnect(newNode);
			}
		},
		[handleAddAndConnect, generateContentNode],
	);

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
										} else {
											setLevel("categories");
										}
										setSearchQuery("");
									}}
									className="p-1 rounded hover:bg-white/10 text-inverse/60 hover:text-inverse transition-colors"
								>
									<ChevronLeftIcon className="w-4 h-4" />
								</button>
							)}
							<h3 className="text-[13px] font-semibold text-inverse">
								{level === "categories" && "What happens next?"}
								{level === "ai-models" && "Choose AI Model"}
								{level === "integrations" && "Choose Integration"}
								{level === "integration-actions" &&
									(selectedPiece?.displayName ?? "Actions")}
								{level === "context" && "Add Source"}
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

					{/* Search bar (shown in sub-levels) */}
					{level !== "categories" && (
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
					)}

					{/* Body */}
					<div className="flex-1 overflow-y-auto px-3 pb-3">
						{/* Categories level */}
						{level === "categories" && (
							<div className="space-y-1 pt-1">
								{categories.map((cat) => (
									<button
										key={cat.id}
										type="button"
										onClick={() => {
											if (cat.id === "data") {
												// Inline data node creation
												return;
											}
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
								{/* Quick data actions */}
								<div className="pt-2 border-t border-white/5 mt-2">
									<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wide px-3 pb-1">
										Quick Add
									</div>
									<div className="grid grid-cols-2 gap-1">
										<QuickAddButton
											label="Text Prompt"
											onClick={() => handleAddAndConnect(createTextNode())}
										/>
										<QuickAddButton
											label="PDF File"
											onClick={() =>
												handleAddAndConnect(createFileNode(FileCategory.enum.pdf))
											}
										/>
										<QuickAddButton
											label="Web Page"
											onClick={() => handleAddAndConnect(createWebPageNode())}
										/>
										<QuickAddButton
											label="Knowledge Query"
											onClick={() => handleAddAndConnect(createQueryNode())}
										/>
										{dataStoreFlag && (
											<>
												<QuickAddButton
													label="Data Store"
													onClick={() =>
														handleAddAndConnect(createDataStoreNode())
													}
												/>
												<QuickAddButton
													label="Data Query"
													onClick={() =>
														handleAddAndConnect(createDataQueryNode())
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

						{/* AI Models level */}
						{level === "ai-models" && (
							<div className="space-y-1 pt-1">
								{filteredModels.map((model) => (
									<button
										key={model.id}
										type="button"
										onClick={() => handleSelectModel(model)}
										className={clsx(
											"w-full flex items-center gap-3 px-3 py-2 rounded-[8px]",
											"hover:bg-white/8 transition-colors text-left",
										)}
									>
										<div className="w-[32px] h-[32px] rounded-[8px] bg-white/8 flex items-center justify-center shrink-0">
											<BrainCircuitIcon className="w-4 h-4 text-inverse/70" />
										</div>
										<div className="min-w-0">
											<div className="text-[12px] font-medium text-inverse truncate">
												{model.id}
											</div>
											<div className="text-[10px] text-inverse/40 capitalize">
												{model.provider}
											</div>
										</div>
									</button>
								))}
								{filteredModels.length === 0 && (
									<div className="text-center text-inverse/40 text-[12px] py-6">
										No models found
									</div>
								)}
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
												<CableIcon className="w-3.5 h-3.5 text-inverse/60" />
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

						{/* Context sources level */}
						{level === "context" && (
							<div className="space-y-1 pt-1">
								<ContextButton
									label="Text Prompt"
									description="Add free-form text input"
									onClick={() => handleAddAndConnect(createTextNode())}
								/>
								<ContextButton
									label="PDF File"
									description="Upload a PDF document"
									onClick={() =>
										handleAddAndConnect(createFileNode(FileCategory.enum.pdf))
									}
								/>
								<ContextButton
									label="Image File"
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
									label="Knowledge Query"
									description="Query stored knowledge"
									onClick={() =>
										handleAddAndConnect(createQueryNode())
									}
								/>
								{dataStoreFlag && (
									<>
										<ContextButton
											label="Data Store"
											description="Structured data storage"
											onClick={() =>
												handleAddAndConnect(createDataStoreNode())
											}
										/>
										<ContextButton
											label="Data Query"
											description="Query structured data"
											onClick={() =>
												handleAddAndConnect(createDataQueryNode())
											}
										/>
									</>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
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
