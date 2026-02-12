"use client";

import { defaultName } from "@giselles-ai/node-registry";
import type { CompletedGeneration, NodeId } from "@giselles-ai/protocol";
import { useNodeGenerations } from "@giselles-ai/react";
import {
	ArrowRightIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	LinkIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAppDesignerStore } from "../../app-designer";
import { NodeIcon } from "../../icons/node";
import { EmptyState } from "../../ui/empty-state";

/** Truncates long values for preview */
function truncateValue(val: unknown, maxLen = 120): string {
	if (val === null || val === undefined) return "null";
	if (typeof val === "string") {
		return val.length > maxLen ? `${val.slice(0, maxLen)}...` : val;
	}
	const json = JSON.stringify(val, null, 2);
	return json.length > maxLen ? `${json.slice(0, maxLen)}...` : json;
}

/** Shows upstream generation output data inline */
function SourceDataPreview({ sourceNodeId }: { sourceNodeId: NodeId }) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const { currentGeneration } = useNodeGenerations({
		nodeId: sourceNodeId,
		origin: { type: "studio", workspaceId },
	});
	const [expanded, setExpanded] = useState(false);

	if (!currentGeneration || currentGeneration.status !== "completed") {
		return (
			<div className="text-[10px] text-inverse/25 pl-[20px] italic">
				No data yet — run workflow first
			</div>
		);
	}

	const completed = currentGeneration as CompletedGeneration;

	// Extract text or structured data from outputs
	const textOutputs = completed.outputs
		.filter((o) => o.type === "generated-text")
		.map((o) => (o.type === "generated-text" ? o.content : ""));

	const structuredOutputs = completed.outputs.filter(
		(o) => o.type === "structured-data",
	);

	const hasData = textOutputs.length > 0 || structuredOutputs.length > 0;

	if (!hasData) {
		// Fallback: show assistant message text
		const messageText =
			"messages" in completed
				? (completed.messages
						?.filter((m) => m.role === "assistant")
						.map((m) =>
							m.parts
								?.filter((p) => p.type === "text")
								.map((p) => (p.type === "text" ? p.text : ""))
								.join(""),
						)
						.join("\n") ?? "")
				: "";

		if (!messageText) {
			return (
				<div className="text-[10px] text-inverse/25 pl-[20px] italic">
					Completed — no text output
				</div>
			);
		}

		return (
			<div className="pl-[20px] mt-[2px]">
				<button
					type="button"
					className="flex items-center gap-[2px] text-[10px] text-inverse/40 hover:text-inverse/60"
					onClick={() => setExpanded(!expanded)}
				>
					{expanded ? (
						<ChevronDownIcon className="size-[10px]" />
					) : (
						<ChevronRightIcon className="size-[10px]" />
					)}
					<span>Data preview</span>
				</button>
				{expanded && (
					<pre className="mt-[4px] p-[6px] rounded-[4px] bg-inverse/5 text-[10px] text-inverse/50 whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto">
						{truncateValue(messageText, 500)}
					</pre>
				)}
			</div>
		);
	}

	return (
		<div className="pl-[20px] mt-[2px]">
			<button
				type="button"
				className="flex items-center gap-[2px] text-[10px] text-inverse/40 hover:text-inverse/60"
				onClick={() => setExpanded(!expanded)}
			>
				{expanded ? (
					<ChevronDownIcon className="size-[10px]" />
				) : (
					<ChevronRightIcon className="size-[10px]" />
				)}
				<span>Data preview</span>
			</button>
			{expanded && (
				<div className="mt-[4px] space-y-[4px]">
					{textOutputs.map((text, idx) => (
						<pre
							key={`text-${idx}`}
							className="p-[6px] rounded-[4px] bg-inverse/5 text-[10px] text-inverse/50 whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto"
						>
							{truncateValue(text, 500)}
						</pre>
					))}
					{structuredOutputs.map((output, idx) => (
						<pre
							key={`struct-${idx}`}
							className="p-[6px] rounded-[4px] bg-blue-500/5 text-[10px] text-blue-300/60 whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto font-mono"
						>
							{truncateValue(
								output.type === "structured-data"
									? output.data
									: output,
								500,
							)}
						</pre>
					))}
				</div>
			)}
		</div>
	);
}

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
						{/* Data preview from upstream generation */}
						<SourceDataPreview
							sourceNodeId={conn.sourceNode.id as NodeId}
						/>
					</div>
				);
			})}
		</div>
	);
}
