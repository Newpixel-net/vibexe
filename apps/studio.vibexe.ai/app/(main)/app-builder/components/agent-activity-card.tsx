"use client";

/**
 * AgentActivityCard Component
 *
 * Rendered inline in the chat timeline when an agent activates.
 * Shows agent name, model tier, read-only status, and loaded skills.
 *
 * AgentActivationCard — Shown when a user activates an agent via slash command.
 * Displays the agent card with "activated" status and awaiting prompt message.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
	Bot,
	Brain,
	Check,
	CircleDot,
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

/** Per-agent accent colors for activation cards and active states */
export const AGENT_COLORS: Record<
	string,
	{ border: string; bg: string; accent: string; iconBg: string }
> = {
	planner: {
		border: "border-amber-500/[0.2]",
		bg: "bg-amber-500/[0.04]",
		accent: "text-amber-400",
		iconBg: "bg-amber-500/[0.12]",
	},
	architect: {
		border: "border-cyan-500/[0.2]",
		bg: "bg-cyan-500/[0.04]",
		accent: "text-cyan-400",
		iconBg: "bg-cyan-500/[0.12]",
	},
	"fullstack-developer": {
		border: "border-violet-500/[0.2]",
		bg: "bg-violet-500/[0.04]",
		accent: "text-violet-400",
		iconBg: "bg-violet-500/[0.12]",
	},
	"frontend-developer": {
		border: "border-pink-500/[0.2]",
		bg: "bg-pink-500/[0.04]",
		accent: "text-pink-400",
		iconBg: "bg-pink-500/[0.12]",
	},
	"backend-developer": {
		border: "border-orange-500/[0.2]",
		bg: "bg-orange-500/[0.04]",
		accent: "text-orange-400",
		iconBg: "bg-orange-500/[0.12]",
	},
	"code-reviewer": {
		border: "border-teal-500/[0.2]",
		bg: "bg-teal-500/[0.04]",
		accent: "text-teal-400",
		iconBg: "bg-teal-500/[0.12]",
	},
	"security-reviewer": {
		border: "border-red-500/[0.2]",
		bg: "bg-red-500/[0.04]",
		accent: "text-red-400",
		iconBg: "bg-red-500/[0.12]",
	},
	"build-error-resolver": {
		border: "border-yellow-500/[0.2]",
		bg: "bg-yellow-500/[0.04]",
		accent: "text-yellow-400",
		iconBg: "bg-yellow-500/[0.12]",
	},
	"tdd-guide": {
		border: "border-emerald-500/[0.2]",
		bg: "bg-emerald-500/[0.04]",
		accent: "text-emerald-400",
		iconBg: "bg-emerald-500/[0.12]",
	},
	"ui-designer": {
		border: "border-fuchsia-500/[0.2]",
		bg: "bg-fuchsia-500/[0.04]",
		accent: "text-fuchsia-400",
		iconBg: "bg-fuchsia-500/[0.12]",
	},
	"doc-updater": {
		border: "border-blue-500/[0.2]",
		bg: "bg-blue-500/[0.04]",
		accent: "text-blue-400",
		iconBg: "bg-blue-500/[0.12]",
	},
	"refactor-cleaner": {
		border: "border-lime-500/[0.2]",
		bg: "bg-lime-500/[0.04]",
		accent: "text-lime-400",
		iconBg: "bg-lime-500/[0.12]",
	},
	"e2e-runner": {
		border: "border-indigo-500/[0.2]",
		bg: "bg-indigo-500/[0.04]",
		accent: "text-indigo-400",
		iconBg: "bg-indigo-500/[0.12]",
	},
};

const DEFAULT_AGENT_COLOR = {
	border: "border-violet-500/[0.2]",
	bg: "bg-violet-500/[0.04]",
	accent: "text-violet-400",
	iconBg: "bg-violet-500/[0.12]",
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
	const colors = AGENT_COLORS[event.agentId || ""] || DEFAULT_AGENT_COLOR;

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
			className={cn(
				"rounded-2xl border overflow-hidden backdrop-blur-sm",
				isActive
					? `${colors.border} ${colors.bg}`
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
							"flex-shrink-0 p-1.5 rounded-lg",
							isActive ? `${colors.iconBg} ${colors.accent}` : "text-muted-foreground",
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
									<Loader className={cn("h-3.5 w-3.5 animate-spin", colors.accent)} />
								</motion.div>
							)}
							{isComplete && !isActive && (
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
						className={cn("text-xs mt-1.5 ml-7", colors.accent, "opacity-70")}
					>
						{event.readOnly ? "Analyzing..." : "Generating code..."}
					</motion.div>
				)}
			</div>
		</motion.div>
	);
}

/**
 * AgentActivationCard — Shown in the chat timeline when a user
 * activates an agent via slash command (e.g. /backend, /frontend).
 * Displays agent icon, name, tier, description, and "ready" status.
 */
interface AgentActivationCardProps {
	agentId: string;
	agentName: string;
	modelTier: string;
	description: string;
	onDeactivate?: () => void;
}

export function AgentActivationCard({
	agentId,
	agentName,
	modelTier,
	description,
	onDeactivate,
}: AgentActivationCardProps) {
	const tier = TIER_COLORS[modelTier] || TIER_COLORS.sonnet;
	const icon = AGENT_ICONS[agentId] || <Bot className="h-4 w-4" />;
	const colors = AGENT_COLORS[agentId] || DEFAULT_AGENT_COLOR;

	return (
		<motion.div
			initial={{ opacity: 0, y: 12, scale: 0.97 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
			className={cn(
				"rounded-2xl border overflow-hidden backdrop-blur-sm",
				colors.border,
				colors.bg,
			)}
		>
			<div className="px-4 py-3">
				{/* Header: icon + name + tier + ready dot */}
				<div className="flex items-center gap-2.5">
					<div
						className={cn(
							"flex-shrink-0 p-2 rounded-xl",
							colors.iconBg,
							colors.accent,
						)}
					>
						{icon}
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold text-foreground">
								{agentName}
							</span>
							<span
								className={cn(
									"text-xs font-medium px-1.5 py-0.5 rounded",
									tier.bg,
									tier.text,
								)}
							>
								{tier.label}
							</span>
						</div>
						<p className="text-xs text-muted-foreground mt-0.5 truncate">
							{description}
						</p>
					</div>

					{/* Ready pulse indicator */}
					<div className="flex-shrink-0 relative">
						<span className={cn("absolute inset-0 rounded-full animate-ping opacity-30", colors.accent.replace("text-", "bg-"))} style={{ animationDuration: "2s" }} />
						<CircleDot className={cn("h-4 w-4 relative", colors.accent)} />
					</div>
				</div>

				{/* Activation message */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.15 }}
					className="mt-3 ml-[42px]"
				>
					<p className={cn("text-xs font-medium", colors.accent)}>
						Activated &mdash; ready for your instructions
					</p>
					<p className="text-[11px] text-muted-foreground mt-1">
						Type your request below. This agent will handle all messages until you switch.
					</p>
				</motion.div>

				{/* Switch to Auto button */}
				{onDeactivate && (
					<div className="mt-2.5 ml-[42px]">
						<button
							type="button"
							onClick={onDeactivate}
							className="text-xs text-white/30 hover:text-white/60 px-2.5 py-1 rounded-lg hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-200"
						>
							Switch to Auto
						</button>
					</div>
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
