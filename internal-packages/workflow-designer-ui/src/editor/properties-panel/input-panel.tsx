"use client";

import { defaultName } from "@vibexe-ai/node-registry";
import type { CompletedGeneration, NodeId } from "@vibexe-ai/protocol";
import { useNodeGenerations } from "@vibexe-ai/react";
import {
	ArrowRightIcon,
	LinkIcon,
	PlayIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAppDesignerStore } from "../../app-designer";
import { NodeIcon } from "../../icons/node";
import { EmptyState } from "../../ui/empty-state";
import { DataViewSwitcher } from "./data-views";

// ---- Data extraction helper ----

function extractUpstreamData(generation: CompletedGeneration, outputId?: string): unknown {
	// Filter outputs by the specific port if outputId is provided
	const outputs = outputId
		? generation.outputs.filter((o) => o.outputId === outputId)
		: generation.outputs;

	// Priority: structured-data > data-query-result > query-result > generated-text > assistant messages
	for (const output of outputs) {
		if (output.type === "structured-data") return output.data;
		if (output.type === "data-query-result") return output.content;
		if (output.type === "query-result") return output.content;
	}

	const textOutputs = outputs
		.filter((o) => o.type === "generated-text")
		.map((o) => (o.type === "generated-text" ? o.content : ""));

	if (textOutputs.length > 0) return textOutputs.join("\n\n");

	// If filtered by outputId and found nothing, try unfiltered as fallback
	if (outputId && outputs.length === 0) {
		return extractUpstreamData(generation);
	}

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

function SourceDataInspector({ sourceNodeId, outputId }: { sourceNodeId: NodeId; outputId?: string }) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const { currentGeneration } = useNodeGenerations({
		nodeId: sourceNodeId,
		origin: { type: "studio", workspaceId },
	});

	if (!currentGeneration || currentGeneration.status !== "completed") {
		return (
			<div className="text-[10px] text-inverse/25 pl-[20px] italic">
				No data yet — run workflow first
			</div>
		);
	}

	const data = extractUpstreamData(currentGeneration as CompletedGeneration, outputId);

	if (data === null || data === undefined) {
		return (
			<div className="text-[10px] text-inverse/25 pl-[20px] italic">
				Completed — no output data
			</div>
		);
	}

	return (
		<div className="mt-[4px] pl-[20px]">
			<DataViewSwitcher data={data} />
		</div>
	);
}

// ---- Main Input Panel ----

export function InputPanel({ nodeId, onExecutePrevious }: { nodeId: NodeId; onExecutePrevious?: () => void }) {
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
			{onExecutePrevious && (
				<div className="flex items-center justify-end px-[4px] pb-[4px]">
					<button
						type="button"
						onClick={onExecutePrevious}
						className="flex items-center gap-[4px] px-[8px] py-[3px] text-[11px] font-medium rounded-[4px] bg-blue-600/60 hover:bg-blue-500/70 text-white/80 transition-colors"
					>
						<PlayIcon className="size-[10px]" />
						Execute Previous Nodes
					</button>
				</div>
			)}
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
							outputId={conn.sourceOutput?.id}
						/>
					</div>
				);
			})}
		</div>
	);
}
