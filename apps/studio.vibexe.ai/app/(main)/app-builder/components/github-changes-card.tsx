"use client";

/**
 * GitHub Changes Card — Rich hover tooltip showing commit details.
 *
 * Appears above the Pull button when remote changes exist.
 */

import {
	ExternalLink,
	FilePlus2,
	FileEdit,
	FileX2,
	GitCommit,
} from "lucide-react";

interface CommitInfo {
	sha: string;
	message: string;
	authorName: string;
	authorAvatar: string;
	date: string;
}

interface ChangedFiles {
	added: number;
	modified: number;
	removed: number;
	total: number;
}

interface GitHubChangesCardProps {
	repoFullName: string;
	branch: string;
	commitCount: number;
	recentCommits: CommitInfo[];
	changedFiles?: ChangedFiles;
	onMouseEnter: () => void;
	onMouseLeave: () => void;
}

function timeAgo(dateStr: string): string {
	if (!dateStr) return "";
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return `${Math.floor(days / 30)}mo ago`;
}

export function GitHubChangesCard({
	repoFullName,
	branch,
	commitCount,
	recentCommits,
	changedFiles,
	onMouseEnter,
	onMouseLeave,
}: GitHubChangesCardProps) {
	const compareUrl = `https://github.com/${repoFullName}/commits/${branch}`;

	return (
		<div
			className="absolute bottom-full left-0 right-0 mb-2 z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div className="bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06]">
					<div className="flex items-center gap-2">
						<span className="relative inline-flex items-center justify-center w-4 h-4 shrink-0">
							<span className="absolute w-2 h-2 rounded-full bg-emerald-400 github-sync-dot" />
							<span className="github-sync-ripple github-sync-ripple-1" />
							<span className="github-sync-ripple github-sync-ripple-2" />
							<span className="github-sync-ripple github-sync-ripple-3" />
						</span>
						<span className="text-[12px] font-medium text-white/80">
							{commitCount} new commit{commitCount !== 1 ? "s" : ""}
						</span>
					</div>
					<span className="text-[11px] text-white/30 bg-white/[0.04] rounded px-1.5 py-0.5">
						{branch}
					</span>
				</div>

				{/* Commit list */}
				{recentCommits.length > 0 && (
					<div className="px-3.5 py-2 space-y-2 max-h-[200px] overflow-y-auto">
						{recentCommits.map((commit) => (
							<div key={commit.sha} className="flex items-start gap-2.5">
								{commit.authorAvatar ? (
									<img
										src={commit.authorAvatar}
										alt=""
										className="w-5 h-5 rounded-full shrink-0 mt-0.5 border border-white/10"
									/>
								) : (
									<div className="w-5 h-5 rounded-full shrink-0 mt-0.5 bg-white/10 flex items-center justify-center">
										<GitCommit size={10} className="text-white/40" />
									</div>
								)}
								<div className="min-w-0 flex-1">
									<p className="text-[12px] text-white/70 truncate leading-tight">
										{commit.message}
									</p>
									<p className="text-[10px] text-white/30 leading-tight mt-0.5">
										{commit.authorName}
										<span className="mx-1 text-white/15">&middot;</span>
										<span className="font-mono">{commit.sha}</span>
										{commit.date && (
											<>
												<span className="mx-1 text-white/15">&middot;</span>
												{timeAgo(commit.date)}
											</>
										)}
									</p>
								</div>
							</div>
						))}
						{commitCount > recentCommits.length && (
							<p className="text-[10px] text-white/25 text-center py-0.5">
								+{commitCount - recentCommits.length} more commit
								{commitCount - recentCommits.length !== 1 ? "s" : ""}
							</p>
						)}
					</div>
				)}

				{/* File change summary */}
				{changedFiles && changedFiles.total > 0 && (
					<div className="flex items-center gap-3 px-3.5 py-2 border-t border-white/[0.06] text-[11px]">
						{changedFiles.added > 0 && (
							<span className="flex items-center gap-1 text-emerald-400/70">
								<FilePlus2 size={11} />+{changedFiles.added}
							</span>
						)}
						{changedFiles.modified > 0 && (
							<span className="flex items-center gap-1 text-amber-400/70">
								<FileEdit size={11} />~{changedFiles.modified}
							</span>
						)}
						{changedFiles.removed > 0 && (
							<span className="flex items-center gap-1 text-red-400/70">
								<FileX2 size={11} />-{changedFiles.removed}
							</span>
						)}
						<span className="text-white/25 ml-auto">
							{changedFiles.total} file{changedFiles.total !== 1 ? "s" : ""}
						</span>
					</div>
				)}

				{/* Footer link */}
				<a
					href={compareUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center justify-center gap-1.5 px-3.5 py-2 border-t border-white/[0.06] text-[11px] text-white/30 hover:text-white/50 transition-colors"
				>
					View on GitHub
					<ExternalLink size={10} />
				</a>
			</div>
		</div>
	);
}
