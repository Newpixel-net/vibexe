"use client";

/**
 * AutomationsPanel Component
 *
 * Dashboard > Automations section showing orchestration flow diagrams.
 * Displays the 4 built-in flows as horizontal flowcharts.
 */

import { ArrowRight, GitBranch } from "lucide-react";
import {
	ALL_FLOWS,
	getAgent,
} from "@giselles-ai/vibexe-engine";
import { cn } from "@/lib/utils";

const TIER_COLORS: Record<string, string> = {
	opus: "border-purple-500/30 bg-purple-500/5",
	sonnet: "border-blue-500/30 bg-blue-500/5",
	haiku: "border-green-500/30 bg-green-500/5",
};

const TIER_DOT_COLORS: Record<string, string> = {
	opus: "bg-purple-400",
	sonnet: "bg-blue-400",
	haiku: "bg-green-400",
};

function FlowDiagram({
	flow,
}: {
	flow: (typeof ALL_FLOWS)[number];
}) {
	const agents = flow.steps
		.sort((a, b) => a.order - b.order)
		.map((step) => {
			const agent = getAgent(step.agentId);
			return {
				id: step.agentId,
				name: agent?.name || step.agentId,
				modelTier: agent?.modelTier || "sonnet",
				readOnly: agent?.readOnly || false,
				required: step.required,
			};
		});

	return (
		<div className="rounded-lg border border-border bg-card p-4">
			{/* Flow header */}
			<div className="flex items-center gap-2 mb-4">
				<GitBranch className="h-4 w-4 text-primary" />
				<h3 className="text-sm font-semibold text-foreground">{flow.name}</h3>
				<span className="text-xs text-muted-foreground ml-auto">
					{agents.length} step{agents.length !== 1 ? "s" : ""}
				</span>
			</div>
			<p className="text-xs text-muted-foreground mb-4">{flow.description}</p>

			{/* Horizontal flow diagram */}
			<div className="flex items-center gap-2 overflow-x-auto pb-2">
				{agents.map((agent, index) => (
					<div key={agent.id} className="flex items-center gap-2 flex-shrink-0">
						{/* Agent node */}
						<div
							className={cn(
								"rounded-lg border px-3 py-2 min-w-[140px]",
								TIER_COLORS[agent.modelTier] || TIER_COLORS.sonnet,
								!agent.required && "border-dashed opacity-75",
							)}
						>
							<div className="flex items-center gap-1.5">
								<div
									className={cn(
										"w-2 h-2 rounded-full flex-shrink-0",
										TIER_DOT_COLORS[agent.modelTier] || TIER_DOT_COLORS.sonnet,
									)}
								/>
								<span className="text-xs font-medium text-foreground truncate">
									{agent.name}
								</span>
							</div>
							<div className="flex items-center gap-1 mt-1">
								<span className="text-[10px] text-muted-foreground">
									{agent.modelTier}
								</span>
								{agent.readOnly && (
									<span className="text-[10px] text-muted-foreground">
										read-only
									</span>
								)}
								{!agent.required && (
									<span className="text-[10px] text-orange-400">optional</span>
								)}
							</div>
						</div>

						{/* Arrow between nodes */}
						{index < agents.length - 1 && (
							<ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
						)}
					</div>
				))}
			</div>
		</div>
	);
}

export function AutomationsPanel() {
	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center gap-3 px-6 py-4 border-b">
				<GitBranch className="h-5 w-5 text-primary" />
				<div>
					<h2 className="text-lg font-semibold text-foreground">
						Orchestration Flows
					</h2>
					<p className="text-xs text-muted-foreground">
						{ALL_FLOWS.length} built-in agent pipelines
					</p>
				</div>
			</div>

			{/* Flow diagrams */}
			<div className="flex-1 overflow-y-auto p-6 space-y-4">
				{ALL_FLOWS.map((flow) => (
					<FlowDiagram key={flow.id} flow={flow} />
				))}

				{/* Legend */}
				<div className="rounded-lg border border-border/50 bg-card/50 p-4 mt-6">
					<h4 className="text-xs font-medium text-muted-foreground mb-3">
						Legend
					</h4>
					<div className="flex flex-wrap gap-4 text-xs">
						<div className="flex items-center gap-1.5">
							<div className="w-2 h-2 rounded-full bg-purple-400" />
							<span className="text-muted-foreground">Opus (complex analysis)</span>
						</div>
						<div className="flex items-center gap-1.5">
							<div className="w-2 h-2 rounded-full bg-blue-400" />
							<span className="text-muted-foreground">Sonnet (code generation)</span>
						</div>
						<div className="flex items-center gap-1.5">
							<div className="w-2 h-2 rounded-full bg-green-400" />
							<span className="text-muted-foreground">Haiku (fast tasks)</span>
						</div>
						<div className="flex items-center gap-1.5">
							<div className="w-3 h-px border-t border-dashed border-muted-foreground" />
							<span className="text-muted-foreground">Optional step</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
