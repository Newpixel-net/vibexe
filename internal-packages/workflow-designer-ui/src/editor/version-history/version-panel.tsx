"use client";

import {
	HistoryIcon,
	SaveIcon,
	RotateCcwIcon,
	XIcon,
	TagIcon,
	CheckIcon,
	LoaderIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	PlusIcon,
	MinusIcon,
	PencilIcon,
	BoxIcon,
	LinkIcon,
	StickyNoteIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDesignerStore } from "../../app-designer";

interface VersionEntry {
	dbId: number;
	versionNumber: number;
	label: string | null;
	createdAt: string;
	createdByName: string | null;
	createdByAvatar: string | null;
	nodeCount: number;
	connectionCount: number;
	stickyNoteCount: number;
	nodeTypes: Record<string, number>;
	nodeNames: string[];
}

interface VersionDiff {
	addedNodes: number;
	removedNodes: number;
	addedConnections: number;
	removedConnections: number;
	typeChanges: { type: string; before: number; after: number }[];
}

function computeDiff(
	older: VersionEntry | undefined,
	newer: VersionEntry,
): VersionDiff | null {
	if (!older) return null;

	const addedNodes = Math.max(0, newer.nodeCount - older.nodeCount);
	const removedNodes = Math.max(0, older.nodeCount - newer.nodeCount);
	const addedConnections = Math.max(
		0,
		newer.connectionCount - older.connectionCount,
	);
	const removedConnections = Math.max(
		0,
		older.connectionCount - newer.connectionCount,
	);

	// Compute type-level changes
	const allTypes = new Set([
		...Object.keys(older.nodeTypes ?? {}),
		...Object.keys(newer.nodeTypes ?? {}),
	]);
	const typeChanges: { type: string; before: number; after: number }[] = [];
	for (const type of allTypes) {
		const before = older.nodeTypes?.[type] ?? 0;
		const after = newer.nodeTypes?.[type] ?? 0;
		if (before !== after) {
			typeChanges.push({ type, before, after });
		}
	}

	return { addedNodes, removedNodes, addedConnections, removedConnections, typeChanges };
}

function DiffBadge({ diff }: { diff: VersionDiff }) {
	const changes: string[] = [];
	if (diff.addedNodes > 0) changes.push(`+${diff.addedNodes} nodes`);
	if (diff.removedNodes > 0) changes.push(`-${diff.removedNodes} nodes`);
	if (diff.addedConnections > 0) changes.push(`+${diff.addedConnections} edges`);
	if (diff.removedConnections > 0) changes.push(`-${diff.removedConnections} edges`);

	if (changes.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-1 mt-1.5">
			{diff.addedNodes > 0 && (
				<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium rounded bg-emerald-500/20 text-emerald-400">
					<PlusIcon className="size-2" />
					{diff.addedNodes}
				</span>
			)}
			{diff.removedNodes > 0 && (
				<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-500/20 text-red-400">
					<MinusIcon className="size-2" />
					{diff.removedNodes}
				</span>
			)}
			{diff.typeChanges.length > 0 && (
				<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium rounded bg-amber-500/20 text-amber-400">
					<PencilIcon className="size-2" />
					{diff.typeChanges.length} types
				</span>
			)}
		</div>
	);
}

function VersionPreview({ version }: { version: VersionEntry }) {
	const typeEntries = Object.entries(version.nodeTypes ?? {}).sort(
		(a, b) => b[1] - a[1],
	);

	return (
		<div className="mt-2 pl-5 space-y-1.5 border-l border-inverse/5">
			<div className="flex items-center gap-2 text-[10px] text-inverse/40">
				<BoxIcon className="size-3" />
				<span>{version.nodeCount} nodes</span>
				<LinkIcon className="size-3 ml-1" />
				<span>{version.connectionCount} connections</span>
				{version.stickyNoteCount > 0 && (
					<>
						<StickyNoteIcon className="size-3 ml-1" />
						<span>{version.stickyNoteCount} notes</span>
					</>
				)}
			</div>
			{typeEntries.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{typeEntries.map(([type, count]) => (
						<span
							key={type}
							className="px-1.5 py-0.5 text-[9px] rounded bg-inverse/5 text-inverse/40"
						>
							{type}
							{count > 1 ? ` x${count}` : ""}
						</span>
					))}
				</div>
			)}
			{version.nodeNames.length > 0 && (
				<div className="text-[10px] text-inverse/30 truncate">
					{version.nodeNames.slice(0, 5).join(", ")}
					{version.nodeNames.length > 5 && ` +${version.nodeNames.length - 5} more`}
				</div>
			)}
		</div>
	);
}

export function VersionPanel({ onClose }: { onClose: () => void }) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const [versions, setVersions] = useState<VersionEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [restoring, setRestoring] = useState<number | null>(null);
	const [labelInput, setLabelInput] = useState("");
	const [showLabelInput, setShowLabelInput] = useState(false);
	const [expandedVersionId, setExpandedVersionId] = useState<number | null>(null);

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

	// Compute diffs between adjacent versions
	const diffs = useMemo(() => {
		const map = new Map<number, VersionDiff | null>();
		// Versions are sorted newest-first
		for (let i = 0; i < versions.length; i++) {
			const newer = versions[i];
			const older = versions[i + 1]; // older version (lower version number)
			map.set(newer.dbId, computeDiff(older, newer));
		}
		return map;
	}, [versions]);

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
		if (
			!window.confirm(
				"Restore this version? Current changes will be overwritten.",
			)
		)
			return;

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

	const toggleExpand = (dbId: number) => {
		setExpandedVersionId((prev) => (prev === dbId ? null : dbId));
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

	const isAutoVersion = (label: string | null) =>
		label?.startsWith("Auto-save") ?? false;

	return (
		<div className="flex flex-col h-full bg-[#0d0d1a] border-l border-inverse/10 w-[320px]">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-inverse/10">
				<div className="flex items-center gap-2">
					<HistoryIcon className="size-4 text-inverse/50" />
					<span className="text-sm font-medium text-inverse/80">
						Versions
					</span>
					{versions.length > 0 && (
						<span className="text-[10px] text-inverse/30 bg-inverse/5 px-1.5 py-0.5 rounded-full">
							{versions.length}
						</span>
					)}
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
						{versions.map((v) => {
							const diff = diffs.get(v.dbId);
							const isExpanded = expandedVersionId === v.dbId;
							const isAuto = isAutoVersion(v.label);

							return (
								<div
									key={v.dbId}
									className="px-4 py-3 hover:bg-inverse/5 transition-colors group"
								>
									<div className="flex items-start justify-between">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<button
													type="button"
													onClick={() => toggleExpand(v.dbId)}
													className="p-0.5 -ml-0.5 rounded hover:bg-inverse/10 transition-colors"
												>
													{isExpanded ? (
														<ChevronDownIcon className="size-3 text-inverse/40" />
													) : (
														<ChevronRightIcon className="size-3 text-inverse/40" />
													)}
												</button>
												<TagIcon className="size-3 text-inverse/30 shrink-0" />
												<span className="text-sm text-inverse/80 font-medium truncate">
													{v.label || `Version ${v.versionNumber}`}
												</span>
												{isAuto && (
													<span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 uppercase tracking-wider">
														auto
													</span>
												)}
											</div>
											<div className="flex items-center gap-2 mt-1 pl-5">
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
												<span className="text-[10px] text-inverse/20">
													{v.nodeCount} nodes
												</span>
											</div>
											{diff && <DiffBadge diff={diff} />}
											{isExpanded && <VersionPreview version={v} />}
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
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
