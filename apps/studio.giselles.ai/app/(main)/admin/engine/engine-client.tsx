"use client";

/**
 * Engine Dashboard — Admin panel for ECC multi-agent orchestration engine.
 * Shows overview of agents, skills, rules, and flows.
 */

import {
	Bot,
	Brain,
	ChevronRight,
	Code2,
	Eye,
	FileCode,
	GitBranch,
	Lock,
	Paintbrush,
	Settings,
	Shield,
	Sparkles,
	TestTube2,
	Wrench,
	Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	ALL_FLOWS,
	DEFAULT_AGENTS,
	DEFAULT_SKILLS,
	getAllRules,
	getAgent,
} from "@giselles-ai/vibexe-engine";
import { cn } from "@/lib/utils";

type Tab = "overview" | "agents" | "skills" | "rules" | "flows";

// ─── Icon Maps ──────────────────────────────────────────────────────

const AGENT_ICONS: Record<string, React.ReactNode> = {
	ListTodo: <Brain className="h-4 w-4" />,
	Building2: <Code2 className="h-4 w-4" />,
	TestTube2: <TestTube2 className="h-4 w-4" />,
	Eye: <Eye className="h-4 w-4" />,
	Shield: <Shield className="h-4 w-4" />,
	Zap: <Zap className="h-4 w-4" />,
	Paintbrush: <Paintbrush className="h-4 w-4" />,
	Server: <Wrench className="h-4 w-4" />,
	Code: <FileCode className="h-4 w-4" />,
	Palette: <Paintbrush className="h-4 w-4" />,
	FileText: <FileCode className="h-4 w-4" />,
	Eraser: <Wrench className="h-4 w-4" />,
	PlayCircle: <TestTube2 className="h-4 w-4" />,
};

const TIER_COLORS: Record<string, string> = {
	opus: "text-purple-400 bg-purple-500/10",
	sonnet: "text-blue-400 bg-blue-500/10",
	haiku: "text-green-400 bg-green-500/10",
};

const CATEGORY_COLORS: Record<string, string> = {
	framework: "text-blue-400 bg-blue-500/10",
	database: "text-emerald-400 bg-emerald-500/10",
	workflow: "text-purple-400 bg-purple-500/10",
	infrastructure: "text-orange-400 bg-orange-500/10",
	specialized: "text-pink-400 bg-pink-500/10",
};

// ─── Stats Card ─────────────────────────────────────────────────────

function StatCard({
	icon,
	label,
	value,
	sub,
}: {
	icon: React.ReactNode;
	label: string;
	value: number | string;
	sub?: string;
}) {
	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<div className="flex items-center gap-2 mb-2">
				<span className="text-muted-foreground">{icon}</span>
				<span className="text-sm text-muted-foreground">{label}</span>
			</div>
			<div className="text-2xl font-bold text-foreground">{value}</div>
			{sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
		</div>
	);
}

// ─── Overview Tab ───────────────────────────────────────────────────

function OverviewTab() {
	const rules = getAllRules();
	const enabledAgents = DEFAULT_AGENTS.filter((a) => a.enabled).length;
	const enabledSkills = DEFAULT_SKILLS.filter((s) => s.enabled).length;

	return (
		<div className="space-y-6">
			{/* Stats grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard
					icon={<Bot className="h-4 w-4" />}
					label="Agents"
					value={DEFAULT_AGENTS.length}
					sub={`${enabledAgents} enabled`}
				/>
				<StatCard
					icon={<Sparkles className="h-4 w-4" />}
					label="Skills"
					value={DEFAULT_SKILLS.length}
					sub={`${enabledSkills} enabled`}
				/>
				<StatCard
					icon={<Settings className="h-4 w-4" />}
					label="Rules"
					value={rules.length}
					sub={`${rules.filter((r) => r.enabled).length} active`}
				/>
				<StatCard
					icon={<GitBranch className="h-4 w-4" />}
					label="Flows"
					value={ALL_FLOWS.length}
					sub="Built-in pipelines"
				/>
			</div>

			{/* Agent tier breakdown */}
			<div className="rounded-lg border border-border bg-card p-4">
				<h3 className="text-sm font-medium text-foreground mb-3">
					Agent Distribution by Tier
				</h3>
				{(["opus", "sonnet", "haiku"] as const).map((tier) => {
					const count = DEFAULT_AGENTS.filter(
						(a) => a.modelTier === tier,
					).length;
					const pct = Math.round((count / DEFAULT_AGENTS.length) * 100);
					return (
						<div key={tier} className="flex items-center gap-3 mb-2 last:mb-0">
							<span
								className={cn(
									"text-xs font-medium px-2 py-0.5 rounded capitalize",
									TIER_COLORS[tier],
								)}
							>
								{tier}
							</span>
							<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
								<div
									className={cn(
										"h-full rounded-full",
										tier === "opus"
											? "bg-purple-400"
											: tier === "sonnet"
												? "bg-blue-400"
												: "bg-green-400",
									)}
									style={{ width: `${pct}%` }}
								/>
							</div>
							<span className="text-xs text-muted-foreground w-8 text-right">
								{count}
							</span>
						</div>
					);
				})}
			</div>

			{/* Flows summary */}
			<div className="rounded-lg border border-border bg-card p-4">
				<h3 className="text-sm font-medium text-foreground mb-3">
					Orchestration Flows
				</h3>
				<div className="space-y-2">
					{ALL_FLOWS.map((flow) => (
						<div key={flow.id} className="flex items-center gap-2 text-sm">
							<GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="font-medium text-foreground">{flow.name}</span>
							<ChevronRight className="h-3 w-3 text-muted-foreground" />
							<span className="text-muted-foreground text-xs">
								{flow.steps
									.sort((a, b) => a.order - b.order)
									.map((s) => getAgent(s.agentId)?.name || s.agentId)
									.join(" → ")}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ─── Agents Tab ─────────────────────────────────────────────────────

function AgentsTab() {
	return (
		<div className="space-y-3">
			{DEFAULT_AGENTS.map((agent) => (
				<div
					key={agent.id}
					className="rounded-lg border border-border bg-card p-4"
				>
					<div className="flex items-center gap-3">
						<span className="text-muted-foreground">
							{AGENT_ICONS[agent.icon] || <Bot className="h-4 w-4" />}
						</span>
						<div className="flex-1">
							<div className="flex items-center gap-2">
								<span className="text-sm font-medium text-foreground">
									{agent.name}
								</span>
								<span
									className={cn(
										"text-[10px] font-medium px-1.5 py-0.5 rounded",
										TIER_COLORS[agent.modelTier],
									)}
								>
									{agent.modelTier}
								</span>
								{agent.readOnly && (
									<Lock className="h-3 w-3 text-muted-foreground" />
								)}
							</div>
							<p className="text-xs text-muted-foreground mt-0.5">
								{agent.description}
							</p>
						</div>
						<span
							className={cn(
								"text-xs px-2 py-0.5 rounded",
								agent.enabled
									? "bg-green-500/10 text-green-400"
									: "bg-red-500/10 text-red-400",
							)}
						>
							{agent.enabled ? "Enabled" : "Disabled"}
						</span>
					</div>
					{/* Skills */}
					<div className="flex flex-wrap gap-1 mt-2 ml-7">
						{agent.skills.map((skill) => (
							<span
								key={skill}
								className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
							>
								{skill}
							</span>
						))}
					</div>
					{/* Tools */}
					<div className="flex items-center gap-1 mt-1.5 ml-7">
						<span className="text-[10px] text-muted-foreground">Tools:</span>
						{agent.tools.map((tool) => (
							<span
								key={tool}
								className="text-[10px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono"
							>
								{tool}
							</span>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

// ─── Skills Tab ─────────────────────────────────────────────────────

function SkillsTab() {
	const categories = useMemo(() => {
		const cats = new Map<string, typeof DEFAULT_SKILLS>();
		for (const skill of DEFAULT_SKILLS) {
			const existing = cats.get(skill.category) || [];
			existing.push(skill);
			cats.set(skill.category, existing);
		}
		return cats;
	}, []);

	return (
		<div className="space-y-6">
			{Array.from(categories.entries()).map(([category, skills]) => (
				<div key={category}>
					<h3 className="text-sm font-medium text-foreground mb-2 capitalize">
						{category}
					</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{skills.map((skill) => (
							<div
								key={skill.id}
								className="rounded-lg border border-border bg-card p-3"
							>
								<div className="flex items-center gap-2">
									<span
										className={cn(
											"text-[10px] font-medium px-1.5 py-0.5 rounded capitalize",
											CATEGORY_COLORS[skill.category] || "bg-muted text-muted-foreground",
										)}
									>
										{skill.category}
									</span>
									<span className="text-sm font-medium text-foreground">
										{skill.name}
									</span>
								</div>
								<p className="text-xs text-muted-foreground mt-1">
									{skill.description}
								</p>
								<div className="flex flex-wrap gap-1 mt-2">
									{skill.activationTriggers.slice(0, 5).map((trigger) => (
										<span
											key={trigger}
											className="text-[10px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground"
										>
											{trigger}
										</span>
									))}
									{skill.activationTriggers.length > 5 && (
										<span className="text-[10px] text-muted-foreground">
											+{skill.activationTriggers.length - 5} more
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

// ─── Rules Tab ──────────────────────────────────────────────────────

function RulesTab() {
	const rules = getAllRules();

	return (
		<div className="space-y-3">
			{rules.map((rule) => (
				<div
					key={rule.id}
					className="rounded-lg border border-border bg-card p-4 flex items-center gap-4"
				>
					<div className="flex-1">
						<div className="flex items-center gap-2">
							<span className="text-sm font-medium text-foreground">
								{rule.name}
							</span>
							<span
								className={cn(
									"text-[10px] px-1.5 py-0.5 rounded",
									rule.enabled
										? "bg-green-500/10 text-green-400"
										: "bg-muted text-muted-foreground",
								)}
							>
								{rule.enabled ? "Active" : "Inactive"}
							</span>
						</div>
						<p className="text-xs text-muted-foreground mt-0.5">
							{rule.description}
						</p>
					</div>
					<div className="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">
						{String(rule.value)}
					</div>
				</div>
			))}
		</div>
	);
}

// ─── Main Component ─────────────────────────────────────────────────

export function EngineClient() {
	const [activeTab, setActiveTab] = useState<Tab>("overview");

	const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
		{ id: "overview", label: "Overview", icon: <Sparkles className="h-4 w-4" /> },
		{ id: "agents", label: "Agents", icon: <Bot className="h-4 w-4" /> },
		{ id: "skills", label: "Skills", icon: <Brain className="h-4 w-4" /> },
		{ id: "rules", label: "Rules", icon: <Settings className="h-4 w-4" /> },
		{ id: "flows", label: "Flows", icon: <GitBranch className="h-4 w-4" /> },
	];

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-foreground">
					Engine Configuration
				</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Multi-agent orchestration engine — agents, skills, rules, and flows
				</p>
			</div>

			{/* Tab navigation */}
			<div className="flex gap-1 mb-6 border-b border-border pb-2">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={cn(
							"flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
							activeTab === tab.id
								? "bg-primary/10 text-primary font-medium"
								: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
						)}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>

			{/* Tab content */}
			{activeTab === "overview" && <OverviewTab />}
			{activeTab === "agents" && <AgentsTab />}
			{activeTab === "skills" && <SkillsTab />}
			{activeTab === "rules" && <RulesTab />}
			{activeTab === "flows" && <OverviewTab />}
		</div>
	);
}
