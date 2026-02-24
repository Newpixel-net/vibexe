import type {
	CompletedGeneration,
	FailedGeneration,
	Generation,
	NodeId,
} from "@vibexe-ai/protocol";
import { useNodeGenerations } from "@vibexe-ai/react";
import clsx from "clsx/lite";
import { ArrowDownIcon, ArrowUpIcon, TimerIcon } from "lucide-react";
import { useAppDesignerStore } from "../../../app-designer";
import { TextGenerationIcon } from "../../../icons";
import ClipboardButton from "../../../ui/clipboard-button";
import { EmptyState } from "../../../ui/empty-state";
import { GenerationView } from "../../../ui/generation-view";

function Empty() {
	return (
		<div className="relative bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] rounded-[8px] flex justify-center items-center text-text-muted py-[24px]">
			<EmptyState
				icon={<TextGenerationIcon width={24} height={24} />}
				title="Nothing generated yet."
				description="Run the agent to see results."
				className="text-text-muted"
			/>
		</div>
	);
}

function formatExecutionTime(startedAt: number, completedAt: number): string {
	const durationMs = completedAt - startedAt;
	if (durationMs < 60000) {
		return `${durationMs.toLocaleString()}ms`;
	}
	const minutes = Math.floor(durationMs / 60000);
	const seconds = Math.floor((durationMs % 60000) / 1000);
	return `${minutes}m ${seconds}s`;
}

function getGenerationTextContent(generation: Generation): string {
	if (generation.status === "completed") {
		const completedGeneration = generation as CompletedGeneration;
		const textOutputs = completedGeneration.outputs
			.filter((output) => output.type === "generated-text")
			.map((output) => (output.type === "generated-text" ? output.content : ""))
			.join("\n\n");

		if (textOutputs) {
			return textOutputs;
		}
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

function getGenerationErrorContent(generation: Generation): string {
	if (generation.status === "failed") {
		const failedGeneration = generation as FailedGeneration;
		const error = failedGeneration.error;
		return `${error.name}: ${error.message}`;
	}
	return "";
}

export function AgentOutputPanel({ nodeId }: { nodeId: NodeId }) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const { currentGeneration } = useNodeGenerations({
		nodeId,
		origin: { type: "studio", workspaceId },
	});

	if (currentGeneration === undefined) {
		return <Empty />;
	}
	return (
		<div className="relative flex flex-col bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] rounded-[8px] py-[8px]">
			<div
				className={clsx(
					"border-b border-white-400/20 py-[4px] px-[16px] flex items-center gap-[8px]",
					"**:data-header-text:font-[700]",
				)}
			>
				<div className="flex-1 flex items-center gap-[8px]">
					{(currentGeneration.status === "created" ||
						currentGeneration.status === "queued" ||
						currentGeneration.status === "running") && (
						<p data-header-text>Running agent...</p>
					)}
					{(currentGeneration.status as string) === "awaiting_review" && (
						<p data-header-text>Awaiting Review</p>
					)}
					{currentGeneration.status === "completed" && (
						<p data-header-text>Result</p>
					)}
					{currentGeneration.status === "failed" && (
						<p data-header-text>Error</p>
					)}
					{currentGeneration.status === "cancelled" && (
						<p data-header-text>Cancelled</p>
					)}
					{currentGeneration.status === "completed" &&
						currentGeneration.usage && (
							<div className="flex items-center gap-[10px] text-[11px] text-text-muted font-sans ml-[6px]">
								{currentGeneration.startedAt &&
									currentGeneration.completedAt && (
										<span className="flex items-center gap-[2px]">
											<TimerIcon className="text-text-muted size-[12px]" />
											{formatExecutionTime(
												currentGeneration.startedAt,
												currentGeneration.completedAt,
											)}
										</span>
									)}

								{currentGeneration.usage.inputTokens && (
									<span className="flex items-center gap-[2px]">
										<ArrowUpIcon className="text-text-muted size-[12px]" />
										{currentGeneration.usage.inputTokens.toLocaleString()}t
									</span>
								)}
								{currentGeneration.usage.outputTokens && (
									<span className="flex items-center gap-[2px]">
										<ArrowDownIcon className="text-text-muted size-[12px]" />
										{currentGeneration.usage.outputTokens.toLocaleString()}t
									</span>
								)}
							</div>
						)}
				</div>
				{(currentGeneration.status === "completed" ||
					currentGeneration.status === "cancelled") && (
					<ClipboardButton
						text={getGenerationTextContent(currentGeneration)}
						tooltip="Copy to clipboard"
						className="text-text-muted hover:text-text/60"
					/>
				)}
				{currentGeneration.status === "failed" && (
					<ClipboardButton
						text={getGenerationErrorContent(currentGeneration)}
						tooltip="Copy error to clipboard"
						className="text-text-muted hover:text-text/60"
					/>
				)}
			</div>
			<div className="flex-1 py-[4px] px-[16px] overflow-y-auto">
				<GenerationView generation={currentGeneration} />
			</div>
		</div>
	);
}
