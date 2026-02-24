"use client";

/**
 * Engine Dashboard — Interactive admin panel for ECC multi-agent orchestration engine.
 * Manage agents, skills, rules, and flows with toggle switches, content viewers, and flow diagrams.
 */

import {
	Bot,
	Brain,
	ChevronDown,
	ChevronRight,
	Code2,
	Copy,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ALL_FLOWS,
	DEFAULT_AGENTS,
	DEFAULT_SKILLS,
	getAllRules,
	getAgent,
} from "@vibexe-ai/vibexe-engine";
import { cn } from "@/lib/utils";

type Tab = "overview" | "agents" | "skills" | "rules" | "flows";

// ─── Engine Overrides (localStorage persistence) ─────────────────

interface EngineOverrides {
	disabledAgents: string[];
	disabledSkills: string[];
	tierOverrides: Record<string, "opus" | "sonnet" | "haiku">;
}

const STORAGE_KEY = "vibexe-engine-overrides";

function loadOverrides(): EngineOverrides {
	if (typeof window === "undefined") {
		return { disabledAgents: [], disabledSkills: [], tierOverrides: {} };
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw);
	} catch {}
	return { disabledAgents: [], disabledSkills: [], tierOverrides: {} };
}

function saveOverrides(overrides: EngineOverrides) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

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
	Copy: <Copy className="h-4 w-4" />,
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

// ─── Toggle Switch ──────────────────────────────────────────────────

function Toggle({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onChange(!checked)}
			className={cn(
				"relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
				checked ? "bg-green-500" : "bg-muted",
			)}
		>
			<span
				className={cn(
					"pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
					checked ? "translate-x-4" : "translate-x-0",
				)}
			/>
		</button>
	);
}

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

function OverviewTab({
	overrides,
	onNavigate,
}: {
	overrides: EngineOverrides;
	onNavigate: (tab: Tab) => void;
}) {
	const rules = getAllRules();
	const enabledAgents = DEFAULT_AGENTS.filter(
		(a) => a.enabled && !overrides.disabledAgents.includes(a.id),
	).length;
	const enabledSkills = DEFAULT_SKILLS.filter(
		(s) => s.enabled && !overrides.disabledSkills.includes(s.id),
	).length;

	return (
		<div className="space-y-6">
			{/* Stats grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<button type="button" onClick={() => onNavigate("agents")} className="text-left">
					<StatCard
						icon={<Bot className="h-4 w-4" />}
						label="Agents"
						value={DEFAULT_AGENTS.length}
						sub={`${enabledAgents} enabled`}
					/>
				</button>
				<button type="button" onClick={() => onNavigate("skills")} className="text-left">
					<StatCard
						icon={<Sparkles className="h-4 w-4" />}
						label="Skills"
						value={DEFAULT_SKILLS.length}
						sub={`${enabledSkills} enabled`}
					/>
				</button>
				<button type="button" onClick={() => onNavigate("rules")} className="text-left">
					<StatCard
						icon={<Settings className="h-4 w-4" />}
						label="Rules"
						value={rules.length}
						sub={`${rules.filter((r) => r.enabled).length} active`}
					/>
				</button>
				<button type="button" onClick={() => onNavigate("flows")} className="text-left">
					<StatCard
						icon={<GitBranch className="h-4 w-4" />}
						label="Flows"
						value={ALL_FLOWS.length}
						sub="Built-in pipelines"
					/>
				</button>
			</div>

			{/* Agent tier breakdown */}
			<div className="rounded-lg border border-border bg-card p-4">
				<h3 className="text-sm font-medium text-foreground mb-3">
					Agent Distribution by Tier
				</h3>
				{(["opus", "sonnet", "haiku"] as const).map((tier) => {
					const count = DEFAULT_AGENTS.filter(
						(a) => (overrides.tierOverrides[a.id] || a.modelTier) === tier,
					).length;
					const pct = Math.round((count / DEFAULT_AGENTS.length) * 100);
					return (
						<div key={tier} className="flex items-center gap-3 mb-2 last:mb-0">
							<span
								className={cn(
									"text-xs font-medium px-2 py-0.5 rounded capitalize w-14 text-center",
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
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-sm font-medium text-foreground">
						Orchestration Flows
					</h3>
					<button
						type="button"
						onClick={() => onNavigate("flows")}
						className="text-xs text-primary hover:underline"
					>
						View all
					</button>
				</div>
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
									.join(" \u2192 ")}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ─── Agents Tab ─────────────────────────────────────────────────────

function AgentsTab({
	overrides,
	onToggleAgent,
	onChangeTier,
}: {
	overrides: EngineOverrides;
	onToggleAgent: (agentId: string) => void;
	onChangeTier: (agentId: string, tier: "opus" | "sonnet" | "haiku") => void;
}) {
	const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

	return (
		<div className="space-y-3">
			{DEFAULT_AGENTS.map((agent) => {
				const isEnabled = agent.enabled && !overrides.disabledAgents.includes(agent.id);
				const currentTier = overrides.tierOverrides[agent.id] || agent.modelTier;
				const isExpanded = expandedPrompt === agent.id;

				return (
					<div
						key={agent.id}
						className={cn(
							"rounded-lg border bg-card p-4 transition-opacity",
							isEnabled ? "border-border" : "border-border/50 opacity-60",
						)}
					>
						<div className="flex items-center gap-3">
							<span className="text-muted-foreground">
								{AGENT_ICONS[agent.icon] || <Bot className="h-4 w-4" />}
							</span>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 flex-wrap">
									<span className="text-sm font-medium text-foreground">
										{agent.name}
									</span>
									{/* Tier selector */}
									<select
										value={currentTier}
										onChange={(e) =>
											onChangeTier(agent.id, e.target.value as "opus" | "sonnet" | "haiku")
										}
										className={cn(
											"text-[10px] font-medium px-1.5 py-0.5 rounded border-0 cursor-pointer appearance-none",
											TIER_COLORS[currentTier],
										)}
									>
										<option value="opus">opus</option>
										<option value="sonnet">sonnet</option>
										<option value="haiku">haiku</option>
									</select>
									{agent.readOnly && (
										<Lock className="h-3 w-3 text-muted-foreground" />
									)}
								</div>
								<p className="text-xs text-muted-foreground mt-0.5">
									{agent.description}
								</p>
							</div>
							<Toggle checked={isEnabled} onChange={() => onToggleAgent(agent.id)} />
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
						{/* Expandable system prompt viewer */}
						<div className="mt-2 ml-7">
							<button
								type="button"
								onClick={() => setExpandedPrompt(isExpanded ? null : agent.id)}
								className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
							>
								{isExpanded ? (
									<ChevronDown className="h-3 w-3" />
								) : (
									<ChevronRight className="h-3 w-3" />
								)}
								System Prompt ({agent.systemPrompt.length} chars)
							</button>
							{isExpanded && (
								<pre className="mt-2 p-3 rounded-md bg-muted/50 text-[11px] text-muted-foreground overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
									{agent.systemPrompt}
								</pre>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ─── Skills Tab ─────────────────────────────────────────────────────

function SkillsTab({
	overrides,
	onToggleSkill,
}: {
	overrides: EngineOverrides;
	onToggleSkill: (skillId: string) => void;
}) {
	const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

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
						{skills.map((skill) => {
							const isEnabled =
								skill.enabled && !overrides.disabledSkills.includes(skill.id);
							const isExpanded = expandedSkill === skill.id;

							return (
								<div
									key={skill.id}
									className={cn(
										"rounded-lg border bg-card p-3 transition-opacity",
										isEnabled ? "border-border" : "border-border/50 opacity-60",
									)}
								>
									<div className="flex items-center gap-2">
										<span
											className={cn(
												"text-[10px] font-medium px-1.5 py-0.5 rounded capitalize",
												CATEGORY_COLORS[skill.category] ||
													"bg-muted text-muted-foreground",
											)}
										>
											{skill.category}
										</span>
										<span className="text-sm font-medium text-foreground flex-1">
											{skill.name}
										</span>
										<Toggle
											checked={isEnabled}
											onChange={() => onToggleSkill(skill.id)}
										/>
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
									{/* Expandable content viewer */}
									<button
										type="button"
										onClick={() =>
											setExpandedSkill(isExpanded ? null : skill.id)
										}
										className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
									>
										{isExpanded ? (
											<ChevronDown className="h-3 w-3" />
										) : (
											<ChevronRight className="h-3 w-3" />
										)}
										View Knowledge ({skill.content.length} chars)
									</button>
									{isExpanded && (
										<pre className="mt-2 p-3 rounded-md bg-muted/50 text-[11px] text-muted-foreground overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
											{skill.content}
										</pre>
									)}
								</div>
							);
						})}
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

// ─── Flows Tab ──────────────────────────────────────────────────────

function FlowsTab({
	overrides,
	onNavigateAgent,
}: {
	overrides: EngineOverrides;
	onNavigateAgent: (agentId: string) => void;
}) {
	return (
		<div className="space-y-4">
			{ALL_FLOWS.map((flow) => {
				const sortedSteps = [...flow.steps].sort((a, b) => a.order - b.order);

				return (
					<div
						key={flow.id}
						className="rounded-lg border border-border bg-card p-4"
					>
						<div className="flex items-center gap-2 mb-3">
							<GitBranch className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-medium text-foreground">
								{flow.name}
							</span>
							<span className="text-xs text-muted-foreground">
								{flow.description}
							</span>
						</div>
						{/* Flow diagram */}
						<div className="flex items-center gap-2 overflow-x-auto pb-2">
							{sortedSteps.map((step, idx) => {
								const agent = getAgent(step.agentId);
								if (!agent) return null;
								const isDisabled = overrides.disabledAgents.includes(agent.id);
								const currentTier =
									overrides.tierOverrides[agent.id] || agent.modelTier;

								return (
									<div key={step.agentId} className="flex items-center gap-2">
										{idx > 0 && (
											<ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
										)}
										<button
											type="button"
											onClick={() => onNavigateAgent(agent.id)}
											className={cn(
												"flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors shrink-0",
												isDisabled
													? "border-border/50 opacity-50"
													: "border-border hover:border-primary/50 hover:bg-primary/5",
											)}
										>
											<span className="text-muted-foreground">
												{AGENT_ICONS[agent.icon] || (
													<Bot className="h-4 w-4" />
												)}
											</span>
											<div className="text-left">
												<div className="flex items-center gap-1.5">
													<span className="text-xs font-medium text-foreground">
														{agent.name}
													</span>
													<span
														className={cn(
															"text-[9px] font-medium px-1 py-0.5 rounded",
															TIER_COLORS[currentTier],
														)}
													>
														{currentTier}
													</span>
												</div>
												<div className="flex items-center gap-1 mt-0.5">
													{step.required ? (
														<span className="text-[9px] text-green-400">
															required
														</span>
													) : (
														<span className="text-[9px] text-muted-foreground">
															optional
														</span>
													)}
													{agent.readOnly && (
														<Lock className="h-2.5 w-2.5 text-muted-foreground" />
													)}
												</div>
											</div>
										</button>
									</div>
								);
							})}
						</div>
						{/* Skills used in this flow */}
						<div className="mt-2 flex flex-wrap gap-1">
							{Array.from(
								new Set(
									sortedSteps.flatMap(
										(s) => getAgent(s.agentId)?.skills || [],
									),
								),
							).map((skill) => (
								<span
									key={skill}
									className="text-[9px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground"
								>
									{skill}
								</span>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ─── Main Component ─────────────────────────────────────────────────

export function EngineClient() {
	const [activeTab, setActiveTab] = useState<Tab>("overview");
	const [overrides, setOverrides] = useState<EngineOverrides>(loadOverrides);

	// Persist overrides to localStorage
	useEffect(() => {
		saveOverrides(overrides);
	}, [overrides]);

	const toggleAgent = useCallback((agentId: string) => {
		setOverrides((prev) => {
			const disabled = prev.disabledAgents.includes(agentId)
				? prev.disabledAgents.filter((id) => id !== agentId)
				: [...prev.disabledAgents, agentId];
			return { ...prev, disabledAgents: disabled };
		});
	}, []);

	const toggleSkill = useCallback((skillId: string) => {
		setOverrides((prev) => {
			const disabled = prev.disabledSkills.includes(skillId)
				? prev.disabledSkills.filter((id) => id !== skillId)
				: [...prev.disabledSkills, skillId];
			return { ...prev, disabledSkills: disabled };
		});
	}, []);

	const changeTier = useCallback(
		(agentId: string, tier: "opus" | "sonnet" | "haiku") => {
			setOverrides((prev) => {
				const agent = DEFAULT_AGENTS.find((a) => a.id === agentId);
				const tierOverrides = { ...prev.tierOverrides };
				if (agent && tier === agent.modelTier) {
					delete tierOverrides[agentId];
				} else {
					tierOverrides[agentId] = tier;
				}
				return { ...prev, tierOverrides };
			});
		},
		[],
	);

	const navigateToAgent = useCallback((_agentId: string) => {
		setActiveTab("agents");
	}, []);

	const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
		{
			id: "overview",
			label: "Overview",
			icon: <Sparkles className="h-4 w-4" />,
		},
		{ id: "agents", label: "Agents", icon: <Bot className="h-4 w-4" /> },
		{ id: "skills", label: "Skills", icon: <Brain className="h-4 w-4" /> },
		{
			id: "rules",
			label: "Rules",
			icon: <Settings className="h-4 w-4" />,
		},
		{
			id: "flows",
			label: "Flows",
			icon: <GitBranch className="h-4 w-4" />,
		},
	];

	const hasOverrides =
		overrides.disabledAgents.length > 0 ||
		overrides.disabledSkills.length > 0 ||
		Object.keys(overrides.tierOverrides).length > 0;

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-foreground">
					Engine Configuration
				</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Multi-agent orchestration engine — agents, skills, rules, and flows
				</p>
				{hasOverrides && (
					<div className="mt-2 flex items-center gap-2">
						<span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
							{overrides.disabledAgents.length} agents disabled,{" "}
							{overrides.disabledSkills.length} skills disabled,{" "}
							{Object.keys(overrides.tierOverrides).length} tier overrides
						</span>
						<button
							type="button"
							onClick={() =>
								setOverrides({
									disabledAgents: [],
									disabledSkills: [],
									tierOverrides: {},
								})
							}
							className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
						>
							Reset all
						</button>
					</div>
				)}
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
			{activeTab === "overview" && (
				<OverviewTab overrides={overrides} onNavigate={setActiveTab} />
			)}
			{activeTab === "agents" && (
				<AgentsTab
					overrides={overrides}
					onToggleAgent={toggleAgent}
					onChangeTier={changeTier}
				/>
			)}
			{activeTab === "skills" && (
				<SkillsTab overrides={overrides} onToggleSkill={toggleSkill} />
			)}
			{activeTab === "rules" && <RulesTab />}
			{activeTab === "flows" && (
				<FlowsTab overrides={overrides} onNavigateAgent={navigateToAgent} />
			)}
		</div>
	);
}
