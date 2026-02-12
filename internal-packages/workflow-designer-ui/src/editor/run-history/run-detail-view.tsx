"use client";

import type { Generation, GenerationId, Task } from "@giselles-ai/protocol";
import {
	ArrowDownIcon,
	ArrowLeftIcon,
	ArrowUpIcon,
	CheckCircleIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	ClockIcon,
	LoaderIcon,
	TimerIcon,
	XCircleIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import useSWR from "swr";
import { useGiselle } from "../../app-designer/store/giselle-client-provider";
import { GenerationView } from "../../ui/generation-view";

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	const minutes = Math.floor(ms / 60000);
	const seconds = Math.floor((ms % 60000) / 1000);
	return `${minutes}m ${seconds}s`;
}

function formatDateTime(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
	switch (status) {
		case "completed":
			return (
				<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
					<CheckCircleIcon className="size-3" />
					Completed
				</span>
			);
		case "failed":
			return (
				<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
					<XCircleIcon className="size-3" />
					Failed
				</span>
			);
		case "running":
		case "inProgress":
			return (
				<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
					<LoaderIcon className="size-3 animate-spin" />
					Running
				</span>
			);
		case "cancelled":
			return (
				<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
					Cancelled
				</span>
			);
		default:
			return (
				<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-500/10 text-inverse/50 border border-gray-500/20">
					{status}
				</span>
			);
	}
}

/** Expandable step row that lazy-loads generation data on expand */
function StepDetailRow({
	step,
	isLast,
}: {
	step: { id: string; name: string; status: string; generationId: string; duration: number; usage: { inputTokens: number; outputTokens: number; totalTokens: number } };
	isLast: boolean;
}) {
	const [expanded, setExpanded] = useState(false);
	const client = useGiselle();

	const { data: generation, isLoading } = useSWR<Generation>(
		expanded ? { namespace: "getGeneration", generationId: step.generationId } : null,
		() => client.getGeneration({ generationId: step.generationId as GenerationId }),
	);

	return (
		<div className={`${!isLast ? "border-b border-inverse/5" : ""}`}>
			<button
				type="button"
				className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-inverse/5 transition-colors"
				onClick={() => setExpanded(!expanded)}
			>
				{expanded ? (
					<ChevronDownIcon className="size-3.5 text-inverse/40 shrink-0" />
				) : (
					<ChevronRightIcon className="size-3.5 text-inverse/40 shrink-0" />
				)}

				<span className="flex-1 text-xs text-inverse font-medium truncate">
					{step.name}
				</span>

				<StatusBadge status={step.status} />

				{step.duration > 0 && (
					<span className="flex items-center gap-1 text-[10px] text-inverse/40 shrink-0">
						<TimerIcon className="size-2.5" />
						{formatDuration(step.duration)}
					</span>
				)}

				{step.usage.totalTokens > 0 && (
					<span className="flex items-center gap-1.5 text-[10px] text-inverse/40 shrink-0">
						<span className="flex items-center gap-0.5">
							<ArrowUpIcon className="size-2.5" />
							{step.usage.inputTokens.toLocaleString()}
						</span>
						<span className="flex items-center gap-0.5">
							<ArrowDownIcon className="size-2.5" />
							{step.usage.outputTokens.toLocaleString()}
						</span>
					</span>
				)}
			</button>

			{expanded && (
				<div className="px-4 pb-3 pt-1 ml-6 border-l border-inverse/10">
					{isLoading && (
						<div className="flex items-center gap-2 py-3 text-xs text-inverse/40">
							<LoaderIcon className="size-3 animate-spin" />
							Loading output...
						</div>
					)}
					{generation && (
						<div className="text-xs">
							<GenerationView generation={generation} />
						</div>
					)}
					{!isLoading && !generation && (
						<div className="py-2 text-xs text-inverse/30">
							No generation data available.
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export function RunDetailView({
	task,
	onBack,
}: {
	task: Task;
	onBack: () => void;
}) {
	return (
		<div className="flex flex-col h-full">
			{/* Header with back button */}
			<div className="flex items-center gap-3 px-4 py-3 border-b border-inverse/10">
				<button
					type="button"
					onClick={onBack}
					className="flex items-center gap-1.5 text-xs text-inverse/50 hover:text-inverse/80 transition-colors"
				>
					<ArrowLeftIcon className="size-3.5" />
					Back to runs
				</button>
			</div>

			{/* Run summary */}
			<div className="px-4 py-3 border-b border-inverse/10 space-y-2">
				<div className="flex items-center gap-3">
					<h3 className="text-sm font-medium text-inverse">
						{task.name || "Untitled Run"}
					</h3>
					<StatusBadge status={task.status} />
				</div>

				<div className="flex flex-wrap items-center gap-4 text-[10px] text-inverse/40">
					<span className="flex items-center gap-1">
						<ClockIcon className="size-3" />
						{formatDateTime(task.createdAt)}
					</span>
					<span className="flex items-center gap-1">
						<TimerIcon className="size-3" />
						Wall: {formatDuration(task.duration.wallClock)}
					</span>
					<span className="flex items-center gap-1">
						<TimerIcon className="size-3" />
						Total: {formatDuration(task.duration.totalTask)}
					</span>
					{task.usage.totalTokens > 0 && (
						<span className="flex items-center gap-1.5">
							<ArrowUpIcon className="size-3" />
							{task.usage.inputTokens.toLocaleString()}t
							<ArrowDownIcon className="size-3" />
							{task.usage.outputTokens.toLocaleString()}t
						</span>
					)}
					{task.trigger && (
						<span>Trigger: {task.trigger}</span>
					)}
				</div>

				{/* Step summary counts */}
				<div className="flex items-center gap-3 text-[10px]">
					{task.steps.completed > 0 && (
						<span className="flex items-center gap-1 text-green-400">
							<CheckCircleIcon className="size-3" />
							{task.steps.completed} completed
						</span>
					)}
					{task.steps.failed > 0 && (
						<span className="flex items-center gap-1 text-red-400">
							<XCircleIcon className="size-3" />
							{task.steps.failed} failed
						</span>
					)}
					{task.steps.cancelled > 0 && (
						<span className="text-inverse/40">
							{task.steps.cancelled} cancelled
						</span>
					)}
				</div>
			</div>

			{/* Per-node step list */}
			<div className="flex-1 overflow-y-auto">
				{task.sequences.length === 0 ? (
					<div className="px-4 py-8 text-center text-xs text-inverse/30">
						No execution steps recorded.
					</div>
				) : (
					task.sequences.map((sequence) => (
						<div key={sequence.id}>
							{sequence.steps.length > 0 && (
								<div className="border-b border-inverse/10">
									{sequence.steps.map((step, idx) => (
										<StepDetailRow
											key={step.id}
											step={step}
											isLast={idx === sequence.steps.length - 1}
										/>
									))}
								</div>
							)}
						</div>
					))
				)}

				{/* Annotations (errors/warnings) */}
				{task.annotations && task.annotations.length > 0 && (
					<div className="px-4 py-3 border-t border-inverse/10">
						<div className="text-[10px] font-medium text-inverse/40 uppercase tracking-wider mb-2">
							Annotations
						</div>
						<div className="space-y-1.5">
							{task.annotations.map((annotation, idx) => (
								<div
									key={`ann-${idx}`}
									className={`text-xs px-2 py-1 rounded ${
										annotation.level === "error"
											? "bg-red-500/10 text-red-400"
											: annotation.level === "warning"
												? "bg-yellow-500/10 text-yellow-400"
												: "bg-blue-500/10 text-blue-400"
									}`}
								>
									{annotation.message}
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
