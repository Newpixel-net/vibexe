"use client";

/**
 * AgentsPanel Component
 *
 * Dashboard > Agents section showing all 13 ECC agents in a grid.
 * Allows enabling/disabling agents and viewing their configuration.
 */

import { Bot, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { DEFAULT_AGENTS } from "@giselles-ai/vibexe-engine";
import { AgentCard } from "./agent-card";

export function AgentsPanel() {
	const [searchQuery, setSearchQuery] = useState("");
	const [agentStates, setAgentStates] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(DEFAULT_AGENTS.map((a) => [a.id, a.enabled])),
	);

	const filteredAgents = useMemo(() => {
		if (!searchQuery.trim()) return DEFAULT_AGENTS;
		const query = searchQuery.toLowerCase();
		return DEFAULT_AGENTS.filter(
			(agent) =>
				agent.name.toLowerCase().includes(query) ||
				agent.description.toLowerCase().includes(query) ||
				agent.skills.some((s) => s.toLowerCase().includes(query)),
		);
	}, [searchQuery]);

	const handleToggle = (agentId: string, enabled: boolean) => {
		setAgentStates((prev) => ({ ...prev, [agentId]: enabled }));
	};

	const enabledCount = Object.values(agentStates).filter(Boolean).length;
	const totalCount = DEFAULT_AGENTS.length;

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-6 py-4 border-b">
				<div className="flex items-center gap-3">
					<Bot className="h-5 w-5 text-primary" />
					<div>
						<h2 className="text-lg font-semibold text-foreground">
							AI Agents
						</h2>
						<p className="text-xs text-muted-foreground">
							{enabledCount}/{totalCount} agents enabled
						</p>
					</div>
				</div>

				{/* Search */}
				<div className="relative w-64">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search agents..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-9 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>
			</div>

			{/* Agent Grid */}
			<div className="flex-1 overflow-y-auto p-6">
				{/* Tier sections */}
				{(["opus", "sonnet", "haiku"] as const).map((tier) => {
					const tierAgents = filteredAgents.filter(
						(a) => a.modelTier === tier,
					);
					if (tierAgents.length === 0) return null;

					const tierLabels = {
						opus: {
							name: "Opus Tier",
							desc: "High-capability agents for complex analysis",
						},
						sonnet: {
							name: "Sonnet Tier",
							desc: "Balanced agents for code generation and review",
						},
						haiku: {
							name: "Haiku Tier",
							desc: "Fast agents for lightweight tasks",
						},
					};

					return (
						<div key={tier} className="mb-6">
							<div className="mb-3">
								<h3 className="text-sm font-medium text-foreground">
									{tierLabels[tier].name}
								</h3>
								<p className="text-xs text-muted-foreground">
									{tierLabels[tier].desc}
								</p>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								{tierAgents.map((agent) => (
									<AgentCard
										key={agent.id}
										agent={{
											...agent,
											enabled: agentStates[agent.id] ?? agent.enabled,
										}}
										onToggle={handleToggle}
									/>
								))}
							</div>
						</div>
					);
				})}

				{filteredAgents.length === 0 && (
					<div className="text-center py-12 text-muted-foreground">
						<Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p>No agents match &quot;{searchQuery}&quot;</p>
					</div>
				)}
			</div>
		</div>
	);
}
