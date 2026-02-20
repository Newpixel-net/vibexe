"use client";

/**
 * AgentsPanel Component
 *
 * Dashboard > Agents section for configuring app-level AI agents.
 * Users can create, enable/disable, edit, and delete agents for their deployed apps.
 */

import {
	Bot,
	ChevronDown,
	ChevronRight,
	Loader2,
	Plus,
	Settings,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Agent {
	dbId: number;
	name: string;
	enabled: boolean;
	systemPrompt: string | null;
	model: string;
	temperature: string;
	toolsEnabled: unknown[];
	uiConfig: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

interface AgentsPanelProps {
	appId: string;
	/** Kept for compatibility with parent — not used */
	files?: unknown[];
}

const MODEL_OPTIONS = [
	{ value: "gpt-4o-mini", label: "GPT-4o Mini" },
	{ value: "gpt-4o", label: "GPT-4o" },
	{ value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
	{ value: "grok-3-mini", label: "Grok 3 Mini" },
];

function modelLabel(model: string): string {
	return MODEL_OPTIONS.find((m) => m.value === model)?.label ?? model;
}

export function AgentsPanel({ appId }: AgentsPanelProps) {
	const [agents, setAgents] = useState<Agent[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [expandedId, setExpandedId] = useState<number | null>(null);

	// Fetch agents on mount
	useEffect(() => {
		async function fetchAgents() {
			try {
				const res = await fetch(`/api/apps/${appId}/agents`);
				if (res.ok) {
					const data = await res.json();
					setAgents(data.agents ?? []);
				}
			} catch {
				// Silently fail — show empty state
			} finally {
				setLoading(false);
			}
		}
		fetchAgents();
	}, [appId]);

	// Create agent
	const handleCreate = useCallback(async () => {
		setSaving(true);
		try {
			const res = await fetch(`/api/apps/${appId}/agents`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "AI Assistant" }),
			});
			if (res.ok) {
				const data = await res.json();
				setAgents((prev) => [...prev, data.agent]);
				setExpandedId(data.agent.dbId);
			}
		} catch {
			// Failed to create
		} finally {
			setSaving(false);
		}
	}, [appId]);

	// Toggle enabled
	const handleToggle = useCallback(
		async (agentDbId: number, enabled: boolean) => {
			// Optimistic update
			setAgents((prev) =>
				prev.map((a) => (a.dbId === agentDbId ? { ...a, enabled } : a)),
			);

			try {
				await fetch(`/api/apps/${appId}/agents`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ agentDbId, enabled }),
				});
			} catch {
				// Revert on error
				setAgents((prev) =>
					prev.map((a) =>
						a.dbId === agentDbId ? { ...a, enabled: !enabled } : a,
					),
				);
			}
		},
		[appId],
	);

	// Save agent fields
	const handleSave = useCallback(
		async (agentDbId: number, fields: Partial<Agent>) => {
			setSaving(true);
			try {
				const res = await fetch(`/api/apps/${appId}/agents`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ agentDbId, ...fields }),
				});
				if (res.ok) {
					const data = await res.json();
					setAgents((prev) =>
						prev.map((a) => (a.dbId === agentDbId ? data.agent : a)),
					);
				}
			} catch {
				// Save failed
			} finally {
				setSaving(false);
			}
		},
		[appId],
	);

	// Delete agent
	const handleDelete = useCallback(
		async (agentDbId: number) => {
			const prev = agents;
			setAgents((a) => a.filter((agent) => agent.dbId !== agentDbId));
			setExpandedId(null);

			try {
				const res = await fetch(`/api/apps/${appId}/agents`, {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ agentDbId }),
				});
				if (!res.ok) {
					setAgents(prev);
				}
			} catch {
				setAgents(prev);
			}
		},
		[appId, agents],
	);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const enabledCount = agents.filter((a) => a.enabled).length;

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<div className="flex items-center gap-3">
							<Bot className="h-5 w-5 text-primary" />
							<h1 className="text-2xl font-bold text-foreground">
								AI Agents
							</h1>
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							Configure AI agents for your deployed app.
							{agents.length > 0 && (
								<span className="ml-2">
									{enabledCount}/{agents.length} enabled
								</span>
							)}
						</p>
					</div>
					<button
						type="button"
						onClick={handleCreate}
						disabled={saving}
						className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
					>
						{saving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Plus className="h-4 w-4" />
						)}
						Create Agent
					</button>
				</div>

				{/* Empty State */}
				{agents.length === 0 && (
					<div className="rounded-lg border border-border bg-card p-12 text-center">
						<Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
						<h3 className="text-lg font-medium text-foreground mb-1">
							No AI agents configured yet
						</h3>
						<p className="text-sm text-muted-foreground mb-4">
							Create an agent to add AI capabilities to your app.
						</p>
						<button
							type="button"
							onClick={handleCreate}
							disabled={saving}
							className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
						>
							<Plus className="h-4 w-4" />
							Create Agent
						</button>
					</div>
				)}

				{/* Agent List */}
				{agents.map((agent) => {
					const isExpanded = expandedId === agent.dbId;

					return (
						<div
							key={agent.dbId}
							className="rounded-lg border border-border bg-card overflow-hidden"
						>
							{/* Agent Row */}
							<div className="flex items-center justify-between p-4">
								<button
									type="button"
									onClick={() =>
										setExpandedId(isExpanded ? null : agent.dbId)
									}
									className="flex items-center gap-3 flex-1 text-left"
								>
									{isExpanded ? (
										<ChevronDown className="h-4 w-4 text-muted-foreground" />
									) : (
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									)}
									<div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
										<Bot className="h-5 w-5 text-muted-foreground" />
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<h3 className="text-sm font-medium text-foreground truncate">
												{agent.name}
											</h3>
											<span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
												{modelLabel(agent.model)}
											</span>
										</div>
										<p className="text-xs text-muted-foreground truncate">
											{agent.systemPrompt
												? agent.systemPrompt.slice(0, 80) +
													(agent.systemPrompt.length > 80 ? "..." : "")
												: "No system prompt"}
										</p>
									</div>
								</button>

								{/* Toggle */}
								<button
									type="button"
									onClick={() => handleToggle(agent.dbId, !agent.enabled)}
									className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-3 ${
										agent.enabled
											? "bg-foreground"
											: "bg-muted-foreground/20"
									}`}
								>
									<span
										className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
											agent.enabled
												? "translate-x-6"
												: "translate-x-1"
										}`}
									/>
								</button>
							</div>

							{/* Expanded Editor */}
							{isExpanded && (
								<AgentEditor
									agent={agent}
									onSave={handleSave}
									onDelete={handleDelete}
									saving={saving}
								/>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

// ------------------------------------------------------------------
// Agent Editor (inline form)
// ------------------------------------------------------------------

interface AgentEditorProps {
	agent: Agent;
	onSave: (dbId: number, fields: Partial<Agent>) => Promise<void>;
	onDelete: (dbId: number) => Promise<void>;
	saving: boolean;
}

function AgentEditor({ agent, onSave, onDelete, saving }: AgentEditorProps) {
	const [name, setName] = useState(agent.name);
	const [model, setModel] = useState(agent.model);
	const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt ?? "");
	const [temperature, setTemperature] = useState(
		Number.parseFloat(agent.temperature) || 0.7,
	);
	const [enabled, setEnabled] = useState(agent.enabled);

	const hasChanges =
		name !== agent.name ||
		model !== agent.model ||
		systemPrompt !== (agent.systemPrompt ?? "") ||
		temperature !== (Number.parseFloat(agent.temperature) || 0.7) ||
		enabled !== agent.enabled;

	const handleSubmit = () => {
		onSave(agent.dbId, {
			name,
			model,
			systemPrompt: systemPrompt || null,
			temperature: temperature.toString(),
			enabled,
		} as Partial<Agent>);
	};

	return (
		<div className="border-t border-border p-4 space-y-4 bg-muted/30">
			{/* Name */}
			<div>
				<label className="block text-xs font-medium text-muted-foreground mb-1">
					Name
				</label>
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
					placeholder="Agent name"
				/>
			</div>

			{/* Enable toggle */}
			<div className="flex items-center justify-between">
				<label className="text-xs font-medium text-muted-foreground">
					Enabled
				</label>
				<button
					type="button"
					onClick={() => setEnabled(!enabled)}
					className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
						enabled ? "bg-foreground" : "bg-muted-foreground/20"
					}`}
				>
					<span
						className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
							enabled ? "translate-x-6" : "translate-x-1"
						}`}
					/>
				</button>
			</div>

			{/* Model picker */}
			<div>
				<label className="block text-xs font-medium text-muted-foreground mb-1">
					Model
				</label>
				<select
					value={model}
					onChange={(e) => setModel(e.target.value)}
					className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
				>
					{MODEL_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			</div>

			{/* System Prompt */}
			<div>
				<label className="block text-xs font-medium text-muted-foreground mb-1">
					System Prompt
				</label>
				<textarea
					value={systemPrompt}
					onChange={(e) => setSystemPrompt(e.target.value)}
					rows={6}
					className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-y font-mono"
					placeholder="You are a helpful AI assistant..."
				/>
			</div>

			{/* Temperature */}
			<div>
				<div className="flex items-center justify-between mb-1">
					<label className="text-xs font-medium text-muted-foreground">
						Temperature
					</label>
					<span className="text-xs text-muted-foreground tabular-nums">
						{temperature.toFixed(1)}
					</span>
				</div>
				<input
					type="range"
					min="0"
					max="1"
					step="0.1"
					value={temperature}
					onChange={(e) =>
						setTemperature(Number.parseFloat(e.target.value))
					}
					className="w-full accent-foreground"
				/>
				<div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
					<span>Precise</span>
					<span>Creative</span>
				</div>
			</div>

			{/* Actions */}
			<div className="flex items-center justify-between pt-2">
				<button
					type="button"
					onClick={() => onDelete(agent.dbId)}
					className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
				>
					<Trash2 className="h-3.5 w-3.5" />
					Delete
				</button>

				<button
					type="button"
					onClick={handleSubmit}
					disabled={!hasChanges || saving}
					className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
				>
					{saving ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Settings className="h-4 w-4" />
					)}
					Save Changes
				</button>
			</div>
		</div>
	);
}
