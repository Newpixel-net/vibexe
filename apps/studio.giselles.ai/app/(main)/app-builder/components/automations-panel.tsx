"use client";

/**
 * AutomationsPanel Component
 *
 * Dashboard > Automations section for configuring app-level trigger/action automations.
 * Supports CRUD for automations with trigger type + action type configuration.
 */

import {
	Clock,
	Loader2,
	Pause,
	Play,
	Plus,
	Trash2,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Automation {
	dbId: number;
	name: string;
	enabled: boolean;
	triggerType: string;
	triggerConfig: Record<string, unknown>;
	actionType: string;
	actionConfig: Record<string, unknown>;
	lastRunAt: string | null;
	runCount: number;
	createdAt: string;
}

interface AutomationsPanelProps {
	appId: string;
}

const TRIGGER_TYPES = [
	{ value: "entity.created", label: "When entity is created" },
	{ value: "entity.updated", label: "When entity is updated" },
	{ value: "entity.deleted", label: "When entity is deleted" },
	{ value: "user.signup", label: "When user signs up" },
	{ value: "schedule", label: "On schedule" },
];

const ACTION_TYPES = [
	{ value: "send_email", label: "Send email" },
	{ value: "webhook", label: "Call webhook" },
	{ value: "update_entity", label: "Update entity" },
	{ value: "run_code", label: "Run custom code" },
];

function getTriggerLabel(type: string): string {
	return TRIGGER_TYPES.find((t) => t.value === type)?.label ?? type;
}

function getActionLabel(type: string): string {
	return ACTION_TYPES.find((a) => a.value === type)?.label ?? type;
}

export function AutomationsPanel({ appId }: AutomationsPanelProps) {
	const [automations, setAutomations] = useState<Automation[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [creating, setCreating] = useState(false);

	// Create form state
	const [newName, setNewName] = useState("");
	const [newTriggerType, setNewTriggerType] = useState("entity.created");
	const [newActionType, setNewActionType] = useState("webhook");
	const [newTriggerConfig, setNewTriggerConfig] = useState("");
	const [newActionConfig, setNewActionConfig] = useState("");

	const fetchAutomations = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/automations`);
			if (res.ok) {
				const data = await res.json();
				setAutomations(data.automations || []);
			}
		} catch {
			// Ignore
		}
		setLoading(false);
	}, [appId]);

	useEffect(() => {
		fetchAutomations();
	}, [fetchAutomations]);

	const handleCreate = useCallback(async () => {
		if (!newName.trim()) return;
		setCreating(true);
		try {
			let triggerConfig = {};
			let actionConfig = {};
			if (newTriggerConfig.trim()) {
				try {
					triggerConfig = JSON.parse(newTriggerConfig);
				} catch {
					// Invalid JSON, use empty
				}
			}
			if (newActionConfig.trim()) {
				try {
					actionConfig = JSON.parse(newActionConfig);
				} catch {
					// Invalid JSON, use empty
				}
			}

			const res = await fetch(`/api/apps/${appId}/automations`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: newName.trim(),
					triggerType: newTriggerType,
					triggerConfig,
					actionType: newActionType,
					actionConfig,
				}),
			});
			if (res.ok) {
				setShowCreateForm(false);
				setNewName("");
				setNewTriggerType("entity.created");
				setNewActionType("webhook");
				setNewTriggerConfig("");
				setNewActionConfig("");
				fetchAutomations();
			}
		} catch {
			// Error
		}
		setCreating(false);
	}, [appId, newName, newTriggerType, newActionType, newTriggerConfig, newActionConfig, fetchAutomations]);

	const handleToggle = useCallback(
		async (automation: Automation) => {
			// Optimistic update
			setAutomations((prev) =>
				prev.map((a) =>
					a.dbId === automation.dbId
						? { ...a, enabled: !a.enabled }
						: a,
				),
			);
			try {
				await fetch(`/api/apps/${appId}/automations`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						automationDbId: automation.dbId,
						enabled: !automation.enabled,
					}),
				});
			} catch {
				// Revert on error
				setAutomations((prev) =>
					prev.map((a) =>
						a.dbId === automation.dbId
							? { ...a, enabled: automation.enabled }
							: a,
					),
				);
			}
		},
		[appId],
	);

	const handleDelete = useCallback(
		async (dbId: number) => {
			if (!window.confirm("Delete this automation? This cannot be undone."))
				return;
			try {
				await fetch(`/api/apps/${appId}/automations`, {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ automationDbId: dbId }),
				});
				fetchAutomations();
			} catch {
				// Ignore
			}
		},
		[appId, fetchAutomations],
	);

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-white/40" />
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-2xl font-bold text-white/90">
								Automations
							</h1>
							<span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
								Paid Feature
							</span>
						</div>
						<p className="text-sm text-white/40 mt-1">
							Automate actions when events happen in your app
						</p>
					</div>
					{!showCreateForm && (
						<button
							type="button"
							onClick={() => setShowCreateForm(true)}
							className="px-3 py-2 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white hover:from-violet-500 hover:to-cyan-500 text-sm font-medium transition-colors flex items-center gap-2"
						>
							<Plus className="h-3.5 w-3.5" />
							New Automation
						</button>
					)}
				</div>

				{/* Create Form */}
				{showCreateForm && (
					<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-4">
						<h3 className="text-sm font-medium text-white/90">
							Create Automation
						</h3>

						{/* Name */}
						<div>
							<label className="block text-xs text-white/40 mb-1">
								Name
							</label>
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="e.g., Send welcome email on signup"
								className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
							/>
						</div>

						{/* Trigger + Action row */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-xs text-white/40 mb-1">
									Trigger
								</label>
								<select
									value={newTriggerType}
									onChange={(e) => setNewTriggerType(e.target.value)}
									className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
								>
									{TRIGGER_TYPES.map((t) => (
										<option key={t.value} value={t.value}>
											{t.label}
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="block text-xs text-white/40 mb-1">
									Action
								</label>
								<select
									value={newActionType}
									onChange={(e) => setNewActionType(e.target.value)}
									className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
								>
									{ACTION_TYPES.map((a) => (
										<option key={a.value} value={a.value}>
											{a.label}
										</option>
									))}
								</select>
							</div>
						</div>

						{/* Config fields */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-xs text-white/40 mb-1">
									Trigger Config (JSON, optional)
								</label>
								<textarea
									value={newTriggerConfig}
									onChange={(e) => setNewTriggerConfig(e.target.value)}
									placeholder='{"entity": "tasks"}'
									rows={2}
									className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-none"
								/>
							</div>
							<div>
								<label className="block text-xs text-white/40 mb-1">
									Action Config (JSON, optional)
								</label>
								<textarea
									value={newActionConfig}
									onChange={(e) => setNewActionConfig(e.target.value)}
									placeholder='{"url": "https://..."}'
									rows={2}
									className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-none"
								/>
							</div>
						</div>

						{/* Buttons */}
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleCreate}
								disabled={creating || !newName.trim()}
								className="px-4 py-2 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white hover:from-violet-500 hover:to-cyan-500 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
							>
								{creating && (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								)}
								Create
							</button>
							<button
								type="button"
								onClick={() => {
									setShowCreateForm(false);
									setNewName("");
									setNewTriggerConfig("");
									setNewActionConfig("");
								}}
								className="px-3 py-2 rounded-md border border-white/[0.08] text-sm text-white/40 hover:text-white/90 transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>
				)}

				{/* Automations List */}
				<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden">
					<div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
						<Zap className="h-4 w-4 text-white/40" />
						<h3 className="text-sm font-medium text-white/90">
							Automations ({automations.length})
						</h3>
					</div>
					{automations.length === 0 ? (
						<div className="p-8 text-center">
							<Zap className="h-8 w-8 text-white/20 mx-auto mb-3" />
							<p className="text-sm text-white/40">
								No automations yet
							</p>
							<p className="text-xs text-white/40 mt-1">
								Create an automation to trigger actions when events occur
							</p>
							{!showCreateForm && (
								<button
									type="button"
									onClick={() => setShowCreateForm(true)}
									className="mt-4 px-3 py-1.5 rounded-md border border-white/[0.08] text-sm text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors inline-flex items-center gap-1.5"
								>
									<Plus className="h-3.5 w-3.5" />
									New Automation
								</button>
							)}
						</div>
					) : (
						<div className="divide-y divide-white/[0.06]">
							{automations.map((automation) => (
								<div
									key={automation.dbId}
									className="flex items-center justify-between px-4 py-3"
								>
									<div className="flex items-center gap-3 min-w-0 flex-1">
										{/* Enable/disable toggle */}
										<button
											type="button"
											onClick={() => handleToggle(automation)}
											className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
												automation.enabled
													? "bg-gradient-to-r from-violet-500 to-cyan-500"
													: "bg-muted-foreground/20"
											}`}
											title={automation.enabled ? "Disable" : "Enable"}
										>
											<span
												className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white/[0.02] transition-transform ${
													automation.enabled
														? "translate-x-[18px]"
														: "translate-x-[3px]"
												}`}
											/>
										</button>

										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2 flex-wrap">
												<span className="text-sm font-medium text-white/90 truncate">
													{automation.name}
												</span>
											</div>
											<div className="flex items-center gap-2 mt-0.5 flex-wrap">
												<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
													{getTriggerLabel(automation.triggerType)}
												</span>
												<span className="text-[10px] text-white/40">
													then
												</span>
												<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
													{getActionLabel(automation.actionType)}
												</span>
											</div>
										</div>
									</div>

									<div className="flex items-center gap-3 flex-shrink-0 ml-3">
										{/* Run info */}
										<div className="text-right">
											<div className="flex items-center gap-1 text-xs text-white/40">
												<Clock className="h-3 w-3" />
												{automation.lastRunAt
													? new Date(automation.lastRunAt).toLocaleDateString()
													: "Never run"}
											</div>
											{automation.runCount > 0 && (
												<span className="text-[10px] text-white/40">
													{automation.runCount} run{automation.runCount !== 1 ? "s" : ""}
												</span>
											)}
										</div>

										{/* Delete */}
										<button
											type="button"
											onClick={() => handleDelete(automation.dbId)}
											className="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-500 transition-colors"
											title="Delete automation"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Info Section */}
				<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
					<div className="flex items-start gap-3">
						<Zap className="h-5 w-5 text-white/40 flex-shrink-0 mt-0.5" />
						<div>
							<h3 className="text-sm font-medium text-white/90">
								About Automations
							</h3>
							<ul className="text-xs text-white/40 mt-2 space-y-1 list-disc list-inside">
								<li>Automations run server-side when trigger events occur</li>
								<li>Supports entity lifecycle events and scheduled triggers</li>
								<li>Actions include sending emails, calling webhooks, and running code</li>
								<li>Toggle automations on/off without deleting their configuration</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
