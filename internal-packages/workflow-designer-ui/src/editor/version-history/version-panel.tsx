"use client";

import {
	HistoryIcon,
	SaveIcon,
	RotateCcwIcon,
	XIcon,
	TagIcon,
	CheckIcon,
	LoaderIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAppDesignerStore } from "../../app-designer";

interface VersionEntry {
	dbId: number;
	versionNumber: number;
	label: string | null;
	createdAt: string;
	createdByName: string | null;
	createdByAvatar: string | null;
}

export function VersionPanel({ onClose }: { onClose: () => void }) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const [versions, setVersions] = useState<VersionEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [restoring, setRestoring] = useState<number | null>(null);
	const [labelInput, setLabelInput] = useState("");
	const [showLabelInput, setShowLabelInput] = useState(false);

	const fetchVersions = useCallback(async () => {
		if (!workspaceId) return;
		try {
			const res = await fetch(`/api/workspaces/${workspaceId}/versions`);
			if (res.ok) {
				const data = await res.json();
				setVersions(data.versions ?? []);
			}
		} catch (err) {
			console.error("Failed to fetch versions:", err);
		} finally {
			setLoading(false);
		}
	}, [workspaceId]);

	useEffect(() => {
		fetchVersions();
	}, [fetchVersions]);

	const handleSaveVersion = async () => {
		if (!workspaceId) return;
		setSaving(true);
		try {
			const res = await fetch(`/api/workspaces/${workspaceId}/versions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ label: labelInput || undefined }),
			});
			if (res.ok) {
				setLabelInput("");
				setShowLabelInput(false);
				await fetchVersions();
			}
		} catch (err) {
			console.error("Failed to save version:", err);
		} finally {
			setSaving(false);
		}
	};

	const handleRestore = async (versionDbId: number) => {
		if (!workspaceId) return;
		if (!window.confirm("Restore this version? Current changes will be overwritten.")) return;

		setRestoring(versionDbId);
		try {
			const res = await fetch(
				`/api/workspaces/${workspaceId}/versions/${versionDbId}`,
				{ method: "POST" },
			);
			if (res.ok) {
				// Reload the page to reflect restored state
				window.location.reload();
			}
		} catch (err) {
			console.error("Failed to restore version:", err);
		} finally {
			setRestoring(null);
		}
	};

	const formatDate = (dateStr: string) => {
		const d = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return "Just now";
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d ago`;
		return d.toLocaleDateString();
	};

	return (
		<div className="flex flex-col h-full bg-[#0d0d1a] border-l border-inverse/10 w-[320px]">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-inverse/10">
				<div className="flex items-center gap-2">
					<HistoryIcon className="size-4 text-inverse/50" />
					<span className="text-sm font-medium text-inverse/80">Versions</span>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="p-1 rounded hover:bg-inverse/10 transition-colors"
				>
					<XIcon className="size-4 text-inverse/40" />
				</button>
			</div>

			{/* Save version */}
			<div className="px-4 py-3 border-b border-inverse/10">
				{showLabelInput ? (
					<div className="flex flex-col gap-2">
						<input
							type="text"
							placeholder="Version label (optional)"
							value={labelInput}
							onChange={(e) => setLabelInput(e.target.value)}
							className="w-full bg-inverse/5 border border-inverse/10 rounded px-3 py-1.5 text-sm text-inverse outline-none placeholder:text-inverse/30 focus:border-primary/50"
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSaveVersion();
								if (e.key === "Escape") setShowLabelInput(false);
							}}
							autoFocus
						/>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleSaveVersion}
								disabled={saving}
								className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary text-xs font-medium rounded hover:bg-primary/30 transition-colors disabled:opacity-50"
							>
								{saving ? (
									<LoaderIcon className="size-3 animate-spin" />
								) : (
									<CheckIcon className="size-3" />
								)}
								Save
							</button>
							<button
								type="button"
								onClick={() => setShowLabelInput(false)}
								className="px-3 py-1.5 text-inverse/40 text-xs rounded hover:bg-inverse/10 transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setShowLabelInput(true)}
						className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-inverse/5 border border-inverse/10 rounded-lg text-sm text-inverse/70 hover:bg-inverse/10 hover:text-inverse transition-colors"
					>
						<SaveIcon className="size-4" />
						Save Current Version
					</button>
				)}
			</div>

			{/* Version list */}
			<div className="flex-1 overflow-y-auto">
				{loading ? (
					<div className="flex items-center justify-center py-8">
						<LoaderIcon className="size-5 text-inverse/30 animate-spin" />
					</div>
				) : versions.length === 0 ? (
					<div className="px-4 py-8 text-center">
						<p className="text-sm text-inverse/30">No versions saved yet.</p>
						<p className="text-xs text-inverse/20 mt-1">
							Save a version to create a restore point.
						</p>
					</div>
				) : (
					<div className="py-2">
						{versions.map((v) => (
							<div
								key={v.dbId}
								className="px-4 py-3 hover:bg-inverse/5 transition-colors group"
							>
								<div className="flex items-start justify-between">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<TagIcon className="size-3 text-inverse/30 shrink-0" />
											<span className="text-sm text-inverse/80 font-medium truncate">
												{v.label || `Version ${v.versionNumber}`}
											</span>
										</div>
										<div className="flex items-center gap-2 mt-1">
											<span className="text-[10px] text-inverse/30">
												v{v.versionNumber}
											</span>
											<span className="text-[10px] text-inverse/20">
												{formatDate(v.createdAt)}
											</span>
											{v.createdByName && (
												<span className="text-[10px] text-inverse/20">
													by {v.createdByName}
												</span>
											)}
										</div>
									</div>
									<button
										type="button"
										onClick={() => handleRestore(v.dbId)}
										disabled={restoring !== null}
										className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-[10px] text-primary/80 border border-primary/20 rounded hover:bg-primary/10 transition-all disabled:opacity-50"
									>
										{restoring === v.dbId ? (
											<LoaderIcon className="size-3 animate-spin" />
										) : (
											<RotateCcwIcon className="size-3" />
										)}
										Restore
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
