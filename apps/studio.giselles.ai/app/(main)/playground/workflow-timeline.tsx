"use client";

import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";
import clsx from "clsx";
import {
	CheckCircle2,
	Circle,
	ExternalLink,
	Loader2,
	Workflow,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

interface WorkflowStep {
	id: string;
	type: "create_workflow" | "add_node" | "add_connection" | "set_prompt" | "finalize_workflow";
	label: string;
	status: "pending" | "running" | "completed" | "error";
	result?: Record<string, unknown>;
}

/** AI SDK v5 tool part shape */
interface ToolPart {
	type: string;
	toolCallId: string;
	toolName?: string;
	input?: unknown;
	output?: unknown;
	state: string;
}

const WORKFLOW_TOOLS = ["create_workflow", "add_node", "add_connection", "set_prompt", "finalize_workflow"];

function getNodeLabel(args: Record<string, unknown>): string {
	if (args.type === "appEntry") return "Adding Start node";
	if (args.type === "end") return "Adding End node";
	const name = args.name || args.type;
	if (name) return `Adding node: ${name}`;
	return "Adding node...";
}

function extractWorkflowSteps(messages: UIMessage[]): WorkflowStep[] {
	// Use a map to deduplicate by toolCallId (keep latest state)
	const stepMap = new Map<string, WorkflowStep>();

	for (const message of messages) {
		if (message.role !== "assistant") continue;

		for (const part of message.parts) {
			if (!isToolUIPart(part)) continue;

			const toolPart = part as unknown as ToolPart;
			const toolName = toolPart.toolName || toolPart.type.replace(/^tool-/, "");

			if (!WORKFLOW_TOOLS.includes(toolName)) continue;

			const args = (toolPart.input as Record<string, unknown>) ?? {};
			const state = toolPart.state;
			const isOutputAvailable = state === "output-available";
			const isOutputError = state === "output-error";
			const result = isOutputAvailable || isOutputError
				? (toolPart.output as Record<string, unknown>)
				: undefined;

			let label: string;
			switch (toolName) {
				case "create_workflow":
					label = `Creating workflow: ${args.name ?? "Untitled"}`;
					break;
				case "add_node":
					label = getNodeLabel(args);
					break;
				case "add_connection":
					label = "Connecting nodes";
					break;
				case "set_prompt":
					label = "Setting prompt";
					break;
				case "finalize_workflow":
					label = "Finalizing workflow";
					break;
				default:
					label = toolName;
			}

			const status = isOutputAvailable
				? result?.success
					? "completed"
					: "error"
				: isOutputError
					? "error"
					: "running";

			// Update existing entry or add new one (dedup by toolCallId)
			const existing = stepMap.get(toolPart.toolCallId);
			if (!existing || status !== "running" || !existing.label.includes("...")) {
				stepMap.set(toolPart.toolCallId, {
					id: toolPart.toolCallId,
					type: toolName as WorkflowStep["type"],
					label: (existing && label.includes("...") && !existing.label.includes("...")) ? existing.label : label,
					status,
					result,
				});
			}
		}
	}

	return Array.from(stepMap.values());
}

export function WorkflowTimeline({
	messages,
	isLoading,
}: {
	messages: UIMessage[];
	isLoading: boolean;
}) {
	const steps = useMemo(() => extractWorkflowSteps(messages), [messages]);

	if (steps.length === 0) return null;

	const finalizeStep = steps.find((s) => s.type === "finalize_workflow" && s.status === "completed");
	const workflowUrl = finalizeStep?.result?.url as string | undefined;

	return (
		<div className="mt-4 rounded-lg border border-blue-muted/20 bg-[rgba(131,157,195,0.04)] p-4">
			<div className="flex items-center gap-2 mb-3">
				<Workflow className="h-4 w-4 text-blue-muted/60" />
				<span className="text-[13px] font-medium text-text/80">
					Workflow Progress
				</span>
			</div>

			<div className="flex flex-col gap-1.5">
				{steps.map((step) => (
					<div
						key={step.id}
						className="flex items-center gap-2.5 text-[12px]"
					>
						{step.status === "completed" ? (
							<CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
						) : step.status === "running" ? (
							<Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />
						) : step.status === "error" ? (
							<Circle className="h-3.5 w-3.5 text-red-400 shrink-0" />
						) : (
							<Circle className="h-3.5 w-3.5 text-text-muted/40 shrink-0" />
						)}
						<span
							className={clsx(
								"truncate",
								step.status === "completed"
									? "text-text/70"
									: step.status === "running"
										? "text-text/90"
										: step.status === "error"
											? "text-red-400/80"
											: "text-text-muted/50",
							)}
						>
							{step.label}
						</span>
					</div>
				))}

				{isLoading && steps.every((s) => s.status === "completed") && (
					<div className="flex items-center gap-2.5 text-[12px]">
						<Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />
						<span className="text-text/90">Processing...</span>
					</div>
				)}
			</div>

			{workflowUrl && (
				<div className="mt-4 pt-3 border-t border-blue-muted/15">
					<Link
						href={workflowUrl}
						className="inline-flex items-center gap-2 rounded-lg bg-[rgba(0,135,246,0.15)] border border-[rgba(0,135,246,0.3)] px-4 py-2 text-[13px] text-[rgba(120,180,255,0.9)] hover:bg-[rgba(0,135,246,0.25)] transition-colors"
					>
						<ExternalLink className="h-3.5 w-3.5" />
						Open in Editor
					</Link>
				</div>
			)}
		</div>
	);
}
