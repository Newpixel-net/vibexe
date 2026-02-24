"use client";

/**
 * AgentActivityCard Component
 *
 * Rendered inline in the chat timeline when an agent activates.
 * Shows agent name, model tier, read-only status, and loaded skills.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
	Bot,
	Brain,
	Check,
	Code2,
	Eye,
	FileCode,
	Loader,
	Lock,
	Paintbrush,
	Shield,
	TestTube2,
	Wrench,
	Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentEvent } from "../types/vibesdk";
import { SkillBadge } from "./skill-badge";

const AGENT_ICONS: Record<string, React.ReactNode> = {
	planner: <Brain className="h-4 w-4" />,
	architect: <Code2 className="h-4 w-4" />,
	"fullstack-developer": <FileCode className="h-4 w-4" />,
	"frontend-developer": <Paintbrush className="h-4 w-4" />,
	"backend-developer": <Wrench className="h-4 w-4" />,
	"code-reviewer": <Eye className="h-4 w-4" />,
	"security-reviewer": <Shield className="h-4 w-4" />,
	"build-error-resolver": <Zap className="h-4 w-4" />,
	"tdd-guide": <TestTube2 className="h-4 w-4" />,
	"ui-designer": <Paintbrush className="h-4 w-4" />,
	"doc-updater": <FileCode className="h-4 w-4" />,
	"refactor-cleaner": <Wrench className="h-4 w-4" />,
	"e2e-runner": <TestTube2 className="h-4 w-4" />,
};

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> =
	{
		opus: {
			bg: "bg-purple-500/[0.08]",
			text: "text-purple-300",
			label: "Opus",
		},
		sonnet: {
			bg: "bg-blue-500/[0.08]",
			text: "text-blue-300",
			label: "Sonnet",
		},
		haiku: {
			bg: "bg-green-500/[0.08]",
			text: "text-green-300",
			label: "Haiku",
		},
	};

interface AgentActivityCardProps {
	event: AgentEvent;
	isActive?: boolean;
	isComplete?: boolean;
}

export function AgentActivityCard({
	event,
	isActive = false,
	isComplete = false,
}: AgentActivityCardProps) {
	const tier = TIER_COLORS[event.modelTier || "sonnet"] || TIER_COLORS.sonnet;
	const icon = AGENT_ICONS[event.agentId || ""] || (
		<Bot className="h-4 w-4" />
	);

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
			className={cn(
				"rounded-2xl border overflow-hidden backdrop-blur-sm",
				isActive
					? "border-violet-500/[0.2] bg-violet-500/[0.04]"
					: isComplete
						? "border-white/[0.08] bg-white/[0.04]"
						: "border-white/[0.06] bg-white/[0.02]",
			)}
		>
			<div className="px-3 py-2.5">
				{/* Header: icon + name + model tier + read-only badge */}
				<div className="flex items-center gap-2">
					<div
						className={cn(
							"flex-shrink-0 p-1 rounded",
							isActive ? "text-primary" : "text-muted-foreground",
						)}
					>
						{icon}
					</div>
					<span className="text-sm font-medium text-foreground flex-1">
						{event.agentName || event.agentId}
					</span>

					{/* Model tier badge */}
					<span
						className={cn(
							"text-xs font-medium px-1.5 py-0.5 rounded",
							tier.bg,
							tier.text,
						)}
					>
						{tier.label}
					</span>

					{/* Read-only badge */}
					{event.readOnly && (
						<span className="flex items-center gap-0.5 text-xs text-muted-foreground">
							<Lock className="h-3 w-3" />
							Read-only
						</span>
					)}

					{/* Status indicator */}
					<div className="flex-shrink-0">
						<AnimatePresence mode="wait">
							{isActive && (
								<motion.div
									key="active"
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									exit={{ scale: 0 }}
								>
									<Loader className="h-3.5 w-3.5 animate-spin text-primary" />
								</motion.div>
							)}
							{isComplete && (
								<motion.div
									key="complete"
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									exit={{ scale: 0 }}
								>
									<Check className="h-3.5 w-3.5 text-green-500" />
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>

				{/* Skills row */}
				{event.skills && event.skills.length > 0 && (
					<div className="flex flex-wrap gap-1 mt-2 ml-7">
						{event.skills.map((skill) => (
							<SkillBadge key={skill.id} skill={skill} />
						))}
					</div>
				)}

				{/* Status text */}
				{isActive && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="text-xs text-muted-foreground mt-1.5 ml-7"
					>
						{event.readOnly ? "Analyzing..." : "Generating code..."}
					</motion.div>
				)}
			</div>
		</motion.div>
	);
}

/**
 * OrchestrationHeader — Shown at the top of the timeline
 * when orchestration starts, displaying intent and agent sequence.
 */
export function OrchestrationHeader({ event }: { event: AgentEvent }) {
	if (event.type !== "orchestration-start") return null;

	const complexityColors: Record<string, string> = {
		simple: "text-green-400",
		medium: "text-yellow-400",
		complex: "text-orange-400",
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm px-3 py-2"
		>
			<div className="flex items-center gap-2 text-xs">
				<Zap className="h-3.5 w-3.5 text-primary" />
				<span className="text-muted-foreground">Orchestration:</span>
				<span
					className={cn(
						"font-medium",
						complexityColors[event.intent?.complexity || "simple"],
					)}
				>
					{event.intent?.complexity || "simple"}
				</span>
				<span className="text-muted-foreground">via</span>
				<span className="font-medium text-foreground">
					{event.intent?.suggestedFlow || "quick"} flow
				</span>
				{event.intent?.techStack && event.intent.techStack.length > 0 && (
					<>
						<span className="text-muted-foreground">|</span>
						<span className="text-muted-foreground">
							{event.intent.techStack.join(", ")}
						</span>
					</>
				)}
			</div>
			{event.agents && event.agents.length > 1 && (
				<div className="flex items-center gap-1 mt-1 ml-5">
					{event.agents.map((agent, i) => (
						<span key={agent.id} className="flex items-center gap-1">
							{i > 0 && (
								<span className="text-muted-foreground text-xs">&rarr;</span>
							)}
							<span className="text-xs text-foreground/70">{agent.name}</span>
						</span>
					))}
				</div>
			)}
		</motion.div>
	);
}
