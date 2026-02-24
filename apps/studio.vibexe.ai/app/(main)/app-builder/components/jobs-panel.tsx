"use client";

/**
 * JobsPanel Component
 *
 * Background jobs manager with CRUD, manual trigger, run history, and dead letter queue.
 */

import {
	AlertTriangle,
	Check,
	ChevronDown,
	ChevronRight,
	Clock,
	Eye,
	Loader2,
	Pause,
	Play,
	Plus,
	RefreshCw,
	Timer,
	Trash2,
	X,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Job {
	id: number;
	name: string;
	description: string;
	function_name: string;
	cron_expression: string;
	timezone: string;
	enabled: boolean;
	retry_policy: {
		maxRetries: number;
		initialDelayMs: number;
		maxDelayMs: number;
		backoffMultiplier: number;
	};
	timeout_ms: number;
	last_run_at: string | null;
	next_run_at: string | null;
	run_count: number;
	error_count: number;
	created_at: string;
}

interface JobRun {
	id: number;
	job_id: number;
	status: string;
	started_at: string;
	completed_at: string | null;
	duration_ms: number | null;
	error: string | null;
	attempt: number;
	manual: boolean;
}

interface DlqEntry {
	id: number;
	job_name: string;
	error: string;
	last_attempt_at: string;
	attempts: number;
	acknowledged: boolean;
}

interface FunctionItem {
	name: string;
	triggerType: string;
}

interface JobsPanelProps {
	appId: string;
}

type Tab = "jobs" | "dlq";

const STATUS_COLORS: Record<string, string> = {
	completed: "text-emerald-400",
	running: "text-blue-400",
	failed: "text-red-400",
	retrying: "text-yellow-400",
	pending: "text-white/40",
};

const STATUS_BG: Record<string, string> = {
	completed: "bg-emerald-500/10",
	running: "bg-blue-500/10",
	failed: "bg-red-500/10",
	retrying: "bg-yellow-500/10",
	pending: "bg-white/[0.03]",
};

function formatRelative(dateStr: string | null): string {
	if (!dateStr) return "Never";
	const d = new Date(dateStr);
	const now = Date.now();
	const diffMs = now - d.getTime();

	if (diffMs < 0) {
		// Future date
		const absDiff = Math.abs(diffMs);
		if (absDiff < 60000) return `in ${Math.round(absDiff / 1000)}s`;
		if (absDiff < 3600000) return `in ${Math.round(absDiff / 60000)}m`;
		if (absDiff < 86400000) return `in ${Math.round(absDiff / 3600000)}h`;
		return d.toLocaleDateString();
	}

	if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s ago`;
	if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}m ago`;
	if (diffMs < 86400000) return `${Math.round(diffMs / 3600000)}h ago`;
	return d.toLocaleDateString();
}

export function JobsPanel({ appId }: JobsPanelProps) {
	const [tab, setTab] = useState<Tab>("jobs");
	const [jobs, setJobs] = useState<Job[]>([]);
	const [dlqEntries, setDlqEntries] = useState<DlqEntry[]>([]);
	const [functions, setFunctions] = useState<FunctionItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
	const [jobRuns, setJobRuns] = useState<Record<number, JobRun[]>>({});
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState<Job | null>(null);
	const [triggering, setTriggering] = useState<number | null>(null);

	const fetchJobs = useCallback(async () => {
		try {
			setLoading(true);
			const res = await fetch(`/api/apps/${appId}/jobs`);
			if (res.ok) {
				const json = await res.json();
				setJobs(json.data ?? []);
			}
		} catch {
			// ignore
		} finally {
			setLoading(false);
		}
	}, [appId]);

	const fetchFunctions = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/functions`);
			if (res.ok) {
				const json = await res.json();
				setFunctions(json.data ?? []);
			}
		} catch {
			// ignore
		}
	}, [appId]);

	const fetchDlq = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/jobs/dlq`);
			if (res.ok) {
				const json = await res.json();
				setDlqEntries(json.data ?? []);
			}
		} catch {
			// ignore
		}
	}, [appId]);

	const fetchRuns = useCallback(async (jobId: number) => {
		try {
			const res = await fetch(`/api/apps/${appId}/jobs/${jobId}/runs?limit=10`);
			if (res.ok) {
				const json = await res.json();
				setJobRuns(prev => ({ ...prev, [jobId]: json.data ?? [] }));
			}
		} catch {
			// ignore
		}
	}, [appId]);

	useEffect(() => {
		fetchJobs();
		fetchFunctions();
	}, [fetchJobs, fetchFunctions]);

	useEffect(() => {
		if (tab === "dlq") fetchDlq();
	}, [tab, fetchDlq]);

	const handleToggleEnabled = async (job: Job) => {
		try {
			await fetch(`/api/apps/${appId}/jobs/${job.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: !job.enabled }),
			});
			setJobs(prev => prev.map(j => j.id === job.id ? { ...j, enabled: !j.enabled } : j));
		} catch {
			// ignore
		}
	};

	const handleTrigger = async (jobId: number) => {
		setTriggering(jobId);
		try {
			await fetch(`/api/apps/${appId}/jobs/${jobId}/trigger`, { method: "POST" });
			await fetchJobs();
			if (expandedJobId === jobId) await fetchRuns(jobId);
		} catch {
			// ignore
		} finally {
			setTriggering(null);
		}
	};

	const handleDelete = async (jobId: number) => {
		if (!confirm("Delete this job and all its run history?")) return;
		try {
			await fetch(`/api/apps/${appId}/jobs/${jobId}`, { method: "DELETE" });
			setJobs(prev => prev.filter(j => j.id !== jobId));
		} catch {
			// ignore
		}
	};

	const handleAcknowledgeDlq = async (dlqId: number) => {
		try {
			await fetch(`/api/apps/${appId}/jobs/dlq`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ dlqId }),
			});
			setDlqEntries(prev => prev.filter(e => e.id !== dlqId));
		} catch {
			// ignore
		}
	};

	const handleExpand = (jobId: number) => {
		if (expandedJobId === jobId) {
			setExpandedJobId(null);
		} else {
			setExpandedJobId(jobId);
			if (!jobRuns[jobId]) fetchRuns(jobId);
		}
	};

	const dlqCount = dlqEntries.filter(e => !e.acknowledged).length;

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-white/90">Background Jobs</h2>
					<p className="text-sm text-white/40 mt-1">
						Schedule recurring tasks with retry logic and monitoring
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => { fetchJobs(); if (tab === "dlq") fetchDlq(); }}
						className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
					>
						<RefreshCw className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={() => setShowCreateModal(true)}
						className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
					>
						<Plus className="h-4 w-4" />
						Create Job
					</button>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex gap-1 border-b border-white/[0.06] pb-0">
				<button
					type="button"
					onClick={() => setTab("jobs")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
						tab === "jobs"
							? "border-violet-400 text-white/90"
							: "border-transparent text-white/40 hover:text-white/60"
					}`}
				>
					Jobs ({jobs.length})
				</button>
				<button
					type="button"
					onClick={() => setTab("dlq")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
						tab === "dlq"
							? "border-violet-400 text-white/90"
							: "border-transparent text-white/40 hover:text-white/60"
					}`}
				>
					Dead Letter Queue
					{dlqCount > 0 && (
						<span className="px-1.5 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
							{dlqCount}
						</span>
					)}
				</button>
			</div>

			{/* Content */}
			{loading ? (
				<div className="flex items-center justify-center py-16">
					<Loader2 className="h-6 w-6 animate-spin text-white/40" />
				</div>
			) : tab === "jobs" ? (
				<JobsTable
					jobs={jobs}
					expandedJobId={expandedJobId}
					jobRuns={jobRuns}
					triggering={triggering}
					onExpand={handleExpand}
					onToggle={handleToggleEnabled}
					onTrigger={handleTrigger}
					onEdit={(job) => setShowEditModal(job)}
					onDelete={handleDelete}
				/>
			) : (
				<DlqTable entries={dlqEntries} onAcknowledge={handleAcknowledgeDlq} />
			)}

			{/* Create Modal */}
			{showCreateModal && (
				<JobFormModal
					appId={appId}
					functions={functions}
					onClose={() => setShowCreateModal(false)}
					onSaved={() => { setShowCreateModal(false); fetchJobs(); }}
				/>
			)}

			{/* Edit Modal */}
			{showEditModal && (
				<JobFormModal
					appId={appId}
					functions={functions}
					job={showEditModal}
					onClose={() => setShowEditModal(null)}
					onSaved={() => { setShowEditModal(null); fetchJobs(); }}
				/>
			)}
		</div>
	);
}

// ---- Jobs Table ----

function JobsTable({
	jobs,
	expandedJobId,
	jobRuns,
	triggering,
	onExpand,
	onToggle,
	onTrigger,
	onEdit,
	onDelete,
}: {
	jobs: Job[];
	expandedJobId: number | null;
	jobRuns: Record<number, JobRun[]>;
	triggering: number | null;
	onExpand: (id: number) => void;
	onToggle: (job: Job) => void;
	onTrigger: (id: number) => void;
	onEdit: (job: Job) => void;
	onDelete: (id: number) => void;
}) {
	if (jobs.length === 0) {
		return (
			<div className="text-center py-16">
				<Timer className="h-12 w-12 text-white/10 mx-auto mb-3" />
				<p className="text-white/40 text-sm">No scheduled jobs yet</p>
				<p className="text-white/20 text-xs mt-1">Create a job to run functions on a schedule</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{jobs.map(job => (
				<div key={job.id} className="border border-white/[0.06] rounded-lg overflow-hidden">
					{/* Job row */}
					<div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
						<button
							type="button"
							onClick={() => onExpand(job.id)}
							className="text-white/30 hover:text-white/60"
						>
							{expandedJobId === job.id ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</button>

						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<span className="text-sm font-medium text-white/90 truncate">{job.name}</span>
								{job.description && (
									<span className="text-xs text-white/30 truncate">{job.description}</span>
								)}
							</div>
							<div className="flex items-center gap-3 mt-0.5 text-xs text-white/30">
								<span className="font-mono">{job.cron_expression}</span>
								<span>&rarr; {job.function_name}</span>
							</div>
						</div>

						{/* Stats */}
						<div className="flex items-center gap-4 text-xs text-white/30 shrink-0">
							<div className="flex items-center gap-1" title="Success / Error">
								<Check className="h-3 w-3 text-emerald-400/60" />
								<span>{job.run_count}</span>
								<span className="text-white/10">/</span>
								<AlertTriangle className="h-3 w-3 text-red-400/60" />
								<span>{job.error_count}</span>
							</div>
							<div className="flex items-center gap-1" title="Last run">
								<Clock className="h-3 w-3" />
								<span>{formatRelative(job.last_run_at)}</span>
							</div>
							<div className="flex items-center gap-1" title="Next run">
								<Timer className="h-3 w-3" />
								<span>{job.enabled ? formatRelative(job.next_run_at) : "Paused"}</span>
							</div>
						</div>

						{/* Actions */}
						<div className="flex items-center gap-1 shrink-0">
							<button
								type="button"
								onClick={() => onToggle(job)}
								className={`p-1.5 rounded transition-colors ${
									job.enabled
										? "text-emerald-400 hover:bg-emerald-400/10"
										: "text-white/30 hover:bg-white/[0.06]"
								}`}
								title={job.enabled ? "Pause" : "Enable"}
							>
								{job.enabled ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
							</button>
							<button
								type="button"
								onClick={() => onTrigger(job.id)}
								disabled={triggering === job.id}
								className="p-1.5 rounded text-violet-400 hover:bg-violet-400/10 transition-colors disabled:opacity-50"
								title="Run now"
							>
								{triggering === job.id ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<Zap className="h-3.5 w-3.5" />
								)}
							</button>
							<button
								type="button"
								onClick={() => onEdit(job)}
								className="p-1.5 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
								title="Edit"
							>
								<Eye className="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onClick={() => onDelete(job.id)}
								className="p-1.5 rounded text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors"
								title="Delete"
							>
								<Trash2 className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>

					{/* Expanded run history */}
					{expandedJobId === job.id && (
						<div className="border-t border-white/[0.04] bg-white/[0.01] px-4 py-3">
							<h4 className="text-xs font-medium text-white/50 mb-2">Recent Runs</h4>
							{(jobRuns[job.id] ?? []).length === 0 ? (
								<p className="text-xs text-white/20">No runs yet</p>
							) : (
								<div className="space-y-1">
									{(jobRuns[job.id] ?? []).map(run => (
										<div
											key={run.id}
											className="flex items-center gap-3 text-xs py-1.5 px-2 rounded hover:bg-white/[0.02]"
										>
											<span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BG[run.status] ?? ""} ${STATUS_COLORS[run.status] ?? ""}`}>
												{run.status.toUpperCase()}
											</span>
											<span className="text-white/30">
												#{run.attempt}
											</span>
											<span className="text-white/40">
												{new Date(run.started_at).toLocaleString()}
											</span>
											{run.duration_ms != null && (
												<span className="text-white/20">
													{run.duration_ms}ms
												</span>
											)}
											{run.manual && (
												<span className="text-violet-400/60 text-[10px]">manual</span>
											)}
											{run.error && (
												<span className="text-red-400/70 truncate max-w-[200px]" title={run.error}>
													{run.error}
												</span>
											)}
										</div>
									))}
								</div>
							)}
						</div>
					)}
				</div>
			))}
		</div>
	);
}

// ---- DLQ Table ----

function DlqTable({
	entries,
	onAcknowledge,
}: {
	entries: DlqEntry[];
	onAcknowledge: (id: number) => void;
}) {
	if (entries.length === 0) {
		return (
			<div className="text-center py-16">
				<Check className="h-12 w-12 text-emerald-400/10 mx-auto mb-3" />
				<p className="text-white/40 text-sm">Dead letter queue is empty</p>
				<p className="text-white/20 text-xs mt-1">Failed jobs that exhausted all retries appear here</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{entries.map(entry => (
				<div
					key={entry.id}
					className={`border rounded-lg p-4 ${
						entry.acknowledged
							? "border-white/[0.04] opacity-50"
							: "border-red-400/20 bg-red-400/[0.02]"
					}`}
				>
					<div className="flex items-start justify-between gap-3">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
								<span className="text-sm font-medium text-white/80">{entry.job_name}</span>
								<span className="text-xs text-white/30">
									{entry.attempts} attempt{entry.attempts !== 1 ? "s" : ""}
								</span>
							</div>
							<p className="text-xs text-red-400/70 mt-1 font-mono truncate">{entry.error}</p>
							<p className="text-xs text-white/20 mt-1">
								Last attempt: {new Date(entry.last_attempt_at).toLocaleString()}
							</p>
						</div>
						{!entry.acknowledged && (
							<button
								type="button"
								onClick={() => onAcknowledge(entry.id)}
								className="px-3 py-1.5 rounded text-xs text-white/60 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.08] transition-colors shrink-0"
							>
								Acknowledge
							</button>
						)}
					</div>
				</div>
			))}
		</div>
	);
}

// ---- Job Create/Edit Modal ----

function JobFormModal({
	appId,
	functions,
	job,
	onClose,
	onSaved,
}: {
	appId: string;
	functions: FunctionItem[];
	job?: Job;
	onClose: () => void;
	onSaved: () => void;
}) {
	const isEdit = !!job;
	const [name, setName] = useState(job?.name ?? "");
	const [functionName, setFunctionName] = useState(job?.function_name ?? "");
	const [cronExpression, setCronExpression] = useState(job?.cron_expression ?? "*/5 * * * *");
	const [timezone, setTimezone] = useState(job?.timezone ?? "UTC");
	const [description, setDescription] = useState(job?.description ?? "");
	const [maxRetries, setMaxRetries] = useState(job?.retry_policy?.maxRetries ?? 3);
	const [initialDelayMs, setInitialDelayMs] = useState(job?.retry_policy?.initialDelayMs ?? 5000);
	const [maxDelayMs, setMaxDelayMs] = useState(job?.retry_policy?.maxDelayMs ?? 300000);
	const [backoffMultiplier, setBackoffMultiplier] = useState(job?.retry_policy?.backoffMultiplier ?? 2);
	const [timeoutMs, setTimeoutMs] = useState(job?.timeout_ms ?? 30000);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const handleSave = async () => {
		setError("");
		setSaving(true);
		try {
			const body = isEdit
				? {
					functionName,
					cronExpression,
					timezone,
					description,
					retryPolicy: { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier },
					timeoutMs,
				}
				: {
					name,
					functionName,
					cronExpression,
					timezone,
					description,
					retryPolicy: { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier },
					timeoutMs,
				};

			const res = await fetch(
				isEdit ? `/api/apps/${appId}/jobs/${job.id}` : `/api/apps/${appId}/jobs`,
				{
					method: isEdit ? "PUT" : "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
			);

			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				setError((errData as Record<string, string>).error ?? "Failed to save");
				return;
			}

			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="bg-[#1a1a2e] border border-white/[0.08] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
				<div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
					<h3 className="text-sm font-semibold text-white/90">
						{isEdit ? "Edit Job" : "Create Background Job"}
					</h3>
					<button type="button" onClick={onClose} className="text-white/30 hover:text-white/60">
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="p-4 space-y-4">
					{/* Name */}
					{!isEdit && (
						<div>
							<label className="block text-xs text-white/50 mb-1.5">Job Name</label>
							<input
								type="text"
								value={name}
								onChange={e => setName(e.target.value)}
								placeholder="daily-cleanup"
								className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-violet-400/40"
							/>
						</div>
					)}

					{/* Function */}
					<div>
						<label className="block text-xs text-white/50 mb-1.5">Function</label>
						<select
							value={functionName}
							onChange={e => setFunctionName(e.target.value)}
							className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 focus:outline-none focus:border-violet-400/40"
						>
							<option value="">Select a function...</option>
							{functions.map(fn => (
								<option key={fn.name} value={fn.name}>
									{fn.name} ({fn.triggerType})
								</option>
							))}
						</select>
					</div>

					{/* Cron Expression */}
					<div>
						<label className="block text-xs text-white/50 mb-1.5">Cron Expression</label>
						<input
							type="text"
							value={cronExpression}
							onChange={e => setCronExpression(e.target.value)}
							placeholder="*/5 * * * *"
							className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 font-mono placeholder:text-white/20 focus:outline-none focus:border-violet-400/40"
						/>
						<p className="text-[10px] text-white/20 mt-1">
							Format: minute hour day month weekday (min interval: 5 min)
						</p>
					</div>

					{/* Timezone */}
					<div>
						<label className="block text-xs text-white/50 mb-1.5">Timezone</label>
						<input
							type="text"
							value={timezone}
							onChange={e => setTimezone(e.target.value)}
							placeholder="UTC"
							className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-violet-400/40"
						/>
					</div>

					{/* Description */}
					<div>
						<label className="block text-xs text-white/50 mb-1.5">Description</label>
						<input
							type="text"
							value={description}
							onChange={e => setDescription(e.target.value)}
							placeholder="Optional description"
							className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-violet-400/40"
						/>
					</div>

					{/* Retry Policy */}
					<div>
						<label className="block text-xs text-white/50 mb-2">Retry Policy</label>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="block text-[10px] text-white/30 mb-1">Max Retries</label>
								<input
									type="number"
									value={maxRetries}
									onChange={e => setMaxRetries(Number(e.target.value))}
									min={0}
									max={10}
									className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 focus:outline-none focus:border-violet-400/40"
								/>
							</div>
							<div>
								<label className="block text-[10px] text-white/30 mb-1">Initial Delay (ms)</label>
								<input
									type="number"
									value={initialDelayMs}
									onChange={e => setInitialDelayMs(Number(e.target.value))}
									min={1000}
									className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 focus:outline-none focus:border-violet-400/40"
								/>
							</div>
							<div>
								<label className="block text-[10px] text-white/30 mb-1">Max Delay (ms)</label>
								<input
									type="number"
									value={maxDelayMs}
									onChange={e => setMaxDelayMs(Number(e.target.value))}
									min={1000}
									className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 focus:outline-none focus:border-violet-400/40"
								/>
							</div>
							<div>
								<label className="block text-[10px] text-white/30 mb-1">Backoff Multiplier</label>
								<input
									type="number"
									value={backoffMultiplier}
									onChange={e => setBackoffMultiplier(Number(e.target.value))}
									min={1}
									max={10}
									step={0.5}
									className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 focus:outline-none focus:border-violet-400/40"
								/>
							</div>
						</div>
					</div>

					{/* Timeout */}
					<div>
						<label className="block text-xs text-white/50 mb-1.5">Timeout (ms)</label>
						<input
							type="number"
							value={timeoutMs}
							onChange={e => setTimeoutMs(Number(e.target.value))}
							min={1000}
							max={30000}
							className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 focus:outline-none focus:border-violet-400/40"
						/>
						<p className="text-[10px] text-white/20 mt-1">Max 30000ms (30 seconds)</p>
					</div>

					{error && (
						<p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
					)}
				</div>

				<div className="flex items-center justify-end gap-2 p-4 border-t border-white/[0.06]">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={saving || (!isEdit && !name) || !functionName || !cronExpression}
						className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving ? "Saving..." : isEdit ? "Update" : "Create"}
					</button>
				</div>
			</div>
		</div>
	);
}
