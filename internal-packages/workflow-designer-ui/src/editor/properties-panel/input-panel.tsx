"use client";

import { defaultName } from "@giselles-ai/node-registry";
import type { CompletedGeneration, NodeId } from "@giselles-ai/protocol";
import { useNodeGenerations } from "@giselles-ai/react";
import {
	ArrowRightIcon,
	BracesIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	CopyIcon,
	HashIcon,
	LinkIcon,
	ListIcon,
	TableIcon,
	ToggleLeftIcon,
	TypeIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAppDesignerStore } from "../../app-designer";
import { NodeIcon } from "../../icons/node";
import { EmptyState } from "../../ui/empty-state";

type ViewMode = "schema" | "table" | "json";

// ---- Utility functions ----

function inferType(val: unknown): string {
	if (val === null) return "null";
	if (val === undefined) return "undefined";
	if (Array.isArray(val)) return "array";
	return typeof val;
}

function TypeBadge({ type }: { type: string }) {
	const config: Record<string, { icon: React.ReactNode; color: string }> = {
		string: { icon: <TypeIcon className="size-[9px]" />, color: "text-green-400" },
		number: { icon: <HashIcon className="size-[9px]" />, color: "text-orange-400" },
		boolean: { icon: <ToggleLeftIcon className="size-[9px]" />, color: "text-blue-400" },
		array: { icon: <ListIcon className="size-[9px]" />, color: "text-purple-400" },
		object: { icon: <BracesIcon className="size-[9px]" />, color: "text-yellow-400" },
		null: { icon: null, color: "text-inverse/30" },
		undefined: { icon: null, color: "text-inverse/20" },
	};
	const c = config[type] ?? { icon: null, color: "text-inverse/40" };
	return (
		<span className={`inline-flex items-center gap-0.5 text-[9px] font-mono ${c.color}`}>
			{c.icon}
			{type}
		</span>
	);
}

// ---- Schema Tree View ----

function SchemaTreeNode({ name, value, depth }: { name: string; value: unknown; depth: number }) {
	const [expanded, setExpanded] = useState(depth < 2);
	const type = inferType(value);
	const isExpandable = type === "object" || type === "array";
	const truncated =
		type === "string"
			? (value as string).length > 60
				? `"${(value as string).slice(0, 60)}..."`
				: `"${value}"`
			: type === "number" || type === "boolean"
				? String(value)
				: type === "null"
					? "null"
					: null;

	return (
		<div style={{ paddingLeft: `${depth * 12}px` }}>
			<div className="flex items-center gap-1.5 py-[2px]">
				{isExpandable ? (
					<button
						type="button"
						onClick={() => setExpanded(!expanded)}
						className="text-inverse/30 hover:text-inverse/60"
					>
						{expanded ? (
							<ChevronDownIcon className="size-[10px]" />
						) : (
							<ChevronRightIcon className="size-[10px]" />
						)}
					</button>
				) : (
					<span className="w-[10px]" />
				)}
				<span className="text-[11px] text-inverse/70 font-medium">{name}</span>
				<TypeBadge type={type} />
				{type === "array" && (
					<span className="px-1 py-[0px] rounded-[3px] bg-purple-500/10 text-purple-400 text-[8px]">
						{(value as unknown[]).length}
					</span>
				)}
				{truncated && (
					<span className="text-[10px] text-inverse/30 truncate max-w-[180px]">
						{truncated}
					</span>
				)}
			</div>
			{isExpandable && expanded && (
				<div>
					{type === "object" &&
						value != null &&
						Object.entries(value as Record<string, unknown>).map(([k, v]) => (
							<SchemaTreeNode key={k} name={k} value={v} depth={depth + 1} />
						))}
					{type === "array" &&
						(value as unknown[]).slice(0, 20).map((item, idx) => (
							<SchemaTreeNode
								key={`${idx}`}
								name={`[${idx}]`}
								value={item}
								depth={depth + 1}
							/>
						))}
					{type === "array" && (value as unknown[]).length > 20 && (
						<div
							style={{ paddingLeft: `${(depth + 1) * 12}px` }}
							className="text-[10px] text-inverse/25 italic py-[2px]"
						>
							...and {(value as unknown[]).length - 20} more items
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function SchemaTreeView({ data }: { data: unknown }) {
	if (data === null || data === undefined) {
		return <div className="text-[10px] text-inverse/25 italic p-2">No data</div>;
	}

	if (typeof data === "object" && !Array.isArray(data)) {
		return (
			<div className="py-1">
				{Object.entries(data as Record<string, unknown>).map(([k, v]) => (
					<SchemaTreeNode key={k} name={k} value={v} depth={0} />
				))}
			</div>
		);
	}

	return <SchemaTreeNode name="data" value={data} depth={0} />;
}

// ---- Table View ----

function DataTableView({ data }: { data: unknown }) {
	const MAX_ROWS = 50;
	const [showAll, setShowAll] = useState(false);

	if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
		// Array of objects -> table
		const allKeys = new Set<string>();
		for (const row of data) {
			if (row && typeof row === "object") {
				for (const key of Object.keys(row as Record<string, unknown>)) {
					allKeys.add(key);
				}
			}
		}
		const columns = Array.from(allKeys);
		const visibleRows = showAll ? data : data.slice(0, MAX_ROWS);

		return (
			<div className="overflow-x-auto">
				<table className="w-full text-[10px]">
					<thead>
						<tr className="border-b border-inverse/10">
							{columns.map((col) => (
								<th
									key={col}
									className="px-2 py-1.5 text-left font-medium text-inverse/50 whitespace-nowrap"
								>
									{col}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{visibleRows.map((row, idx) => (
							<tr key={`row-${idx}`} className="border-b border-inverse/5 hover:bg-inverse/5">
								{columns.map((col) => {
									const val = (row as Record<string, unknown>)?.[col];
									const display =
										val === null
											? "null"
											: val === undefined
												? ""
												: typeof val === "object"
													? JSON.stringify(val)
													: String(val);
									return (
										<td
											key={col}
											className="px-2 py-1 text-inverse/60 max-w-[200px] truncate"
											title={display}
										>
											{display}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
				{!showAll && data.length > MAX_ROWS && (
					<button
						type="button"
						onClick={() => setShowAll(true)}
						className="w-full py-1.5 text-[10px] text-blue-400 hover:text-blue-300 text-center"
					>
						Show all {data.length} rows
					</button>
				)}
			</div>
		);
	}

	// Non-array or primitive array: single-row key-value table
	if (data && typeof data === "object" && !Array.isArray(data)) {
		const entries = Object.entries(data as Record<string, unknown>);
		return (
			<div className="overflow-x-auto">
				<table className="w-full text-[10px]">
					<thead>
						<tr className="border-b border-inverse/10">
							<th className="px-2 py-1.5 text-left font-medium text-inverse/50">Key</th>
							<th className="px-2 py-1.5 text-left font-medium text-inverse/50">Value</th>
						</tr>
					</thead>
					<tbody>
						{entries.map(([k, v]) => (
							<tr key={k} className="border-b border-inverse/5">
								<td className="px-2 py-1 text-inverse/60 font-medium">{k}</td>
								<td className="px-2 py-1 text-inverse/50 max-w-[250px] truncate">
									{v === null ? "null" : typeof v === "object" ? JSON.stringify(v) : String(v)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	}

	return <div className="text-[10px] text-inverse/25 italic p-2">Data is not table-friendly</div>;
}

// ---- JSON Syntax View ----

function JsonValue({ value, depth }: { value: unknown; depth: number }) {
	const [collapsed, setCollapsed] = useState(depth > 2);

	if (value === null) return <span className="text-inverse/30">null</span>;
	if (value === undefined) return <span className="text-inverse/20">undefined</span>;
	if (typeof value === "string")
		return <span className="text-green-400">&quot;{value.length > 200 ? `${value.slice(0, 200)}...` : value}&quot;</span>;
	if (typeof value === "number") return <span className="text-orange-400">{String(value)}</span>;
	if (typeof value === "boolean") return <span className="text-blue-400">{String(value)}</span>;

	if (Array.isArray(value)) {
		if (value.length === 0) return <span className="text-inverse/40">[]</span>;
		if (collapsed) {
			return (
				<button type="button" onClick={() => setCollapsed(false)} className="text-inverse/40 hover:text-inverse/60">
					[...{value.length} items]
				</button>
			);
		}
		return (
			<span>
				<button type="button" onClick={() => setCollapsed(true)} className="text-inverse/40 hover:text-inverse/60">[</button>
				<div style={{ paddingLeft: "12px" }}>
					{value.map((item, i) => (
						<div key={`${i}`}>
							<JsonValue value={item} depth={depth + 1} />
							{i < value.length - 1 && <span className="text-inverse/20">,</span>}
						</div>
					))}
				</div>
				<span className="text-inverse/40">]</span>
			</span>
		);
	}

	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>);
		if (entries.length === 0) return <span className="text-inverse/40">{"{}"}</span>;
		if (collapsed) {
			return (
				<button type="button" onClick={() => setCollapsed(false)} className="text-inverse/40 hover:text-inverse/60">
					{"{"}...{entries.length} keys{"}"}
				</button>
			);
		}
		return (
			<span>
				<button type="button" onClick={() => setCollapsed(true)} className="text-inverse/40 hover:text-inverse/60">{"{"}</button>
				<div style={{ paddingLeft: "12px" }}>
					{entries.map(([k, v], i) => (
						<div key={k}>
							<span className="text-purple-400">&quot;{k}&quot;</span>
							<span className="text-inverse/30">: </span>
							<JsonValue value={v} depth={depth + 1} />
							{i < entries.length - 1 && <span className="text-inverse/20">,</span>}
						</div>
					))}
				</div>
				<span className="text-inverse/40">{"}"}</span>
			</span>
		);
	}

	return <span className="text-inverse/40">{String(value)}</span>;
}

function JsonSyntaxView({ data }: { data: unknown }) {
	const jsonStr = useMemo(() => {
		try {
			return JSON.stringify(data, null, 2);
		} catch {
			return String(data);
		}
	}, [data]);

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(jsonStr);
	}, [jsonStr]);

	return (
		<div className="relative group">
			<div className="font-mono text-[10px] leading-[16px] whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto p-2">
				<JsonValue value={data} depth={0} />
			</div>
			<button
				type="button"
				onClick={handleCopy}
				className="absolute top-1 right-1 p-1 rounded bg-inverse/10 opacity-0 group-hover:opacity-100 transition-opacity text-inverse/30 hover:text-inverse/60"
				title="Copy JSON"
			>
				<CopyIcon className="size-3" />
			</button>
		</div>
	);
}

// ---- Data extraction helper ----

function extractUpstreamData(generation: CompletedGeneration): unknown {
	// Priority: structured-data > data-query-result > query-result > generated-text > assistant messages
	for (const output of generation.outputs) {
		if (output.type === "structured-data") return output.data;
		if (output.type === "data-query-result") return output.content;
		if (output.type === "query-result") return output.content;
	}

	const textOutputs = generation.outputs
		.filter((o) => o.type === "generated-text")
		.map((o) => (o.type === "generated-text" ? o.content : ""));

	if (textOutputs.length > 0) return textOutputs.join("\n\n");

	// Fallback: assistant messages
	if ("messages" in generation) {
		return (
			generation.messages
				?.filter((m) => m.role === "assistant")
				.map((m) =>
					m.parts
						?.filter((p) => p.type === "text")
						.map((p) => (p.type === "text" ? p.text : ""))
						.join(""),
				)
				.join("\n") ?? null
		);
	}
	return null;
}

// ---- Source Data with View Modes ----

function SourceDataInspector({ sourceNodeId }: { sourceNodeId: NodeId }) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const { currentGeneration } = useNodeGenerations({
		nodeId: sourceNodeId,
		origin: { type: "studio", workspaceId },
	});
	const [viewMode, setViewMode] = useState<ViewMode>("schema");

	if (!currentGeneration || currentGeneration.status !== "completed") {
		return (
			<div className="text-[10px] text-inverse/25 pl-[20px] italic">
				No data yet — run workflow first
			</div>
		);
	}

	const data = extractUpstreamData(currentGeneration as CompletedGeneration);

	if (data === null || data === undefined) {
		return (
			<div className="text-[10px] text-inverse/25 pl-[20px] italic">
				Completed — no output data
			</div>
		);
	}

	return (
		<div className="mt-[4px]">
			{/* View mode toggle */}
			<div className="flex items-center gap-[2px] pl-[20px] mb-[4px]">
				{(["schema", "table", "json"] as ViewMode[]).map((mode) => (
					<button
						key={mode}
						type="button"
						onClick={() => setViewMode(mode)}
						className={`px-[6px] py-[2px] text-[9px] rounded-[3px] capitalize transition-colors ${
							viewMode === mode
								? "bg-inverse/10 text-inverse/70"
								: "text-inverse/30 hover:text-inverse/50"
						}`}
					>
						{mode === "schema" && <BracesIcon className="size-[9px] inline mr-[2px]" />}
						{mode === "table" && <TableIcon className="size-[9px] inline mr-[2px]" />}
						{mode === "json" && <BracesIcon className="size-[9px] inline mr-[2px]" />}
						{mode}
					</button>
				))}
			</div>

			{/* View content */}
			<div className="ml-[20px] rounded-[4px] bg-inverse/5 overflow-hidden">
				{viewMode === "schema" && <SchemaTreeView data={data} />}
				{viewMode === "table" && <DataTableView data={data} />}
				{viewMode === "json" && <JsonSyntaxView data={data} />}
			</div>
		</div>
	);
}

// ---- Debug-aware Source Inspector ----
// When in debug mode, uses the generation from the debug session instead of latest

function DebugSourceDataInspector({
	sourceNodeId,
	debugGenerationId,
}: {
	sourceNodeId: NodeId;
	debugGenerationId?: string;
}) {
	// If there's no debug generation, fall back to normal
	if (!debugGenerationId) {
		return <SourceDataInspector sourceNodeId={sourceNodeId} />;
	}
	return <SourceDataInspector sourceNodeId={sourceNodeId} />;
}

// ---- Main Input Panel ----

export function InputPanel({ nodeId }: { nodeId: NodeId }) {
	const { nodes, connections } = useAppDesignerStore((s) => ({
		nodes: s.nodes,
		connections: s.connections,
	}));

	const inputConnections = useMemo(() => {
		const conns = connections.filter(
			(c) =>
				c.inputNode.id === nodeId && c.connectionType !== "subNode",
		);

		return conns
			.map((conn) => {
				const sourceNode = nodes.find(
					(n) => n.id === conn.outputNode.id,
				);
				if (!sourceNode) return null;

				const sourceOutput = sourceNode.outputs.find(
					(o) => o.id === conn.outputId,
				);
				const targetInput = nodes
					.find((n) => n.id === nodeId)
					?.inputs.find((i) => i.id === conn.inputId);

				return {
					connectionId: conn.id,
					sourceNode,
					sourceOutput,
					targetInput,
				};
			})
			.filter(Boolean);
	}, [connections, nodes, nodeId]);

	if (inputConnections.length === 0) {
		return (
			<div className="p-[12px]">
				<EmptyState
					icon={<LinkIcon className="size-[16px]" />}
					title="No inputs connected"
					description="Connect nodes to provide input data."
					className="text-inverse/40"
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-[2px] p-[8px]">
			{inputConnections.map((conn) => {
				if (!conn) return null;
				return (
					<div
						key={conn.connectionId}
						className="flex flex-col gap-[4px] rounded-[6px] bg-inverse/5 p-[8px]"
					>
						<div className="flex items-center gap-[6px]">
							<NodeIcon
								node={conn.sourceNode}
								className="size-[14px] text-inverse/60"
							/>
							<span className="text-[12px] text-inverse/80 font-medium truncate">
								{defaultName(conn.sourceNode)}
							</span>
							<ArrowRightIcon className="size-[10px] text-inverse/30 flex-shrink-0" />
							<span className="text-[11px] text-inverse/50 truncate">
								{conn.targetInput?.accessor ?? "input"}
							</span>
						</div>
						{conn.sourceOutput && (
							<div className="text-[10px] text-inverse/40 pl-[20px]">
								output: {conn.sourceOutput.accessor}
							</div>
						)}
						{/* Data inspector with Schema/Table/JSON views */}
						<SourceDataInspector
							sourceNodeId={conn.sourceNode.id as NodeId}
						/>
					</div>
				);
			})}
		</div>
	);
}
