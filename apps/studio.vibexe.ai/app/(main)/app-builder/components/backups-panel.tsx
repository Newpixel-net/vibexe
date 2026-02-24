"use client";

/**
 * BackupsPanel Component
 *
 * Lists database backups with filtering, manual backup creation,
 * and one-click restore with confirmation.
 */

import { useCallback, useEffect, useState } from "react";
import {
	Archive,
	Download,
	Loader2,
	Plus,
	RefreshCw,
	RotateCcw,
	Trash2,
} from "lucide-react";

interface Backup {
	id: number;
	environment: string;
	databaseName: string;
	backupType: string;
	sizeBytes: number;
	status: string;
	error: string | null;
	startedAt: string | null;
	completedAt: string | null;
	expiresAt: string | null;
	createdAt: string;
}

interface BackupsPanelProps {
	appId: string;
}

const ENV_TABS = ["all", "development", "staging", "production"] as const;

export function BackupsPanel({ appId }: BackupsPanelProps) {
	const [backups, setBackups] = useState<Backup[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<(typeof ENV_TABS)[number]>("all");
	const [creating, setCreating] = useState(false);
	const [restoring, setRestoring] = useState<number | null>(null);
	const [showRestoreModal, setShowRestoreModal] = useState<Backup | null>(null);

	const fetchBackups = useCallback(async () => {
		try {
			const envParam = activeTab !== "all" ? `&environment=${activeTab}` : "";
			const res = await fetch(
				`/api/apps/${appId}/backups?limit=50${envParam}`,
			);
			if (res.ok) {
				const data = await res.json();
				setBackups(data.backups);
			}
		} catch {}
		setLoading(false);
	}, [appId, activeTab]);

	useEffect(() => {
		setLoading(true);
		fetchBackups();
	}, [fetchBackups]);

	const createBackup = async () => {
		setCreating(true);
		try {
			const res = await fetch(`/api/apps/${appId}/backups`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					environment: activeTab !== "all" ? activeTab : "development",
				}),
			});
			if (res.ok) {
				await fetchBackups();
			}
		} catch {}
		setCreating(false);
	};

	const deleteBackup = async (id: number) => {
		if (!confirm("Delete this backup permanently?")) return;
		try {
			await fetch(`/api/apps/${appId}/backups/${id}`, { method: "DELETE" });
			setBackups((prev) => prev.filter((b) => b.id !== id));
		} catch {}
	};

	const restoreBackup = async (backup: Backup) => {
		setRestoring(backup.id);
		try {
			const res = await fetch(
				`/api/apps/${appId}/backups/${backup.id}/restore`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ confirm: true }),
				},
			);
			if (res.ok) {
				setShowRestoreModal(null);
				await fetchBackups();
			} else {
				const data = await res.json().catch(() => ({}));
				alert(data.error || "Restore failed");
			}
		} catch {
			alert("Restore failed");
		}
		setRestoring(null);
	};

	const formatSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	const typeColor = (type: string) => {
		switch (type) {
			case "scheduled":
				return "bg-blue-500/20 text-blue-400";
			case "manual":
				return "bg-violet-500/20 text-violet-400";
			case "pre-deploy":
				return "bg-amber-500/20 text-amber-400";
			case "pre-promote":
				return "bg-emerald-500/20 text-emerald-400";
			default:
				return "bg-white/10 text-white/40";
		}
	};

	const statusColor = (status: string) => {
		switch (status) {
			case "completed":
				return "text-emerald-400";
			case "in_progress":
				return "text-yellow-400";
			case "failed":
				return "text-red-400";
			default:
				return "text-white/40";
		}
	};

	return (
		<div className="p-6 space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-white/90">Backups</h2>
					<p className="text-sm text-white/40 mt-1">
						Automated and manual database snapshots with one-click restore
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={fetchBackups}
						className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition"
					>
						<RefreshCw className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={createBackup}
						disabled={creating}
						className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 transition text-sm disabled:opacity-50"
					>
						{creating ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Plus className="h-4 w-4" />
						)}
						Create Backup
					</button>
				</div>
			</div>

			{/* Environment Tabs */}
			<div className="flex gap-1 p-1 rounded-lg bg-white/[0.04] w-fit">
				{ENV_TABS.map((tab) => (
					<button
						key={tab}
						type="button"
						onClick={() => setActiveTab(tab)}
						className={`px-3 py-1.5 rounded-md text-xs transition capitalize ${
							activeTab === tab
								? "bg-white/[0.1] text-white/90"
								: "text-white/40 hover:text-white/60"
						}`}
					>
						{tab}
					</button>
				))}
			</div>

			{/* Backup Table */}
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-white/30" />
				</div>
			) : backups.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-12 text-white/30">
					<Archive className="h-10 w-10 mb-3" />
					<p className="text-sm">No backups yet</p>
					<p className="text-xs text-white/20 mt-1">
						Automated backups run daily. Create a manual backup anytime.
					</p>
				</div>
			) : (
				<div className="rounded-xl border border-white/[0.06] overflow-hidden">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-white/[0.06] bg-white/[0.02]">
								<th className="text-left px-4 py-2.5 text-xs font-medium text-white/40 uppercase">
									Type
								</th>
								<th className="text-left px-4 py-2.5 text-xs font-medium text-white/40 uppercase">
									Environment
								</th>
								<th className="text-left px-4 py-2.5 text-xs font-medium text-white/40 uppercase">
									Date
								</th>
								<th className="text-left px-4 py-2.5 text-xs font-medium text-white/40 uppercase">
									Size
								</th>
								<th className="text-left px-4 py-2.5 text-xs font-medium text-white/40 uppercase">
									Status
								</th>
								<th className="text-right px-4 py-2.5 text-xs font-medium text-white/40 uppercase">
									Actions
								</th>
							</tr>
						</thead>
						<tbody>
							{backups.map((backup) => (
								<tr
									key={backup.id}
									className="border-b border-white/[0.04] hover:bg-white/[0.02]"
								>
									<td className="px-4 py-2.5">
										<span
											className={`text-xs px-2 py-0.5 rounded-full ${typeColor(backup.backupType)}`}
										>
											{backup.backupType}
										</span>
									</td>
									<td className="px-4 py-2.5 text-white/60 capitalize">
										{backup.environment}
									</td>
									<td className="px-4 py-2.5 text-white/60">
										{new Date(backup.createdAt).toLocaleString()}
									</td>
									<td className="px-4 py-2.5 text-white/60 font-mono">
										{backup.sizeBytes
											? formatSize(backup.sizeBytes)
											: "—"}
									</td>
									<td className="px-4 py-2.5">
										<span className={statusColor(backup.status)}>
											{backup.status === "in_progress" && (
												<Loader2 className="h-3 w-3 inline animate-spin mr-1" />
											)}
											{backup.status}
										</span>
									</td>
									<td className="px-4 py-2.5">
										<div className="flex items-center justify-end gap-1">
											{backup.status === "completed" && (
												<button
													type="button"
													onClick={() =>
														setShowRestoreModal(backup)
													}
													className="p-1.5 rounded hover:bg-violet-500/20 text-white/30 hover:text-violet-400 transition"
													title="Restore"
												>
													<RotateCcw className="h-3.5 w-3.5" />
												</button>
											)}
											<button
												type="button"
												onClick={() => deleteBackup(backup.id)}
												className="p-1.5 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition"
												title="Delete"
											>
												<Trash2 className="h-3.5 w-3.5" />
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Restore Confirmation Modal */}
			{showRestoreModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="bg-[#1a1a2e] border border-white/[0.08] rounded-xl p-6 w-[420px]">
						<h3 className="text-base font-semibold text-white/90 mb-3">
							Restore Backup
						</h3>
						<p className="text-sm text-white/50 mb-4">
							This will restore the <strong className="text-white/70">{showRestoreModal.environment}</strong> database
							to the state from{" "}
							<strong className="text-white/70">
								{new Date(showRestoreModal.createdAt).toLocaleString()}
							</strong>
							.
						</p>
						<div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
							<p className="text-xs text-amber-400">
								A backup of the current state will be created automatically
								before restoring.
							</p>
						</div>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setShowRestoreModal(null)}
								className="px-4 py-2 rounded-lg border border-white/[0.08] text-white/60 hover:bg-white/[0.06] transition text-sm"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => restoreBackup(showRestoreModal)}
								disabled={restoring === showRestoreModal.id}
								className="px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 transition text-sm disabled:opacity-50 flex items-center gap-2"
							>
								{restoring === showRestoreModal.id ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<RotateCcw className="h-4 w-4" />
								)}
								Restore
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
