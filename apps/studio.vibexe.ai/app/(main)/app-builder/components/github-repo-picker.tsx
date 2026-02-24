"use client";

/**
 * GitHub Repo Picker Modal
 *
 * Shows user's GitHub installations and repos.
 * On selection, saves config via PUT /api/apps/{appId}/github/config.
 */

import { Loader2, Search, GitBranch, Lock, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Installation {
	id: number;
	account: { login: string; avatarUrl: string | null; type: string };
	repos: Array<{
		owner: string;
		name: string;
		fullName: string;
		defaultBranch: string;
		private: boolean;
	}>;
}

interface Branch {
	name: string;
	sha: string;
	protected: boolean;
}

interface GitHubRepoPickerProps {
	appId: string;
	onClose: () => void;
	onConnected: () => void;
}

export function GitHubRepoPicker({
	appId,
	onClose,
	onConnected,
}: GitHubRepoPickerProps) {
	const [installations, setInstallations] = useState<Installation[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");

	// Step 2: branch selection
	const [selectedRepo, setSelectedRepo] = useState<{
		owner: string;
		name: string;
		defaultBranch: string;
	} | null>(null);
	const [branches, setBranches] = useState<Branch[]>([]);
	const [selectedBranch, setSelectedBranch] = useState("");
	const [loadingBranches, setLoadingBranches] = useState(false);
	const [saving, setSaving] = useState(false);
	const [installationId, setInstallationId] = useState<number | null>(null);

	// Load repos
	useEffect(() => {
		async function load() {
			try {
				setLoading(true);
				setError(null);
				const res = await fetch(`/api/apps/${appId}/github/repos`);
				if (!res.ok) {
					const data = await res.json();
					throw new Error(data.error || "Failed to load repos");
				}
				const data = await res.json();
				setInstallations(data.installations || []);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load repos");
			} finally {
				setLoading(false);
			}
		}
		load();
	}, [appId]);

	// Load branches when repo selected
	const handleRepoSelect = useCallback(
		async (
			instId: number,
			repo: { owner: string; name: string; defaultBranch: string },
		) => {
			setSelectedRepo(repo);
			setInstallationId(instId);
			setSelectedBranch(repo.defaultBranch);
			setLoadingBranches(true);
			try {
				const res = await fetch(
					`/api/apps/${appId}/github/branches?owner=${repo.owner}&repo=${repo.name}`,
				);
				if (res.ok) {
					const data = await res.json();
					setBranches(data.branches || []);
				}
			} catch {
				// Fallback — use default branch only
				setBranches([
					{
						name: repo.defaultBranch,
						sha: "",
						protected: false,
					},
				]);
			} finally {
				setLoadingBranches(false);
			}
		},
		[appId],
	);

	// Save connection
	const handleConnect = async () => {
		if (!selectedRepo || !selectedBranch) return;
		setSaving(true);
		try {
			const res = await fetch(`/api/apps/${appId}/github/config`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					repoOwner: selectedRepo.owner,
					repoName: selectedRepo.name,
					branch: selectedBranch,
					installationId,
				}),
			});
			if (!res.ok) throw new Error("Failed to save");
			onConnected();
		} catch {
			setError("Failed to connect repository");
		} finally {
			setSaving(false);
		}
	};

	// Filter repos by search
	const filteredInstallations = installations
		.map((inst) => ({
			...inst,
			repos: inst.repos.filter(
				(r) =>
					!search ||
					r.fullName.toLowerCase().includes(search.toLowerCase()),
			),
		}))
		.filter((inst) => inst.repos.length > 0);

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
			<div className="w-[520px] max-h-[600px] bg-[#1a1a2e] border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
					<h2 className="text-base font-semibold text-white">
						{selectedRepo ? "Select Branch" : "Connect GitHub Repository"}
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
					>
						<X size={16} />
					</button>
				</div>

				{/* Error */}
				{error && (
					<div className="px-5 py-2 bg-red-500/10 text-red-400 text-sm border-b border-white/[0.06]">
						{error}
					</div>
				)}

				{/* Content */}
				<div className="flex-1 overflow-y-auto min-h-0">
					{loading ? (
						<div className="flex items-center justify-center py-16">
							<Loader2 className="w-6 h-6 animate-spin text-white/40" />
						</div>
					) : selectedRepo ? (
						/* Branch picker */
						<div className="p-5">
							<div className="mb-4">
								<button
									type="button"
									onClick={() => {
										setSelectedRepo(null);
										setBranches([]);
									}}
									className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
								>
									&larr; Back to repos
								</button>
							</div>

							<div className="mb-4 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
								<span className="text-sm text-white/80">
									{selectedRepo.owner}/{selectedRepo.name}
								</span>
							</div>

							{loadingBranches ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="w-5 h-5 animate-spin text-white/40" />
								</div>
							) : (
								<div className="space-y-1">
									{branches.map((branch) => (
										<button
											key={branch.name}
											type="button"
											onClick={() => setSelectedBranch(branch.name)}
											className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 transition-colors ${
												selectedBranch === branch.name
													? "bg-violet-500/20 border border-violet-500/40 text-white"
													: "hover:bg-white/5 text-white/70 border border-transparent"
											}`}
										>
											<GitBranch size={14} className="shrink-0 text-white/40" />
											<span className="text-sm">{branch.name}</span>
											{branch.protected && (
												<Lock size={11} className="text-yellow-500/60" />
											)}
										</button>
									))}
								</div>
							)}
						</div>
					) : (
						/* Repo list */
						<div>
							{/* Search */}
							<div className="p-3 border-b border-white/[0.06]">
								<div className="relative">
									<Search
										size={14}
										className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
									/>
									<input
										type="text"
										placeholder="Search repositories..."
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
									/>
								</div>
							</div>

							{filteredInstallations.length === 0 ? (
								<div className="py-12 text-center">
									<p className="text-white/40 text-sm mb-3">
										No repositories found
									</p>
									<p className="text-white/25 text-xs">
										Make sure you've installed the Vibexe GitHub App on your repositories.
									</p>
								</div>
							) : (
								filteredInstallations.map((inst) => (
									<div key={inst.id}>
										{/* Org/User header */}
										<div className="px-4 py-2 flex items-center gap-2 bg-white/[0.02] border-b border-white/[0.04]">
											{inst.account.avatarUrl && (
												<img
													src={inst.account.avatarUrl}
													alt=""
													className="w-5 h-5 rounded-full"
												/>
											)}
											<span className="text-xs font-medium text-white/50 uppercase tracking-wider">
												{inst.account.login}
											</span>
										</div>
										{/* Repos */}
										{inst.repos.map((repo) => (
											<button
												key={repo.fullName}
												type="button"
												onClick={() => handleRepoSelect(inst.id, repo)}
												className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/[0.04]"
											>
												<div className="flex-1 min-w-0">
													<span className="text-sm text-white/80 block truncate">
														{repo.name}
													</span>
													<span className="text-[11px] text-white/30 block mt-0.5">
														{repo.defaultBranch}
													</span>
												</div>
												{repo.private && (
													<Lock size={12} className="text-white/20 shrink-0" />
												)}
											</button>
										))}
									</div>
								))
							)}
						</div>
					)}
				</div>

				{/* Footer */}
				{selectedRepo && (
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
							onClick={handleConnect}
							disabled={saving || !selectedBranch}
							className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
						>
							{saving && <Loader2 size={14} className="animate-spin" />}
							Connect
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
