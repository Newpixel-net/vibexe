"use client";

import { defaultName } from "@giselles-ai/node-registry";
import type { CompletedGeneration, NodeId } from "@giselles-ai/protocol";
import { useNodeGenerations } from "@giselles-ai/react";
import {
	ArrowRightIcon,
	LinkIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAppDesignerStore } from "../../app-designer";
import { NodeIcon } from "../../icons/node";
import { EmptyState } from "../../ui/empty-state";
import { DataViewSwitcher } from "./data-views";

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
		<div className="mt-[4px] pl-[20px]">
			<DataViewSwitcher data={data} />
		</div>
	);
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
