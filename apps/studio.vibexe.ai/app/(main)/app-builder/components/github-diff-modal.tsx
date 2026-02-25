"use client";

/**
 * GitHub Diff Modal — Shows added/modified/deleted files before pulling.
 */

import { FilePlus2, FileEdit, FileX2, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface DiffData {
	latestSha: string;
	added: string[];
	modified: string[];
	deleted: string[];
	totalChanges: number;
}

interface GitHubDiffModalProps {
	appId: string;
	onClose: () => void;
	onPull: () => void;
}

export function GitHubDiffModal({
	appId,
	onClose,
	onPull,
}: GitHubDiffModalProps) {
	const [diff, setDiff] = useState<DiffData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function loadDiff() {
			try {
				setLoading(true);
				const res = await fetch(`/api/apps/${appId}/github/diff`);
				if (!res.ok) {
					const data = await res.json();
					throw new Error(data.error || "Failed to load diff");
				}
				const data = await res.json();
				setDiff(data);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load diff");
			} finally {
				setLoading(false);
			}
		}
		loadDiff();
	}, [appId]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
		>
			<div className="w-[480px] max-h-[500px] bg-[#1a1a2e] border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
					<h2 className="text-base font-semibold text-white">
						Changes from GitHub
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
					>
						<X size={16} />
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto min-h-0 p-4">
					{loading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="w-6 h-6 animate-spin text-white/40" />
						</div>
					) : error ? (
						<div className="py-8 text-center">
							<p className="text-red-400/70 text-sm">{error}</p>
						</div>
					) : diff ? (
						<div className="space-y-4">
							{/* Summary */}
							<div className="flex items-center gap-3 text-sm text-white/50">
								{diff.added.length > 0 && (
									<span className="flex items-center gap-1 text-emerald-400/70">
										<FilePlus2 size={13} />
										{diff.added.length} added
									</span>
								)}
								{diff.modified.length > 0 && (
									<span className="flex items-center gap-1 text-amber-400/70">
										<FileEdit size={13} />
										{diff.modified.length} modified
									</span>
								)}
								{diff.deleted.length > 0 && (
									<span className="flex items-center gap-1 text-red-400/70">
										<FileX2 size={13} />
										{diff.deleted.length} deleted
									</span>
								)}
								{diff.totalChanges === 0 && (
									<span className="text-white/40">No changes detected</span>
								)}
							</div>

							{/* Added files */}
							{diff.added.length > 0 && (
								<div>
									<h3 className="text-xs font-medium text-emerald-400/60 uppercase tracking-wider mb-2">
										New Files
									</h3>
									<div className="space-y-1">
										{diff.added.map((path) => (
											<div
												key={path}
												className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-emerald-500/5 border border-emerald-500/10"
											>
												<FilePlus2 size={12} className="text-emerald-400/50 shrink-0" />
												<span className="text-[12px] text-emerald-400/70 truncate">
													{path}
												</span>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Modified files */}
							{diff.modified.length > 0 && (
								<div>
									<h3 className="text-xs font-medium text-amber-400/60 uppercase tracking-wider mb-2">
										Modified Files
									</h3>
									<div className="space-y-1">
										{diff.modified.map((path) => (
											<div
												key={path}
												className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-amber-500/5 border border-amber-500/10"
											>
												<FileEdit size={12} className="text-amber-400/50 shrink-0" />
												<span className="text-[12px] text-amber-400/70 truncate">
													{path}
												</span>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Deleted files */}
							{diff.deleted.length > 0 && (
								<div>
									<h3 className="text-xs font-medium text-red-400/60 uppercase tracking-wider mb-2">
										Files Not in GitHub
									</h3>
									<div className="space-y-1">
										{diff.deleted.map((path) => (
											<div
												key={path}
												className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-red-500/5 border border-red-500/10"
											>
												<FileX2 size={12} className="text-red-400/50 shrink-0" />
												<span className="text-[12px] text-red-400/70 truncate">
													{path}
												</span>
											</div>
										))}
									</div>
									<p className="text-[11px] text-white/25 mt-1.5">
										These local files don't exist in the GitHub repo.
										They will be preserved (not deleted) on pull.
									</p>
								</div>
							)}
						</div>
					) : null}
				</div>

				{/* Footer */}
				<div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-end gap-3">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onPull}
						disabled={loading || diff?.totalChanges === 0}
						className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Pull All Changes
					</button>
				</div>
			</div>
		</div>
	);
}
