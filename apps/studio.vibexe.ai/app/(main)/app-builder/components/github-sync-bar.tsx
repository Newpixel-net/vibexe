"use client";

/**
 * GitHub Sync Bar — Shows GitHub connection status with Push/Pull controls.
 *
 * Positioned above the chat input in the chat column.
 * States: Not Connected → Repo Picker | Connected → Push/Pull buttons
 */

import {
	ArrowDownToLine,
	ArrowUpFromLine,
	GitBranch,
	Github,
	Loader2,
	Settings,
	Unplug,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { GitHubRepoPicker } from "./github-repo-picker";
import { GitHubDiffModal } from "./github-diff-modal";

interface GitHubSyncBarProps {
	appId: string;
	onFilesChange?: () => void;
}

interface SyncStatus {
	connected: boolean;
	repoFullName?: string;
	branch?: string;
	lastPushSha?: string | null;
	lastPullSha?: string | null;
	latestSha?: string | null;
	hasRemoteChanges?: boolean;
	lastSynced?: string | null;
	error?: string;
}

export function GitHubSyncBar({ appId, onFilesChange }: GitHubSyncBarProps) {
	const [status, setStatus] = useState<SyncStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [showPicker, setShowPicker] = useState(false);
	const [showDiff, setShowDiff] = useState(false);
	const [pushing, setPushing] = useState(false);
	const [pulling, setPulling] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [pushResult, setPushResult] = useState<string | null>(null);
	const [pullResult, setPullResult] = useState<string | null>(null);

	const fetchStatus = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/github/status`);
			if (res.ok) {
				const data = await res.json();
				setStatus(data);
			}
		} catch {
			// Silently fail — GitHub might not be configured
		} finally {
			setLoading(false);
		}
	}, [appId]);

	useEffect(() => {
		fetchStatus();
	}, [fetchStatus]);

	const handlePush = async () => {
		setPushing(true);
		setPushResult(null);
		try {
			const res = await fetch(`/api/apps/${appId}/github/push`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: "Sync from Vibexe App Builder" }),
			});
			const data = await res.json();
			if (res.ok) {
				setPushResult(`Pushed ${data.filesCount} files`);
				fetchStatus();
			} else {
				setPushResult(`Error: ${data.error}`);
			}
		} catch {
			setPushResult("Push failed");
		} finally {
			setPushing(false);
			setTimeout(() => setPushResult(null), 4000);
		}
	};

	const handlePull = async () => {
		setPulling(true);
		setPullResult(null);
		try {
			const res = await fetch(`/api/apps/${appId}/github/pull`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ deleteOrphans: false }),
			});
			const data = await res.json();
			if (res.ok) {
				const parts = [];
				if (data.filesCreated > 0) parts.push(`+${data.filesCreated} new`);
				if (data.filesUpdated > 0) parts.push(`~${data.filesUpdated} updated`);
				if (data.filesDeleted > 0) parts.push(`-${data.filesDeleted} deleted`);
				setPullResult(parts.length > 0 ? parts.join(", ") : "Already up to date");
				fetchStatus();
				onFilesChange?.();
			} else {
				setPullResult(`Error: ${data.error}`);
			}
		} catch {
			setPullResult("Pull failed");
		} finally {
			setPulling(false);
			setTimeout(() => setPullResult(null), 4000);
		}
	};

	const handleDisconnect = async () => {
		try {
			await fetch(`/api/apps/${appId}/github/config`, { method: "DELETE" });
			setStatus({ connected: false });
			setShowSettings(false);
		} catch {
			// Ignore
		}
	};

	if (loading) return null;

	// Not connected state
	if (!status?.connected) {
		return (
			<>
				<div className="px-4 py-2.5 border-t border-white/[0.06]">
					<button
						type="button"
						onClick={() => setShowPicker(true)}
						className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white/50 hover:text-white/70 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg border border-white/[0.08] hover:border-white/[0.12] transition-all"
					>
						<Github size={15} />
						Connect GitHub Repository
					</button>
				</div>

				{showPicker && (
					<GitHubRepoPicker
						appId={appId}
						onClose={() => setShowPicker(false)}
						onConnected={() => {
							setShowPicker(false);
							fetchStatus();
						}}
					/>
				)}
			</>
		);
	}

	// Connected state
	return (
		<>
			<div className="px-4 py-2 border-t border-white/[0.06] space-y-1.5">
				{/* Repo + Branch info */}
				<div className="flex items-center gap-2">
					<Github size={13} className="text-white/30 shrink-0" />
					<span className="text-[12px] text-white/50 truncate flex-1">
						{status.repoFullName}
					</span>
					<div className="flex items-center gap-1 text-[11px] text-white/35 bg-white/[0.04] rounded px-1.5 py-0.5">
						<GitBranch size={10} />
						{status.branch}
					</div>
					<button
						type="button"
						onClick={() => setShowSettings(!showSettings)}
						className="p-1 rounded hover:bg-white/10 text-white/25 hover:text-white/50 transition-colors"
					>
						<Settings size={12} />
					</button>
				</div>

				{/* Push / Pull buttons */}
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handlePush}
						disabled={pushing || pulling}
						className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[12px] text-white/60 hover:text-white/80 bg-white/[0.03] hover:bg-white/[0.06] rounded-md border border-white/[0.08] hover:border-white/[0.12] transition-all disabled:opacity-40"
					>
						{pushing ? (
							<Loader2 size={12} className="animate-spin" />
						) : (
							<ArrowUpFromLine size={12} />
						)}
						Push
					</button>

					<button
						type="button"
						onClick={
							status.hasRemoteChanges ? () => setShowDiff(true) : handlePull
						}
						disabled={pushing || pulling}
						className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[12px] rounded-md border transition-all disabled:opacity-40 ${
							status.hasRemoteChanges
								? "text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/30 hover:border-violet-500/40"
								: "text-white/60 hover:text-white/80 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] hover:border-white/[0.12]"
						}`}
					>
						{pulling ? (
							<Loader2 size={12} className="animate-spin" />
						) : (
							<ArrowDownToLine size={12} />
						)}
						Pull
						{status.hasRemoteChanges && (
							<span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
						)}
					</button>
				</div>

				{/* Status messages */}
				{pushResult && (
					<p className="text-[11px] text-emerald-400/70 text-center">
						{pushResult}
					</p>
				)}
				{pullResult && (
					<p className="text-[11px] text-emerald-400/70 text-center">
						{pullResult}
					</p>
				)}

				{/* Settings dropdown */}
				{showSettings && (
					<div className="mt-1 p-2 bg-white/[0.04] rounded-lg border border-white/[0.08]">
						<button
							type="button"
							onClick={() => setShowPicker(true)}
							className="w-full text-left px-2.5 py-1.5 text-[12px] text-white/50 hover:text-white/70 hover:bg-white/[0.04] rounded transition-colors"
						>
							Change repository...
						</button>
						<button
							type="button"
							onClick={handleDisconnect}
							className="w-full text-left px-2.5 py-1.5 text-[12px] text-red-400/60 hover:text-red-400/80 hover:bg-red-500/10 rounded transition-colors flex items-center gap-2"
						>
							<Unplug size={11} />
							Disconnect
						</button>
					</div>
				)}
			</div>

			{showPicker && (
				<GitHubRepoPicker
					appId={appId}
					onClose={() => setShowPicker(false)}
					onConnected={() => {
						setShowPicker(false);
						setShowSettings(false);
						fetchStatus();
					}}
				/>
			)}

			{showDiff && (
				<GitHubDiffModal
					appId={appId}
					onClose={() => setShowDiff(false)}
					onPull={() => {
						setShowDiff(false);
						handlePull();
					}}
				/>
			)}
		</>
	);
}
