"use client";

import {
	getCatalogEntry,
	getPieceCategoryColor,
} from "@giselles-ai/activepieces-adapter";
import clsx from "clsx";
import {
	ArrowDown,
	ArrowUpDown,
	Bot,
	ChevronRight,
	Code,
	Database,
	FileText,
	Filter,
	GitBranch,
	GitMerge,
	Globe,
	Loader2,
	Pencil,
	Play,
	Plug,
	Repeat,
	Route,
	Search,
	Square,
	Type,
} from "lucide-react";
import { useMemo } from "react";

export interface PlanNode {
	tempId: string;
	name: string;
	type: string;
	provider?: string;
	modelId?: string;
	pieceName?: string;
	actionName?: string;
	promptSummary?: string;
}

export interface PlanConnection {
	from: string;
	to: string;
}

export interface WorkflowPlan {
	name: string;
	description: string;
	nodes: PlanNode[];
	connections: PlanConnection[];
}

interface WorkflowPlanPreviewProps {
	plan: WorkflowPlan;
	onApprove: () => void;
	isBuilding: boolean;
}

// Simple layout: compute layers (BFS from nodes with no incoming edges)
function computeLayers(
	nodes: PlanNode[],
	connections: PlanConnection[],
): PlanNode[][] {
	const incomingMap = new Map<string, Set<string>>();
	const outgoingMap = new Map<string, Set<string>>();
	for (const n of nodes) {
		incomingMap.set(n.tempId, new Set());
		outgoingMap.set(n.tempId, new Set());
	}
	for (const c of connections) {
		incomingMap.get(c.to)?.add(c.from);
		outgoingMap.get(c.from)?.add(c.to);
	}

	const layers: PlanNode[][] = [];
	const placed = new Set<string>();
	const nodeMap = new Map(nodes.map((n) => [n.tempId, n]));

	// BFS: start with nodes that have no incoming connections
	let current = nodes.filter(
		(n) => (incomingMap.get(n.tempId)?.size ?? 0) === 0,
	);
	while (current.length > 0) {
		layers.push(current);
		for (const n of current) placed.add(n.tempId);

		const next: PlanNode[] = [];
		const nextIds = new Set<string>();
		for (const n of current) {
			for (const targetId of outgoingMap.get(n.tempId) ?? []) {
				if (placed.has(targetId) || nextIds.has(targetId)) continue;
				// Check all incoming edges are placed
				const deps = incomingMap.get(targetId) ?? new Set();
				const allPlaced = [...deps].every(
					(d) => placed.has(d) || current.some((c) => c.tempId === d),
				);
				if (allPlaced) {
					const node = nodeMap.get(targetId);
					if (node) {
						next.push(node);
						nextIds.add(targetId);
					}
				}
			}
		}
		current = next;
	}

	// Add any remaining unplaced nodes (disconnected)
	const remaining = nodes.filter((n) => !placed.has(n.tempId));
	if (remaining.length > 0) layers.push(remaining);

	return layers;
}

function getNodeIcon(node: PlanNode) {
	switch (node.type) {
		case "appEntry":
			return <Play className="h-3.5 w-3.5" />;
		case "end":
			return <Square className="h-3.5 w-3.5" />;
		case "textGeneration":
			return <Bot className="h-3.5 w-3.5" />;
		case "imageGeneration":
			return <Bot className="h-3.5 w-3.5" />;
		case "integration":
			return <Plug className="h-3.5 w-3.5" />;
		case "text":
			return <Type className="h-3.5 w-3.5" />;
		case "file":
			return <FileText className="h-3.5 w-3.5" />;
		case "webPage":
			return <Globe className="h-3.5 w-3.5" />;
		case "query":
			return <Search className="h-3.5 w-3.5" />;
		case "vectorStore":
		case "dataStore":
			return <Database className="h-3.5 w-3.5" />;
		case "if":
			return <GitBranch className="h-3.5 w-3.5" />;
		case "switch":
			return <Route className="h-3.5 w-3.5" />;
		case "merge":
			return <GitMerge className="h-3.5 w-3.5" />;
		case "loop":
			return <Repeat className="h-3.5 w-3.5" />;
		case "code":
			return <Code className="h-3.5 w-3.5" />;
		case "filter":
			return <Filter className="h-3.5 w-3.5" />;
		case "editFields":
			return <Pencil className="h-3.5 w-3.5" />;
		case "sort":
			return <ArrowUpDown className="h-3.5 w-3.5" />;
		default:
			return <Bot className="h-3.5 w-3.5" />;
	}
}

function getNodeBorderColor(node: PlanNode): string {
	switch (node.type) {
		case "appEntry":
		case "end":
			return "border-[rgba(131,157,195,0.4)]";
		case "textGeneration":
		case "imageGeneration":
			return "border-[rgba(96,165,250,0.5)]";
		case "integration":
			return "border-[rgba(168,85,247,0.5)]";
		case "text":
		case "file":
		case "webPage":
			return "border-[rgba(74,222,128,0.4)]";
		case "query":
		case "vectorStore":
		case "dataStore":
			return "border-[rgba(251,191,36,0.4)]";
		case "if":
		case "switch":
		case "merge":
		case "loop":
		case "code":
		case "filter":
		case "editFields":
		case "sort":
			return "border-[rgba(245,158,11,0.4)]";
		default:
			return "border-[rgba(131,157,195,0.3)]";
	}
}

function getNodeBgColor(node: PlanNode): string {
	switch (node.type) {
		case "appEntry":
		case "end":
			return "bg-[rgba(131,157,195,0.08)]";
		case "textGeneration":
		case "imageGeneration":
			return "bg-[rgba(96,165,250,0.08)]";
		case "integration":
			return "bg-[rgba(168,85,247,0.08)]";
		case "text":
		case "file":
		case "webPage":
			return "bg-[rgba(74,222,128,0.06)]";
		case "query":
		case "vectorStore":
		case "dataStore":
			return "bg-[rgba(251,191,36,0.06)]";
		case "if":
		case "switch":
		case "merge":
		case "loop":
		case "code":
		case "filter":
		case "editFields":
		case "sort":
			return "bg-[rgba(245,158,11,0.06)]";
		default:
			return "bg-[rgba(131,157,195,0.06)]";
	}
}

function getTypeBadge(node: PlanNode): string {
	switch (node.type) {
		case "appEntry":
			return "Start";
		case "end":
			return "End";
		case "textGeneration":
			return "Text Gen";
		case "imageGeneration":
			return "Image Gen";
		case "integration":
			return "Integration";
		case "text":
			return "Text";
		case "file":
			return "File";
		case "webPage":
			return "Web Page";
		case "query":
			return "Query";
		case "vectorStore":
			return "Vector Store";
		case "dataStore":
			return "Data Store";
		case "if":
			return "Condition";
		case "switch":
			return "Switch";
		case "merge":
			return "Merge";
		case "loop":
			return "Loop";
		case "code":
			return "Code";
		case "filter":
			return "Filter";
		case "editFields":
			return "Edit Fields";
		case "sort":
			return "Sort";
		default:
			return node.type;
	}
}

function getProviderLabel(node: PlanNode): string | null {
	if (node.provider && node.modelId) {
		const providerNames: Record<string, string> = {
			openai: "OpenAI",
			anthropic: "Anthropic",
			google: "Google",
			perplexity: "Perplexity",
			xai: "xAI",
			nvidia: "NVIDIA",
		};
		return `${providerNames[node.provider] ?? node.provider} / ${node.modelId}`;
	}
	if (node.pieceName) {
		const entry = getCatalogEntry(node.pieceName);
		const displayName = entry?.displayName ?? node.pieceName;
		if (node.actionName) {
			return `${displayName} / ${node.actionName.replace(/_/g, " ")}`;
		}
		return displayName;
	}
	return null;
}

function NodeCard({ node }: { node: PlanNode }) {
	const providerLabel = getProviderLabel(node);
	const borderColor = getNodeBorderColor(node);
	const bgColor = getNodeBgColor(node);
	const icon = getNodeIcon(node);

	return (
		<div
			className={clsx(
				"rounded-xl border px-3.5 py-2.5 min-w-[180px] max-w-[260px]",
				borderColor,
				bgColor,
			)}
		>
			{/* Header: icon + name */}
			<div className="flex items-center gap-2 mb-1">
				<span className="text-text-muted/60 shrink-0">{icon}</span>
				<span className="text-[13px] font-medium text-text/90 truncate">
					{node.name}
				</span>
			</div>

			{/* Badges */}
			<div className="flex items-center gap-1.5 flex-wrap">
				<span className="inline-block rounded-full bg-[rgba(131,157,195,0.12)] px-2 py-0.5 text-[10px] text-text-muted/70">
					{getTypeBadge(node)}
				</span>
				{providerLabel && (
					<span className="inline-block rounded-full bg-[rgba(131,157,195,0.08)] px-2 py-0.5 text-[10px] text-text-muted/60 truncate max-w-[180px]">
						{providerLabel}
					</span>
				)}
			</div>

			{/* Prompt summary */}
			{node.promptSummary && (
				<p className="mt-1.5 text-[10px] text-text-muted/50 leading-snug line-clamp-2 italic">
					&ldquo;{node.promptSummary}&rdquo;
				</p>
			)}
		</div>
	);
}

function ConnectionArrow({ hasMultiple }: { hasMultiple: boolean }) {
	return (
		<div className="flex justify-center py-1">
			{hasMultiple ? (
				<ChevronRight className="h-3.5 w-3.5 text-text-muted/30 rotate-90" />
			) : (
				<ArrowDown className="h-3.5 w-3.5 text-text-muted/30" />
			)}
		</div>
	);
}

export function WorkflowPlanPreview({
	plan,
	onApprove,
	isBuilding,
}: WorkflowPlanPreviewProps) {
	const layers = useMemo(
		() => computeLayers(plan.nodes, plan.connections),
		[plan.nodes, plan.connections],
	);

	return (
		<div className="mt-4 rounded-xl border border-[rgba(131,157,195,0.2)] bg-[rgba(131,157,195,0.03)] overflow-hidden">
			{/* Header */}
			<div className="px-4 pt-3.5 pb-2">
				<h3 className="text-[14px] font-medium text-text/90">
					{plan.name}
				</h3>
				<p className="text-[11px] text-text-muted/60 mt-0.5 leading-relaxed">
					{plan.description}
				</p>
			</div>

			{/* Node diagram */}
			<div className="px-4 pb-3 max-h-[400px] overflow-y-auto">
				<div className="flex flex-col items-center gap-0">
					{layers.map((layer, layerIdx) => (
						<div key={`layer-${layerIdx}`}>
							{layerIdx > 0 && (
								<ConnectionArrow
									hasMultiple={layer.length > 1}
								/>
							)}
							<div
								className={clsx(
									"flex gap-2 justify-center flex-wrap",
									layer.length > 1 && "items-start",
								)}
							>
								{layer.map((node) => (
									<NodeCard key={node.tempId} node={node} />
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Stats bar */}
			<div className="px-4 py-2 border-t border-[rgba(131,157,195,0.1)] flex items-center gap-3 text-[10px] text-text-muted/50">
				<span>{plan.nodes.length} nodes</span>
				<span>&middot;</span>
				<span>{plan.connections.length} connections</span>
				{plan.nodes.some((n) => n.type === "integration") && (
					<>
						<span>&middot;</span>
						<span>
							{plan.nodes.filter((n) => n.type === "integration").length}{" "}
							integration{plan.nodes.filter((n) => n.type === "integration").length !== 1 ? "s" : ""}
						</span>
					</>
				)}
			</div>

			{/* Approve button */}
			<div className="px-4 py-3 border-t border-[rgba(131,157,195,0.1)]">
				<button
					type="button"
					onClick={onApprove}
					disabled={isBuilding}
					className={clsx(
						"w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-medium transition-all",
						isBuilding
							? "bg-[rgba(0,135,246,0.1)] text-text-muted/40 cursor-not-allowed"
							: "bg-[rgba(0,135,246,0.2)] text-[rgba(120,180,255,0.9)] hover:bg-[rgba(0,135,246,0.3)] border border-[rgba(0,135,246,0.3)]",
					)}
				>
					{isBuilding ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin" />
							Building...
						</>
					) : (
						<>
							<Play className="h-4 w-4" />
							Build this Workflow
						</>
					)}
				</button>
			</div>
		</div>
	);
}
