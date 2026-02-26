"use client";

import { ArrowRight, Github, Globe, Link2, Loader2, Lock, X } from "lucide-react";
import { useCallback, useState } from "react";

interface GitHubImportModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function GitHubImportModal({ isOpen, onClose }: GitHubImportModalProps) {
	const [tab, setTab] = useState<"private" | "public">("public");
	const [repoUrl, setRepoUrl] = useState("");
	const [branch, setBranch] = useState("main");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleImport = useCallback(async () => {
		if (!repoUrl.trim()) return;
		setIsLoading(true);
		setError(null);

		try {
			// Extract owner/repo from URL
			const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
			if (!match) {
				setError("Invalid GitHub URL. Use format: https://github.com/owner/repo");
				setIsLoading(false);
				return;
			}

			const res = await fetch("/api/app-builder/apps", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					githubImport: {
						owner: match[1],
						repo: match[2].replace(/\.git$/, ""),
						branch,
					},
				}),
			});

			if (res.ok) {
				const data = await res.json();
				if (data.redirectPath) {
					window.location.href = data.redirectPath;
					return;
				}
			}
			setError("Failed to import repository. Please try again.");
		} catch {
			setError("Network error. Please check your connection.");
		}
		setIsLoading(false);
	}, [repoUrl, branch]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="w-full max-w-lg mx-4 rounded-2xl border border-white/[0.1] bg-[#141422]/95 backdrop-blur-xl shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
					<div className="flex items-center gap-2">
						<Github className="h-4 w-4 text-white/50" />
						<h3 className="text-[15px] font-semibold text-white/80">Import from GitHub</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="h-7 w-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.08] transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Tabs */}
				<div className="flex border-b border-white/[0.06]">
					<button
						type="button"
						onClick={() => setTab("public")}
						className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors border-b-2 ${
							tab === "public"
								? "text-white/80 border-blue-400"
								: "text-white/30 border-transparent hover:text-white/50"
						}`}
					>
						<Globe className="h-3.5 w-3.5" />
						Public
					</button>
					<button
						type="button"
						onClick={() => setTab("private")}
						className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors border-b-2 ${
							tab === "private"
								? "text-white/80 border-blue-400"
								: "text-white/30 border-transparent hover:text-white/50"
						}`}
					>
						<Lock className="h-3.5 w-3.5" />
						Private
					</button>
				</div>

				{/* Content */}
				<div className="p-5">
					{tab === "public" ? (
						<div className="space-y-4">
							{/* URL input */}
							<div>
								<label className="text-[11px] text-white/30 font-medium uppercase tracking-wider block mb-2">
									Repository URL
								</label>
								<div className="relative">
									<Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
									<input
										type="text"
										value={repoUrl}
										onChange={(e) => { setRepoUrl(e.target.value); setError(null); }}
										placeholder="https://github.com/owner/repo"
										className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2.5 text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
									/>
								</div>
							</div>

							{/* Branch input */}
							<div>
								<label className="text-[11px] text-white/30 font-medium uppercase tracking-wider block mb-2">
									Branch
								</label>
								<input
									type="text"
									value={branch}
									onChange={(e) => setBranch(e.target.value)}
									placeholder="main"
									className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
								/>
							</div>

							{/* Error */}
							{error && (
								<p className="text-[12px] text-red-400">{error}</p>
							)}

							{/* Import button */}
							<button
								type="button"
								onClick={handleImport}
								disabled={!repoUrl.trim() || isLoading}
								className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium bg-white/[0.08] text-white/70 hover:bg-white/[0.12] hover:text-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
							>
								{isLoading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<>
										Import Repository
										<ArrowRight className="h-3.5 w-3.5" />
									</>
								)}
							</button>
						</div>
					) : (
						<div className="text-center py-8">
							<Github className="h-10 w-10 text-white/10 mx-auto mb-3" />
							<p className="text-[14px] text-white/50 mb-2">Connect to GitHub</p>
							<p className="text-[12px] text-white/25 mb-5 max-w-xs mx-auto">
								Connect your GitHub account to import private repositories
							</p>
							<a
								href="/api/auth/github"
								className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/[0.08] text-[13px] font-medium text-white/70 hover:bg-white/[0.12] hover:text-white/90 transition-colors"
							>
								<Github className="h-4 w-4" />
								Connect to Github
							</a>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
