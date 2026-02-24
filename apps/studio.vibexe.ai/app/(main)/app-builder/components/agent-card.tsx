"use client";

/**
 * AgentCard Component
 *
 * Individual agent configuration card for the Dashboard > Agents panel.
 * Shows agent name, description, model tier, skills, and enable/disable toggle.
 */

import {
	Bot,
	Brain,
	Code2,
	Eye,
	FileCode,
	Lock,
	Paintbrush,
	Shield,
	TestTube2,
	Wrench,
	Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentCardProps {
	agent: {
		id: string;
		name: string;
		description: string;
		icon: string;
		modelTier: string;
		readOnly: boolean;
		skills: string[];
		tools: string[];
		enabled: boolean;
	};
	onToggle: (agentId: string, enabled: boolean) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
	ListTodo: <Brain className="h-5 w-5" />,
	Building2: <Code2 className="h-5 w-5" />,
	TestTube2: <TestTube2 className="h-5 w-5" />,
	Eye: <Eye className="h-5 w-5" />,
	Shield: <Shield className="h-5 w-5" />,
	Zap: <Zap className="h-5 w-5" />,
	Paintbrush: <Paintbrush className="h-5 w-5" />,
	Server: <Wrench className="h-5 w-5" />,
	Code: <FileCode className="h-5 w-5" />,
	Palette: <Paintbrush className="h-5 w-5" />,
	FileText: <FileCode className="h-5 w-5" />,
	Eraser: <Wrench className="h-5 w-5" />,
	PlayCircle: <TestTube2 className="h-5 w-5" />,
};

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> =
	{
		opus: {
			bg: "bg-purple-500/10",
			text: "text-purple-400",
			label: "Opus",
		},
		sonnet: {
			bg: "bg-blue-500/10",
			text: "text-blue-400",
			label: "Sonnet",
		},
		haiku: {
			bg: "bg-green-500/10",
			text: "text-green-400",
			label: "Haiku",
		},
	};

export function AgentCard({ agent, onToggle }: AgentCardProps) {
	const tier = TIER_STYLES[agent.modelTier] || TIER_STYLES.sonnet;
	const icon = ICON_MAP[agent.icon] || <Bot className="h-5 w-5" />;

	return (
		<div
			className={cn(
				"rounded-lg border p-4 transition-all",
				agent.enabled
					? "border-border bg-card hover:border-primary/30"
					: "border-border/50 bg-card/50 opacity-60",
			)}
		>
			{/* Header: icon, name, tier badge, toggle */}
			<div className="flex items-start gap-3">
				<div
					className={cn(
						"flex-shrink-0 p-2 rounded-lg",
						agent.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
					)}
				>
					{icon}
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<h3 className="text-sm font-semibold text-foreground truncate">
							{agent.name}
						</h3>
						<span
							className={cn(
								"text-[10px] font-medium px-1.5 py-0.5 rounded",
								tier.bg,
								tier.text,
							)}
						>
							{tier.label}
						</span>
						{agent.readOnly && (
							<Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
						)}
					</div>
					<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
						{agent.description}
					</p>
				</div>
				{/* Enable/disable toggle */}
				<button
					type="button"
					onClick={() => onToggle(agent.id, !agent.enabled)}
					className={cn(
						"relative flex-shrink-0 w-9 h-5 rounded-full transition-colors",
						agent.enabled ? "bg-primary" : "bg-muted",
					)}
					aria-label={`${agent.enabled ? "Disable" : "Enable"} ${agent.name}`}
				>
					<span
						className={cn(
							"absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
							agent.enabled ? "translate-x-4" : "translate-x-0.5",
						)}
					/>
				</button>
			</div>

			{/* Skills */}
			{agent.skills.length > 0 && (
				<div className="flex flex-wrap gap-1 mt-3">
					{agent.skills.map((skill) => (
						<span
							key={skill}
							className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
						>
							{skill}
						</span>
					))}
				</div>
			)}

			{/* Tools */}
			<div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
				<span>
					{agent.tools.length} tool{agent.tools.length !== 1 ? "s" : ""}
				</span>
				<span className="text-border">|</span>
				<span>{agent.readOnly ? "Read-only" : "Full access"}</span>
			</div>
		</div>
	);
}
