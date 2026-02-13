"use client";

import type {
	CompletedGeneration,
	FailedGeneration,
	Generation,
	GenerationId,
	NodeId,
	OperationNode,
} from "@giselles-ai/protocol";
import { useNodeGenerations } from "@giselles-ai/react";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	BugIcon,
	CheckCircleIcon,
	DatabaseIcon,
	FileTextIcon,
	PlayIcon,
	TimerIcon,
	TrashIcon,
	XCircleIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { useAppDesignerStore, useUpdateNodeData } from "../../app-designer";
import { useGiselle } from "../../app-designer/store/giselle-client-provider";
import { useDebugSessionStore } from "../debug-session-store";
import { TextGenerationIcon } from "../../icons";
import ClipboardButton from "../../ui/clipboard-button";
import { EmptyState } from "../../ui/empty-state";
import { GenerationView } from "../../ui/generation-view";
import { ViewModeToggle, type ViewMode, SchemaTreeView, DataTableView, JsonSyntaxView } from "./data-views";

function formatTime(startedAt: number, completedAt: number): string {
	const durationMs = completedAt - startedAt;
	if (durationMs < 60000) {
		return `${durationMs.toLocaleString()}ms`;
	}
	const minutes = Math.floor(durationMs / 60000);
	const seconds = Math.floor((durationMs % 60000) / 1000);
	return `${minutes}m ${seconds}s`;
}

function getTextContent(generation: Generation): string {
	if (generation.status === "completed") {
		const completed = generation as CompletedGeneration;
		const textOutputs = completed.outputs
			.filter((output) => output.type === "generated-text")
			.map((output) => (output.type === "generated-text" ? output.content : ""))
			.join("\n\n");
		if (textOutputs) return textOutputs;
	}

	const generatedMessages =
		"messages" in generation
			? (generation.messages?.filter((m) => m.role === "assistant") ?? [])
			: [];

	return generatedMessages
		.map((message) =>
			message.parts
				?.filter((part) => part.type === "text")
				.map((part) => (part.type === "text" ? part.text : ""))
				.join("\n"),
		)
		.join("\n");
}

function getErrorContent(generation: Generation): string {
	if (generation.status === "failed") {
		const failed = generation as FailedGeneration;
		return `${failed.error.name}: ${failed.error.message}`;
	}
	return "";
}

type OutputTab = "text" | "data";

/** Extract structured data from a completed generation */
function extractOutputData(generation: CompletedGeneration): unknown | null {
	for (const output of generation.outputs) {
		if (output.type === "structured-data") return output.data;
		if (output.type === "data-query-result") return output.content;
		if (output.type === "query-result") return output.content;
	}
	return null;
}

/** Tab switcher for Text vs Data views in output panel */
function OutputTabSwitcher({
	activeTab,
	onTabChange,
	hasData,
	itemCount,
}: {
	activeTab: OutputTab;
	onTabChange: (tab: OutputTab) => void;
	hasData: boolean;
	itemCount?: number;
}) {
	return (
		<div className="flex items-center gap-[2px] px-[10px] py-[4px] border-b border-inverse/5">
			<button
				type="button"
				onClick={() => onTabChange("text")}
				className={`px-[8px] py-[3px] text-[10px] rounded-[4px] transition-colors ${
					activeTab === "text"
						? "bg-inverse/10 text-inverse/70 font-medium"
						: "text-inverse/30 hover:text-inverse/50"
				}`}
			>
				<FileTextIcon className="size-[10px] inline mr-[3px]" />
				Text
			</button>
			{hasData && (
				<button
					type="button"
					onClick={() => onTabChange("data")}
					className={`px-[8px] py-[3px] text-[10px] rounded-[4px] transition-colors ${
						activeTab === "data"
							? "bg-inverse/10 text-inverse/70 font-medium"
							: "text-inverse/30 hover:text-inverse/50"
					}`}
				>
					<DatabaseIcon className="size-[10px] inline mr-[3px]" />
					Data
					{itemCount != null && itemCount > 0 && (
						<span className="ml-[3px] px-[4px] py-[0px] rounded-full bg-blue-500/15 text-blue-400 text-[8px]">
							{itemCount}
						</span>
					)}
				</button>
			)}
		</div>
	);
}

/** Mock data editor for testing nodes without executing */
function MockDataSection({ node }: { node: OperationNode }) {
	const updateNodeData = useUpdateNodeData();
	const [showEditor, setShowEditor] = useState(false);
	const [draft, setDraft] = useState(() =>
		node.mockData != null ? JSON.stringify(node.mockData, null, 2) : "",
	);
	const [parseError, setParseError] = useState<string | null>(null);

	const hasMock = node.mockData != null;

	const handleSave = useCallback(() => {
		try {
			const parsed = JSON.parse(draft);
			setParseError(null);
			updateNodeData(node, { mockData: parsed } as any);
			setShowEditor(false);
		} catch (e) {
			setParseError((e as Error).message);
		}
	}, [draft, node, updateNodeData]);

	const handleClear = useCallback(() => {
		updateNodeData(node, { mockData: undefined } as any);
		setDraft("");
		setShowEditor(false);
		setParseError(null);
	}, [node, updateNodeData]);

	return (
		<div className="border-t border-inverse/5 px-[10px] py-[6px]">
			<div className="flex items-center gap-[4px]">
				<button
					type="button"
					className="flex items-center gap-[4px] text-[11px] text-inverse/50 hover:text-inverse/70"
					onClick={() => setShowEditor(!showEditor)}
				>
					<DatabaseIcon className="size-[10px]" />
					{hasMock ? "Mock Data Active" : "Set Mock Data"}
				</button>
				{hasMock && (
					<>
						<span className="px-[4px] py-[1px] rounded-[3px] bg-yellow-500/20 text-yellow-400 text-[9px] font-medium">
							MOCK
						</span>
						<button
							type="button"
							className="ml-auto text-[10px] text-red-400/60 hover:text-red-400"
							onClick={handleClear}
							title="Clear mock data"
						>
							<TrashIcon className="size-[10px]" />
						</button>
					</>
				)}
			</div>
			{showEditor && (
				<div className="mt-[6px] flex flex-col gap-[4px]">
					<textarea
						className="w-full h-[120px] p-[6px] rounded-[4px] bg-black/30 border border-inverse/10 text-[10px] text-inverse/80 font-mono resize-y outline-none focus:border-blue-500/50"
						value={draft}
						onChange={(e) => {
							setDraft(e.target.value);
							setParseError(null);
						}}
						placeholder='{"key": "value"}'
					/>
					{parseError && (
						<p className="text-[10px] text-red-400">{parseError}</p>
					)}
					<div className="flex gap-[4px] justify-end">
						<button
							type="button"
							className="px-[8px] py-[2px] text-[10px] rounded-[3px] bg-inverse/10 text-inverse/60 hover:bg-inverse/20"
							onClick={() => setShowEditor(false)}
						>
							Cancel
						</button>
						<button
							type="button"
							className="px-[8px] py-[2px] text-[10px] rounded-[3px] bg-blue-600/60 text-white hover:bg-blue-500/70"
							onClick={handleSave}
						>
							Save Mock
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

/** Debug-mode generation fetcher — loads generation from a past task */
function useDebugGeneration(nodeId: NodeId): Generation | undefined {
	const client = useGiselle();
	const debugSession = useDebugSessionStore((s) => s.debugSession);

	// Find generation for this node in the debug session
	const debugGenId = debugSession?.nodeGenerationMap[nodeId] ?? null;

	const { data } = useSWR<Generation>(
		debugGenId
			? { namespace: "debugGeneration", generationId: debugGenId }
			: null,
		() => client.getGeneration({ generationId: debugGenId as GenerationId }),
	);

	return data ?? undefined;
}

export function OutputPanel({
	nodeId,
	onExecuteStep,
	node,
}: {
	nodeId: NodeId;
	onExecuteStep?: () => void;
	node?: OperationNode;
}) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const debugSession = useDebugSessionStore((s) => s.debugSession);
	const debugGeneration = useDebugGeneration(nodeId);
	const { currentGeneration: liveGeneration } = useNodeGenerations({
		nodeId,
		origin: { type: "studio", workspaceId },
	});

	// In debug mode, prefer the debug generation
	const currentGeneration = debugSession ? debugGeneration : liveGeneration;

	const isRunning =
		currentGeneration?.status === "created" ||
		currentGeneration?.status === "queued" ||
		currentGeneration?.status === "running";

	if (!currentGeneration) {
		return (
			<div className="flex flex-col h-full">
				{/* Execute Step button when no output */}
				{onExecuteStep && (
					<div className="flex items-center gap-[6px] px-[10px] py-[6px] border-b border-inverse/10">
						<div className="flex-1" />
						<button
							type="button"
							onClick={onExecuteStep}
							className="flex items-center gap-[4px] px-[8px] py-[3px] text-[11px] font-medium rounded-[4px] bg-blue-600/80 hover:bg-blue-500/80 text-white transition-colors"
						>
							<PlayIcon className="size-[10px]" />
							Execute Step
						</button>
					</div>
				)}
				<div className="flex-1 p-[12px]">
					<EmptyState
						icon={<TextGenerationIcon width={16} height={16} />}
						title="No output yet"
						description="Run the node to see results."
						className="text-inverse/40"
					/>
				</div>
				{/* Mock data editor */}
				{node && <MockDataSection node={node} />}
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Debug mode indicator */}
			{debugSession && (
				<div className="flex items-center gap-[4px] px-[10px] py-[4px] bg-purple-600/10 border-b border-purple-500/20">
					<BugIcon className="size-[10px] text-purple-400" />
					<span className="text-[10px] text-purple-400">Debug mode — showing data from past run</span>
				</div>
			)}
			{/* Status bar */}
			<div className="flex items-center gap-[6px] px-[10px] py-[6px] border-b border-inverse/10">
				{isRunning && (
					<>
						<div className="size-[6px] rounded-full bg-yellow-400 animate-pulse" />
						<span className="text-[11px] text-inverse/60">Running...</span>
					</>
				)}
				{currentGeneration.status === "completed" && (
					<>
						<CheckCircleIcon className="size-[12px] text-green-400" />
						<span className="text-[11px] text-inverse/60">Completed</span>
					</>
				)}
				{currentGeneration.status === "failed" && (
					<>
						<XCircleIcon className="size-[12px] text-red-400" />
						<span className="text-[11px] text-inverse/60">Failed</span>
					</>
				)}
				{currentGeneration.status === "cancelled" && (
					<span className="text-[11px] text-inverse/40">Cancelled</span>
				)}

				<div className="flex-1" />

				{/* Execute Step / Stop button */}
				{onExecuteStep && !isRunning && (
					<button
						type="button"
						onClick={onExecuteStep}
						className="flex items-center gap-[4px] px-[6px] py-[2px] text-[10px] font-medium rounded-[3px] bg-blue-600/60 hover:bg-blue-500/70 text-white/80 transition-colors"
						title="Re-execute this step"
					>
						<PlayIcon className="size-[8px]" />
						Run
					</button>
				)}

				{(currentGeneration.status === "completed" ||
					currentGeneration.status === "cancelled") && (
					<ClipboardButton
						text={getTextContent(currentGeneration)}
						tooltip="Copy output"
						className="text-inverse/40 hover:text-inverse/60"
					/>
				)}
				{currentGeneration.status === "failed" && (
					<ClipboardButton
						text={getErrorContent(currentGeneration)}
						tooltip="Copy error"
						className="text-inverse/40 hover:text-inverse/60"
					/>
				)}
			</div>

			{/* Metrics */}
			{currentGeneration.status === "completed" &&
				currentGeneration.usage && (
					<div className="flex items-center gap-[8px] px-[10px] py-[4px] border-b border-inverse/5 text-[10px] text-inverse/40">
						{currentGeneration.startedAt &&
							currentGeneration.completedAt && (
								<span className="flex items-center gap-[2px]">
									<TimerIcon className="size-[10px]" />
									{formatTime(
										currentGeneration.startedAt,
										currentGeneration.completedAt,
									)}
								</span>
							)}
						{currentGeneration.usage.inputTokens != null && (
							<span className="flex items-center gap-[2px]">
								<ArrowUpIcon className="size-[10px]" />
								{currentGeneration.usage.inputTokens.toLocaleString()}t
							</span>
						)}
						{currentGeneration.usage.outputTokens != null && (
							<span className="flex items-center gap-[2px]">
								<ArrowDownIcon className="size-[10px]" />
								{currentGeneration.usage.outputTokens.toLocaleString()}t
							</span>
						)}
					</div>
				)}

			{/* Content with Text/Data tab switching */}
			<OutputContent
				currentGeneration={currentGeneration}
				node={node}
			/>
		</div>
	);
}

/** Manages the Text/Data tab for completed output display */
function OutputContent({
	currentGeneration,
	node,
}: {
	currentGeneration: Generation;
	node?: OperationNode;
}) {
	const [activeTab, setActiveTab] = useState<OutputTab>("text");
	const [dataViewMode, setDataViewMode] = useState<ViewMode>("schema");

	const structuredData = useMemo(() => {
		if (currentGeneration.status !== "completed") return null;
		return extractOutputData(currentGeneration as CompletedGeneration);
	}, [currentGeneration]);

	const hasData = structuredData != null;
	const itemCount = Array.isArray(structuredData)
		? structuredData.length
		: undefined;

	return (
		<>
			{/* Tab switcher — only when there's structured data */}
			{currentGeneration.status === "completed" && hasData && (
				<OutputTabSwitcher
					activeTab={activeTab}
					onTabChange={setActiveTab}
					hasData={hasData}
					itemCount={itemCount}
				/>
			)}

			{/* Tab content */}
			<div className="flex-1 overflow-y-auto">
				{activeTab === "text" && (
					<div className="p-[8px]">
						<div className="text-[12px]">
							<GenerationView generation={currentGeneration} />
						</div>
					</div>
				)}
				{activeTab === "data" && hasData && (
					<div className="p-[8px]">
						{/* View mode toggle */}
						<div className="mb-[6px]">
							<ViewModeToggle
								viewMode={dataViewMode}
								onViewModeChange={setDataViewMode}
								itemCount={itemCount}
							/>
						</div>
						{/* Data view */}
						<div className="rounded-[4px] bg-inverse/5 overflow-hidden">
							{dataViewMode === "schema" && (
								<SchemaTreeView data={structuredData} />
							)}
							{dataViewMode === "table" && (
								<DataTableView data={structuredData} />
							)}
							{dataViewMode === "json" && (
								<JsonSyntaxView data={structuredData} />
							)}
						</div>
					</div>
				)}
			</div>

			{/* Mock data editor */}
			{node && <MockDataSection node={node} />}
		</>
	);
}
