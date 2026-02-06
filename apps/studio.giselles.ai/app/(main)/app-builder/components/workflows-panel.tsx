"use client";

import {
	ExternalLink,
	GitBranch,
	Link2,
	Loader2,
	Plus,
	Trash2,
	Workflow,
	X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface LinkedWorkflow {
	id: string;
	workspaceId: string;
	purpose: string | null;
	label: string | null;
	createdAt: string;
	workspace: {
		id: string;
		name: string | null;
		updatedAt: string;
	};
}

interface AvailableWorkflow {
	id: string;
	name: string | null;
	updatedAt: string;
	createdAt: string;
}

const WORKFLOW_TEMPLATES = [
	{
		purpose: "testing",
		label: "Auto-Test Workflow",
		description:
			"Runs generated code through test scenarios to catch bugs early.",
		icon: "🧪",
	},
	{
		purpose: "content-pipeline",
		label: "Content Pipeline",
		description:
			"Generates content (copy, images) for your app automatically.",
		icon: "📝",
	},
	{
		purpose: "ci-cd",
		label: "GitHub Sync",
		description: "Pushes generated code to a GitHub repository on changes.",
		icon: "🔄",
	},
	{
		purpose: "scheduled-refresh",
		label: "Scheduled Refresh",
		description:
			"Re-runs AI generation on a schedule to keep app content fresh.",
		icon: "⏰",
	},
];

interface WorkflowsPanelProps {
	appId: string;
}

export function WorkflowsPanel({ appId }: WorkflowsPanelProps) {
	const [linkedWorkflows, setLinkedWorkflows] = useState<LinkedWorkflow[]>([]);
	const [availableWorkflows, setAvailableWorkflows] = useState<
		AvailableWorkflow[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [showAttachDialog, setShowAttachDialog] = useState(false);
	const [attachPurpose, setAttachPurpose] = useState("");
	const [attachLabel, setAttachLabel] = useState("");
	const [attaching, setAttaching] = useState(false);

	const fetchLinkedWorkflows = useCallback(async () => {
		try {
			const res = await fetch(`/api/app-builder/apps/${appId}/workflows`);
			if (res.ok) {
				const data = await res.json();
				setLinkedWorkflows(data.workflows);
			}
		} catch {
			// Silently fail
		}
	}, [appId]);

	const fetchAvailableWorkflows = useCallback(async () => {
		try {
			const res = await fetch("/api/app-builder/workflows");
			if (res.ok) {
				const data = await res.json();
				setAvailableWorkflows(data.workflows);
			}
		} catch {
			// Silently fail
		}
	}, []);

	useEffect(() => {
		Promise.all([fetchLinkedWorkflows(), fetchAvailableWorkflows()]).finally(
			() => setLoading(false),
		);
	}, [fetchLinkedWorkflows, fetchAvailableWorkflows]);

	const handleAttach = async (workspaceId: string) => {
		setAttaching(true);
		try {
			const res = await fetch(`/api/app-builder/apps/${appId}/workflows`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					workspaceId,
					purpose: attachPurpose || undefined,
					label: attachLabel || undefined,
				}),
			});
			if (res.ok) {
				await fetchLinkedWorkflows();
				setShowAttachDialog(false);
				setAttachPurpose("");
				setAttachLabel("");
			}
		} catch {
			// Silently fail
		} finally {
			setAttaching(false);
		}
	};

	const handleDetach = async (linkId: string) => {
		if (!confirm("Detach this workflow from the app?")) return;
		try {
			await fetch(`/api/app-builder/apps/${appId}/workflows`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ linkId }),
			});
			await fetchLinkedWorkflows();
		} catch {
			// Silently fail
		}
	};

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// Filter out already-linked workflows
	const linkedIds = new Set(linkedWorkflows.map((lw) => lw.workspaceId));
	const unlinkedWorkflows = availableWorkflows.filter(
		(w) => !linkedIds.has(w.id),
	);

	return (
		<div className="flex-1 flex flex-col overflow-auto p-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="text-lg font-semibold flex items-center gap-2">
						<Workflow className="h-5 w-5" />
						Workflows
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Connect Giselle workflows to automate testing, content generation,
						and more.
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowAttachDialog(true)}
					className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
				>
					<Plus className="h-4 w-4" />
					Attach Workflow
				</button>
			</div>

			{/* Linked Workflows */}
			{linkedWorkflows.length > 0 ? (
				<div className="space-y-3 mb-8">
					<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
						Linked Workflows
					</h3>
					{linkedWorkflows.map((lw) => (
						<div
							key={lw.id}
							className="flex items-center justify-between p-4 border border-border/50 rounded-lg bg-card/50"
						>
							<div className="flex items-center gap-3">
								<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
									<GitBranch className="h-5 w-5 text-primary" />
								</div>
								<div>
									<div className="font-medium text-sm">
										{lw.label || lw.workspace.name || "Untitled Workflow"}
									</div>
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										{lw.purpose && (
											<span className="px-1.5 py-0.5 bg-muted rounded text-xs">
												{lw.purpose}
											</span>
										)}
										<span>
											Updated{" "}
											{new Date(lw.workspace.updatedAt).toLocaleDateString()}
										</span>
									</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Link
									href={`/workspaces/${lw.workspaceId}`}
									className="p-2 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
									title="Open in Workflow Editor"
								>
									<ExternalLink className="h-4 w-4" />
								</Link>
								<button
									type="button"
									onClick={() => handleDetach(lw.id)}
									className="p-2 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
									title="Detach workflow"
								>
									<Trash2 className="h-4 w-4" />
								</button>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="text-center py-12 border border-dashed rounded-lg mb-8">
					<Link2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
					<h3 className="text-sm font-medium mb-1">No workflows linked</h3>
					<p className="text-xs text-muted-foreground mb-4">
						Attach a Giselle workflow to automate tasks for this app.
					</p>
					<button
						type="button"
						onClick={() => setShowAttachDialog(true)}
						className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors text-sm"
					>
						<Plus className="h-3.5 w-3.5" />
						Attach Workflow
					</button>
				</div>
			)}

			{/* Workflow Templates Suggestions */}
			<div>
				<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
					Workflow Templates
				</h3>
				<div className="grid gap-3 md:grid-cols-2">
					{WORKFLOW_TEMPLATES.map((template) => (
						<div
							key={template.purpose}
							className="p-4 border border-border/50 rounded-lg bg-card/30 hover:border-primary/30 transition-colors"
						>
							<div className="flex items-start gap-3">
								<span className="text-xl">{template.icon}</span>
								<div>
									<div className="font-medium text-sm">{template.label}</div>
									<p className="text-xs text-muted-foreground mt-1">
										{template.description}
									</p>
									<span className="inline-block mt-2 text-xs text-muted-foreground/60">
										Coming soon
									</span>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Attach Dialog */}
			{showAttachDialog && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
						<div className="flex items-center justify-between px-6 py-4 border-b border-border">
							<h3 className="text-base font-semibold">Attach Workflow</h3>
							<button
								type="button"
								onClick={() => setShowAttachDialog(false)}
								className="p-1 rounded hover:bg-muted transition-colors"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<div className="px-6 py-4 space-y-4 overflow-auto flex-1">
							{/* Optional label + purpose */}
							<div className="grid gap-3 sm:grid-cols-2">
								<div>
									<label className="text-xs font-medium text-muted-foreground block mb-1">
										Label (optional)
									</label>
									<input
										type="text"
										value={attachLabel}
										onChange={(e) => setAttachLabel(e.target.value)}
										placeholder="e.g., My Test Runner"
										className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
									/>
								</div>
								<div>
									<label className="text-xs font-medium text-muted-foreground block mb-1">
										Purpose (optional)
									</label>
									<select
										value={attachPurpose}
										onChange={(e) => setAttachPurpose(e.target.value)}
										className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
									>
										<option value="">General</option>
										<option value="testing">Testing</option>
										<option value="content-pipeline">Content Pipeline</option>
										<option value="ci-cd">CI/CD</option>
										<option value="scheduled-refresh">
											Scheduled Refresh
										</option>
									</select>
								</div>
							</div>

							{/* Available workflows */}
							<div>
								<label className="text-xs font-medium text-muted-foreground block mb-2">
									Select a workflow
								</label>
								{unlinkedWorkflows.length === 0 ? (
									<div className="text-center py-8 border border-dashed rounded-lg">
										<p className="text-sm text-muted-foreground mb-2">
											No available workflows.
										</p>
										<Link
											href="/workspaces"
											className="text-sm text-primary hover:underline"
										>
											Create a new workflow
										</Link>
									</div>
								) : (
									<div className="space-y-2 max-h-60 overflow-auto">
										{unlinkedWorkflows.map((w) => (
											<button
												key={w.id}
												type="button"
												onClick={() => handleAttach(w.id)}
												disabled={attaching}
												className="w-full flex items-center gap-3 p-3 border border-border/50 rounded-lg hover:border-primary/50 hover:bg-muted/30 transition-colors text-left disabled:opacity-50"
											>
												<GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
												<div className="min-w-0 flex-1">
													<div className="text-sm font-medium truncate">
														{w.name || "Untitled Workflow"}
													</div>
													<div className="text-xs text-muted-foreground">
														Updated{" "}
														{new Date(w.updatedAt).toLocaleDateString()}
													</div>
												</div>
												{attaching && (
													<Loader2 className="h-4 w-4 animate-spin shrink-0" />
												)}
											</button>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
