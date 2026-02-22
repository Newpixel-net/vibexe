"use client";

/**
 * WebhooksPanel Component
 *
 * Dashboard > Webhooks section for configuring webhook endpoints.
 * Supports CRUD, event selection, signing secrets, test pings, and delivery logs.
 */

import {
	AlertCircle,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Copy,
	ExternalLink,
	Loader2,
	Plus,
	RefreshCw,
	Send,
	Trash2,
	Webhook,
	X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";

interface WebhookItem {
	dbId: number;
	url: string;
	description: string | null;
	events: string[];
	secret: string | null;
	headers: Record<string, string>;
	enabled: boolean;
	lastDeliveryAt: string | null;
	lastDeliveryOk: boolean | null;
	deliverySuccessCount: number;
	deliveryFailureCount: number;
	timeoutMs?: number;
	createdAt: string;
}

interface DeliveryLog {
	dbId: number;
	eventType: string;
	responseStatus: number | null;
	success: boolean;
	durationMs: number | null;
	attempt: number;
	errorMessage: string | null;
	createdAt: string;
}

interface WebhooksPanelProps {
	appId: string;
	schema: {
		entities: Array<{
			name: string;
			tableName: string;
			fields: Array<{ name: string; type: string; required?: boolean }>;
		}>;
	} | null;
}

/** All available auth events */
const AUTH_EVENTS = [
	{ value: "user.signup", label: "User signs up" },
	{ value: "user.signin", label: "User signs in" },
];

/** Build entity events from schema */
function buildEntityEvents(
	entities: WebhooksPanelProps["schema"],
): Array<{ value: string; label: string }> {
	if (!entities?.entities?.length) return [];
	const events: Array<{ value: string; label: string }> = [];
	for (const entity of entities.entities) {
		events.push(
			{
				value: `entity.created:${entity.tableName}`,
				label: `${entity.name} created`,
			},
			{
				value: `entity.updated:${entity.tableName}`,
				label: `${entity.name} updated`,
			},
			{
				value: `entity.deleted:${entity.tableName}`,
				label: `${entity.name} deleted`,
			},
		);
	}
	return events;
}

function StatusDot({ ok }: { ok: boolean | null }) {
	if (ok === null)
		return (
			<span className="inline-block w-2 h-2 rounded-full bg-white/20" />
		);
	return ok ? (
		<span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
	) : (
		<span className="inline-block w-2 h-2 rounded-full bg-red-500" />
	);
}

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

export function WebhooksPanel({ appId, schema }: WebhooksPanelProps) {
	const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [expandedLogs, setExpandedLogs] = useState<number | null>(null);
	const [logs, setLogs] = useState<DeliveryLog[]>([]);
	const [logsLoading, setLogsLoading] = useState(false);
	const [logsPage, setLogsPage] = useState(1);
	const [logsTotalPages, setLogsTotalPages] = useState(1);
	const [testingId, setTestingId] = useState<number | null>(null);
	const [testResult, setTestResult] = useState<{
		success: boolean;
		status?: number;
		durationMs?: number;
	} | null>(null);

	// Form state
	const [formUrl, setFormUrl] = useState("");
	const [formDescription, setFormDescription] = useState("");
	const [formEvents, setFormEvents] = useState<string[]>([]);
	const [formSecret, setFormSecret] = useState("");
	const [formHeaders, setFormHeaders] = useState<
		Array<{ uid: string; key: string; value: string }>
	>([]);
	const [formTimeout, setFormTimeout] = useState(10000);

	const entityEvents = buildEntityEvents(schema);
	const allEvents = [...entityEvents, ...AUTH_EVENTS];

	const fetchWebhooks = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/webhooks`);
			if (res.ok) {
				const data = await res.json();
				setWebhooks(data.webhooks || []);
			}
		} catch {
			// ignore
		}
		setLoading(false);
	}, [appId]);

	useEffect(() => {
		fetchWebhooks();
	}, [fetchWebhooks]);

	const fetchLogs = useCallback(
		async (webhookDbId: number, page = 1) => {
			setLogs([]);
			setLogsLoading(true);
			try {
				const res = await fetch(
					`/api/apps/${appId}/webhooks/${webhookDbId}/logs?limit=10&page=${page}`,
				);
				if (res.ok) {
					const data = await res.json();
					setLogs(data.logs || []);
					setLogsPage(data.pagination?.page || 1);
					setLogsTotalPages(data.pagination?.totalPages || 1);
				}
			} catch {
				// ignore
			}
			setLogsLoading(false);
		},
		[appId],
	);

	const resetForm = () => {
		setFormUrl("");
		setFormDescription("");
		setFormEvents([]);
		setFormSecret("");
		setFormHeaders([]);
		setFormTimeout(10000);
		setEditingId(null);
	};

	const openCreateForm = () => {
		resetForm();
		setShowForm(true);
	};

	const openEditForm = (wh: WebhookItem) => {
		setFormUrl(wh.url);
		setFormDescription(wh.description || "");
		setFormEvents([...wh.events]);
		setFormSecret("");
		setFormHeaders(
			Object.entries(wh.headers || {}).map(([key, value]) => ({
				uid: nanoid(8),
				key,
				value,
			})),
		);
		setFormTimeout(wh.timeoutMs ?? 10000);
		setEditingId(wh.dbId);
		setShowForm(true);
	};

	const handleSave = useCallback(async () => {
		if (!formUrl.trim() || formEvents.length === 0) return;
		setSaving(true);
		try {
			const headers =
				formHeaders.length > 0
					? Object.fromEntries(
							formHeaders
								.filter((h) => h.key.trim())
								.map((h) => [h.key.trim(), h.value]),
						)
					: {};

			const res = editingId
				? await fetch(`/api/apps/${appId}/webhooks`, {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							webhookDbId: editingId,
							url: formUrl.trim(),
							description: formDescription.trim() || null,
							events: formEvents,
							secret: formSecret || undefined,
							headers,
							timeoutMs: formTimeout,
						}),
					})
				: await fetch(`/api/apps/${appId}/webhooks`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							url: formUrl.trim(),
							description: formDescription.trim() || null,
							events: formEvents,
							secret: formSecret || null,
							headers,
						}),
					});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				alert(
					(err as Record<string, string>).error ||
						`Failed to save webhook (${res.status})`,
				);
				setSaving(false);
				return;
			}

			setShowForm(false);
			resetForm();
			fetchWebhooks();
		} catch {
			alert("Network error saving webhook");
		}
		setSaving(false);
	}, [
		appId,
		formUrl,
		formDescription,
		formEvents,
		formSecret,
		formHeaders,
		formTimeout,
		editingId,
		fetchWebhooks,
	]);

	const handleToggle = useCallback(
		async (wh: WebhookItem) => {
			setWebhooks((prev) =>
				prev.map((w) =>
					w.dbId === wh.dbId ? { ...w, enabled: !w.enabled } : w,
				),
			);
			try {
				const res = await fetch(`/api/apps/${appId}/webhooks`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						webhookDbId: wh.dbId,
						enabled: !wh.enabled,
					}),
				});
				if (!res.ok) throw new Error("Toggle failed");
			} catch {
				setWebhooks((prev) =>
					prev.map((w) =>
						w.dbId === wh.dbId ? { ...w, enabled: wh.enabled } : w,
					),
				);
			}
		},
		[appId],
	);

	const handleDelete = useCallback(
		async (dbId: number) => {
			if (!window.confirm("Delete this webhook? This cannot be undone."))
				return;
			try {
				const res = await fetch(`/api/apps/${appId}/webhooks`, {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ webhookDbId: dbId }),
				});
				if (!res.ok) {
					const err = await res.json().catch(() => ({}));
					alert(
						(err as Record<string, string>).error ||
							`Failed to delete webhook (${res.status})`,
					);
				}
				fetchWebhooks();
			} catch {
				alert("Network error deleting webhook");
			}
		},
		[appId, fetchWebhooks],
	);

	const handleTest = useCallback(
		async (dbId: number) => {
			setTestingId(dbId);
			setTestResult(null);
			try {
				const res = await fetch(`/api/apps/${appId}/webhooks/test`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ webhookDbId: dbId }),
				});
				const data = await res.json();
				setTestResult({
					success: data.success,
					status: data.status,
					durationMs: data.durationMs,
				});
				// Refresh webhook list to show updated lastDeliveryAt/lastDeliveryOk
				fetchWebhooks();
			} catch {
				setTestResult({ success: false });
			}
			setTimeout(() => {
				setTestingId(null);
				setTestResult(null);
			}, 4000);
		},
		[appId, fetchWebhooks],
	);

	const toggleEvent = (event: string) => {
		setFormEvents((prev) =>
			prev.includes(event)
				? prev.filter((e) => e !== event)
				: [...prev, event],
		);
	};

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
						<h1 className="text-2xl font-bold text-white/90">Webhooks</h1>
						<p className="text-sm text-white/40 mt-1">
							Send HTTP callbacks when events happen in your app
						</p>
					</div>
					{!showForm && (
						<button
							type="button"
							onClick={openCreateForm}
							className="px-3 py-2 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white hover:from-violet-500 hover:to-cyan-500 text-sm font-medium transition-colors flex items-center gap-2"
						>
							<Plus className="h-3.5 w-3.5" />
							New Webhook
						</button>
					)}
				</div>

				{/* Create/Edit Form */}
				{showForm && (
					<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-4">
						<h3 className="text-sm font-medium text-white/90">
							{editingId ? "Edit Webhook" : "New Webhook"}
						</h3>

						{/* URL */}
						<div>
							<label className="block text-xs text-white/40 mb-1">
								Endpoint URL
							</label>
							<input
								type="url"
								value={formUrl}
								onChange={(e) => setFormUrl(e.target.value)}
								placeholder="https://example.com/webhooks/vibexe"
								className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30 font-mono"
							/>
						</div>

						{/* Description */}
						<div>
							<label className="block text-xs text-white/40 mb-1">
								Description (optional)
							</label>
							<input
								type="text"
								value={formDescription}
								onChange={(e) => setFormDescription(e.target.value)}
								placeholder="e.g., Slack notification on new orders"
								className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
							/>
						</div>

						{/* Events */}
						<div>
							<label className="block text-xs text-white/40 mb-2">
								Events ({formEvents.length} selected)
							</label>
							<div className="space-y-3">
								{entityEvents.length > 0 && (
									<div>
										<div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
											Data Events
										</div>
										<div className="flex flex-wrap gap-1.5">
											{entityEvents.map((ev) => (
												<button
													key={ev.value}
													type="button"
													onClick={() => toggleEvent(ev.value)}
													className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
														formEvents.includes(ev.value)
															? "bg-violet-500/30 text-violet-200 border border-violet-500/40"
															: "bg-white/[0.04] text-white/50 border border-white/[0.06] hover:bg-white/[0.08]"
													}`}
												>
													{ev.label}
												</button>
											))}
										</div>
									</div>
								)}
								<div>
									<div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
										Auth Events
									</div>
									<div className="flex flex-wrap gap-1.5">
										{AUTH_EVENTS.map((ev) => (
											<button
												key={ev.value}
												type="button"
												onClick={() => toggleEvent(ev.value)}
												className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
													formEvents.includes(ev.value)
														? "bg-violet-500/30 text-violet-200 border border-violet-500/40"
														: "bg-white/[0.04] text-white/50 border border-white/[0.06] hover:bg-white/[0.08]"
												}`}
											>
												{ev.label}
											</button>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Secret */}
						<div>
							<label className="block text-xs text-white/40 mb-1">
								Signing Secret (optional)
							</label>
							<div className="flex gap-2">
								<input
									type="text"
									value={formSecret}
									onChange={(e) => setFormSecret(e.target.value)}
									placeholder={
										editingId
											? "Leave empty to keep current"
											: "HMAC-SHA256 signing key"
									}
									className="flex-1 px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30 font-mono"
								/>
								<button
									type="button"
									onClick={() => setFormSecret(`whsec_${nanoid(32)}`)}
									className="px-3 py-2 rounded-md border border-white/[0.08] text-xs text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors flex-shrink-0"
									title="Generate random secret"
								>
									Generate
								</button>
							</div>
						</div>

						{/* Custom Headers */}
						<div>
							<label className="block text-xs text-white/40 mb-1">
								Custom Headers (optional)
							</label>
							{formHeaders.map((h) => (
								<div key={h.uid} className="flex gap-2 mb-1.5">
									<input
										type="text"
										value={h.key}
										onChange={(e) =>
											setFormHeaders((prev) =>
												prev.map((x) =>
													x.uid === h.uid
														? { ...x, key: e.target.value }
														: x,
												),
											)
										}
										placeholder="Header name"
										className="flex-1 px-3 py-1.5 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/30 font-mono"
									/>
									<input
										type="text"
										value={h.value}
										onChange={(e) =>
											setFormHeaders((prev) =>
												prev.map((x) =>
													x.uid === h.uid
														? { ...x, value: e.target.value }
														: x,
												),
											)
										}
										placeholder="Value"
										className="flex-1 px-3 py-1.5 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/30 font-mono"
									/>
									<button
										type="button"
										onClick={() =>
											setFormHeaders((prev) =>
												prev.filter((x) => x.uid !== h.uid),
											)
										}
										className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
									>
										<X className="h-3 w-3" />
									</button>
								</div>
							))}
							<button
								type="button"
								onClick={() =>
									setFormHeaders((prev) => [
										...prev,
										{ uid: nanoid(8), key: "", value: "" },
									])
								}
								className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
							>
								+ Add header
							</button>
						</div>

						{/* Timeout (edit mode only) */}
						{editingId && (
							<div>
								<label className="block text-xs text-white/40 mb-1">
									Timeout ({Math.round(formTimeout / 1000)}s)
								</label>
								<div className="flex items-center gap-3">
									<input
										type="range"
										min={1}
										max={30}
										value={Math.round(formTimeout / 1000)}
										onChange={(e) =>
											setFormTimeout(Number(e.target.value) * 1000)
										}
										className="flex-1 accent-violet-500"
									/>
									<span className="text-xs text-white/50 w-8 text-right font-mono">
										{Math.round(formTimeout / 1000)}s
									</span>
								</div>
								<p className="text-[10px] text-white/30 mt-1">
									How long to wait for a response (1-30 seconds)
								</p>
							</div>
						)}

						{/* Buttons */}
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleSave}
								disabled={
									saving || !formUrl.trim() || formEvents.length === 0
								}
								className="px-4 py-2 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white hover:from-violet-500 hover:to-cyan-500 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
							>
								{saving && (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								)}
								{editingId ? "Update" : "Create"}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowForm(false);
									resetForm();
								}}
								className="px-3 py-2 rounded-md border border-white/[0.08] text-sm text-white/40 hover:text-white/90 transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>
				)}

				{/* Webhooks List */}
				<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden">
					<div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
						<Webhook className="h-4 w-4 text-white/40" />
						<h3 className="text-sm font-medium text-white/90">
							Webhooks ({webhooks.length})
						</h3>
					</div>

					{webhooks.length === 0 ? (
						<div className="p-8 text-center">
							<Webhook className="h-8 w-8 text-white/20 mx-auto mb-3" />
							<p className="text-sm text-white/40">No webhooks configured</p>
							<p className="text-xs text-white/30 mt-1">
								Create a webhook to get notified when events happen
							</p>
							{!showForm && (
								<button
									type="button"
									onClick={openCreateForm}
									className="mt-4 px-3 py-1.5 rounded-md border border-white/[0.08] text-sm text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors inline-flex items-center gap-1.5"
								>
									<Plus className="h-3.5 w-3.5" />
									New Webhook
								</button>
							)}
						</div>
					) : (
						<div className="divide-y divide-white/[0.06]">
							{webhooks.map((wh) => (
								<div key={wh.dbId}>
									<div className="flex items-center justify-between px-4 py-3">
										<div className="flex items-center gap-3 min-w-0 flex-1">
											{/* Toggle */}
											<button
												type="button"
												onClick={() => handleToggle(wh)}
												className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
													wh.enabled
														? "bg-gradient-to-r from-violet-500 to-cyan-500"
														: "bg-white/10"
												}`}
												title={wh.enabled ? "Disable" : "Enable"}
											>
												<span
													className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
														wh.enabled
															? "translate-x-[18px]"
															: "translate-x-[3px]"
													}`}
												/>
											</button>

											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<span className="text-sm font-mono text-white/80 truncate max-w-[280px]">
														{wh.url}
													</span>
													{wh.secret && (
														<span className="text-[9px] px-1 py-0.5 rounded bg-green-900/40 text-green-400 flex-shrink-0">
															SIGNED
														</span>
													)}
												</div>
												{wh.description && (
													<p className="text-xs text-white/40 truncate mt-0.5">
														{wh.description}
													</p>
												)}
												<div className="flex items-center gap-1.5 mt-1 flex-wrap">
													{wh.events.slice(0, 3).map((ev) => (
														<span
															key={ev}
															className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/40 text-blue-300"
														>
															{ev}
														</span>
													))}
													{wh.events.length > 3 && (
														<span className="text-[10px] text-white/30">
															+{wh.events.length - 3} more
														</span>
													)}
												</div>
											</div>
										</div>

										<div className="flex items-center gap-2 flex-shrink-0 ml-3">
											{/* Delivery status */}
											<div className="flex items-center gap-1.5 text-right">
												<StatusDot ok={wh.lastDeliveryOk} />
												<div>
													<div className="text-[10px] text-white/40">
														{wh.lastDeliveryAt
															? timeAgo(wh.lastDeliveryAt)
															: "Never"}
													</div>
													{(wh.deliverySuccessCount > 0 ||
														wh.deliveryFailureCount > 0) && (
														<div className="text-[9px] text-white/30">
															<span className="text-emerald-400">
																{wh.deliverySuccessCount}
															</span>
															{" / "}
															<span className="text-red-400">
																{wh.deliveryFailureCount}
															</span>
														</div>
													)}
												</div>
											</div>

											{/* Actions */}
											<button
												type="button"
												onClick={() => handleTest(wh.dbId)}
												disabled={testingId === wh.dbId}
												className="p-1.5 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/90 transition-colors"
												title="Send test ping"
											>
												{testingId === wh.dbId ? (
													testResult ? (
														testResult.success ? (
															<Check className="h-3.5 w-3.5 text-emerald-400" />
														) : (
															<AlertCircle className="h-3.5 w-3.5 text-red-400" />
														)
													) : (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													)
												) : (
													<Send className="h-3.5 w-3.5" />
												)}
											</button>

											<button
												type="button"
												onClick={() => {
													if (expandedLogs === wh.dbId) {
														setExpandedLogs(null);
													} else {
														setExpandedLogs(wh.dbId);
														setLogsPage(1);
														fetchLogs(wh.dbId, 1);
													}
												}}
												className="p-1.5 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/90 transition-colors"
												title="View delivery logs"
											>
												{expandedLogs === wh.dbId ? (
													<ChevronDown className="h-3.5 w-3.5" />
												) : (
													<ChevronRight className="h-3.5 w-3.5" />
												)}
											</button>

											<button
												type="button"
												onClick={() => openEditForm(wh)}
												className="p-1.5 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/90 transition-colors"
												title="Edit webhook"
											>
												<ExternalLink className="h-3.5 w-3.5" />
											</button>

											<button
												type="button"
												onClick={() => handleDelete(wh.dbId)}
												className="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-500 transition-colors"
												title="Delete webhook"
											>
												<Trash2 className="h-3.5 w-3.5" />
											</button>
										</div>
									</div>

									{/* Expanded Logs */}
									{expandedLogs === wh.dbId && (
										<div className="border-t border-white/[0.04] bg-black/20 px-4 py-3">
											<div className="flex items-center justify-between mb-2">
												<span className="text-[11px] text-white/40 font-medium">
													Recent Deliveries
												</span>
												<button
													type="button"
													onClick={() => fetchLogs(wh.dbId, logsPage)}
													className="text-[10px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
												>
													<RefreshCw className="h-2.5 w-2.5" />
													Refresh
												</button>
											</div>
											{logsLoading ? (
												<div className="py-4 flex justify-center">
													<Loader2 className="h-4 w-4 animate-spin text-white/30" />
												</div>
											) : logs.length === 0 ? (
												<p className="text-[11px] text-white/30 py-2">
													No deliveries yet
												</p>
											) : (
												<div className="space-y-1">
													{logs.map((log) => (
														<div
															key={log.dbId}
															className="flex items-center gap-3 text-[11px] py-1"
														>
															<StatusDot ok={log.success} />
															<span className="text-white/50 font-mono w-[120px] truncate">
																{log.eventType}
															</span>
															<span
																className={`w-8 text-center font-mono ${
																	log.success
																		? "text-emerald-400"
																		: "text-red-400"
																}`}
															>
																{log.responseStatus ?? "ERR"}
															</span>
															<span className="text-white/30 w-12">
																{log.durationMs
																	? `${log.durationMs}ms`
																	: "-"}
															</span>
															<span className="text-white/20 w-6 text-center">
																#{log.attempt}
															</span>
															<span className="text-white/30 flex-1 text-right">
																{timeAgo(log.createdAt)}
															</span>
															{log.errorMessage && (
																<span
																	className="text-red-400/60 truncate max-w-[120px]"
																	title={log.errorMessage}
																>
																	{log.errorMessage}
																</span>
															)}
														</div>
													))}
												</div>
											)}

											{/* Pagination */}
											{logsTotalPages > 1 && (
												<div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
													<button
														type="button"
														disabled={logsPage <= 1}
														onClick={() =>
															fetchLogs(wh.dbId, logsPage - 1)
														}
														className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
													>
														<ChevronLeft className="h-3 w-3" />
														Previous
													</button>
													<span className="text-[10px] text-white/30">
														Page {logsPage} of {logsTotalPages}
													</span>
													<button
														type="button"
														disabled={logsPage >= logsTotalPages}
														onClick={() =>
															fetchLogs(wh.dbId, logsPage + 1)
														}
														className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
													>
														Next
														<ChevronRight className="h-3 w-3" />
													</button>
												</div>
											)}
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>

				{/* Info */}
				<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
					<div className="flex items-start gap-3">
						<Webhook className="h-5 w-5 text-white/40 flex-shrink-0 mt-0.5" />
						<div>
							<h3 className="text-sm font-medium text-white/90">
								About Webhooks
							</h3>
							<ul className="text-xs text-white/40 mt-2 space-y-1 list-disc list-inside">
								<li>
									Webhooks send HTTP POST requests when events happen in your
									app
								</li>
								<li>
									Payloads are signed with HMAC-SHA256 if a secret is configured
								</li>
								<li>Failed deliveries retry up to 3 times with exponential backoff</li>
								<li>
									Headers include X-Vibexe-Event, X-Vibexe-Signature, and
									X-Vibexe-Delivery
								</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
