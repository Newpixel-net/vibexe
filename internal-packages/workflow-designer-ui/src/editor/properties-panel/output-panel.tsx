"use client";

import type {
	CompletedGeneration,
	FailedGeneration,
	Generation,
	NodeId,
} from "@giselles-ai/protocol";
import { useNodeGenerations } from "@giselles-ai/react";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckCircleIcon,
	TimerIcon,
	XCircleIcon,
} from "lucide-react";
import { useAppDesignerStore } from "../../app-designer";
import { TextGenerationIcon } from "../../icons";
import ClipboardButton from "../../ui/clipboard-button";
import { EmptyState } from "../../ui/empty-state";
import { GenerationView } from "../../ui/generation-view";

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

export function OutputPanel({ nodeId }: { nodeId: NodeId }) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const { currentGeneration } = useNodeGenerations({
		nodeId,
		origin: { type: "studio", workspaceId },
	});

	if (!currentGeneration) {
		return (
			<div className="p-[12px]">
				<EmptyState
					icon={<TextGenerationIcon width={16} height={16} />}
					title="No output yet"
					description="Run the node to see results."
					className="text-inverse/40"
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Status bar */}
			<div className="flex items-center gap-[6px] px-[10px] py-[6px] border-b border-inverse/10">
				{(currentGeneration.status === "created" ||
					currentGeneration.status === "queued" ||
					currentGeneration.status === "running") && (
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

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-[8px]">
				<div className="text-[12px]">
					<GenerationView generation={currentGeneration} />
				</div>
			</div>
		</div>
	);
}
