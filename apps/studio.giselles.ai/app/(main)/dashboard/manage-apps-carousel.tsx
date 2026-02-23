"use client";

/**
 * ManageAppsCarousel — Hero carousel for managing deployed apps.
 *
 * Live iframe preview of deployed apps, navigation (arrows + dropdown),
 * quick stats panel, and action buttons (Delete, ON/OFF, Preview, Edit).
 */

import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Ghost,
	HardDrive,
	Layers,
	Pencil,
	Power,
	Rocket,
	Trash2,
	Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { ManageableApp } from "@/lib/dashboard/get-dashboard-data";

// ====================================================================
// HELPERS
// ====================================================================

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`;
}

function timeAgo(iso: string | null): string {
	if (!iso) return "Never";
	const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(iso).toLocaleDateString();
}

// ====================================================================
// STATUS BADGE
// ====================================================================

function StatusBadge({ status }: { status: string | null }) {
	if (!status || status === "not_deployed") {
		return (
			<span className="inline-flex items-center gap-1 text-[11px] text-white/25">
				<span className="h-1.5 w-1.5 rounded-full bg-white/20" />
				Not deployed
			</span>
		);
	}
	if (status === "live") {
		return (
			<span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
				<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
				Active
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
			<span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
			{status.charAt(0).toUpperCase() + status.slice(1)}
		</span>
	);
}

// ====================================================================
// CONFIRM DIALOG
// ====================================================================

function ConfirmDialog({
	appName,
	onConfirm,
	onCancel,
}: {
	appName: string;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="glass-card p-6 max-w-sm w-full mx-4">
				<h3 className="text-sm font-semibold text-white/80 mb-2">Delete App</h3>
				<p className="text-xs text-white/40 mb-4">
					Are you sure you want to delete <strong className="text-white/60">{appName}</strong>? This action cannot be undone.
				</p>
				<div className="flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 rounded-lg transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	);
}

// ====================================================================
// MAIN COMPONENT
// ====================================================================

interface ManageAppsCarouselProps {
	apps: ManageableApp[];
}

export function ManageAppsCarousel({ apps }: ManageAppsCarouselProps) {
	const router = useRouter();
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [iframeLoaded, setIframeLoaded] = useState(false);
	const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const app = apps[currentIndex];

	const goTo = useCallback(
		(index: number, dir: "left" | "right") => {
			setSlideDir(dir);
			setIframeLoaded(false);
			setTimeout(() => {
				setCurrentIndex(index);
				setSlideDir(null);
			}, 150);
		},
		[],
	);

	const goPrev = useCallback(() => {
		const next = currentIndex === 0 ? apps.length - 1 : currentIndex - 1;
		goTo(next, "right");
	}, [currentIndex, apps.length, goTo]);

	const goNext = useCallback(() => {
		const next = currentIndex === apps.length - 1 ? 0 : currentIndex + 1;
		goTo(next, "left");
	}, [currentIndex, apps.length, goTo]);

	const handleDelete = useCallback(async () => {
		if (!deleteConfirm || isDeleting) return;
		setIsDeleting(true);
		try {
			const res = await fetch(`/api/app-builder/apps/${deleteConfirm}`, { method: "DELETE" });
			if (res.ok) {
				setDeleteConfirm(null);
				router.refresh();
			}
		} catch {
			// ignored
		}
		setIsDeleting(false);
	}, [deleteConfirm, isDeleting, router]);

	// Empty state
	if (apps.length === 0) {
		return (
			<div className="glass-card p-8 mb-6 text-center dash-animate-fade-up" style={{ animationDelay: "0.1s" }}>
				<Ghost className="h-10 w-10 mx-auto text-white/10 mb-3" />
				<p className="text-sm text-white/30 mb-1">No apps yet</p>
				<p className="text-xs text-white/20">Describe your first project above!</p>
			</div>
		);
	}

	const isDeployed = app.deployment?.status === "live" && app.deployment?.subdomain;
	const deployUrl = isDeployed ? `https://vibexe.online/apps/${app.deployment!.subdomain}/` : null;

	return (
		<>
			<div className="glass-card p-5 mb-6 dash-animate-fade-up" style={{ animationDelay: "0.1s" }}>
				{/* Header row */}
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-sm font-medium text-white/50 flex items-center gap-1.5">
						<Layers className="h-3.5 w-3.5" />
						Manage Your Apps
					</h3>
					<span className="text-[10px] text-white/20 tabular-nums">
						{currentIndex + 1} / {apps.length}
					</span>
				</div>

				{/* App selector row */}
				<div className="flex items-center gap-2 mb-4">
					<button
						type="button"
						onClick={goPrev}
						className="h-7 w-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.1] transition-colors flex-shrink-0"
					>
						<ChevronLeft className="h-3.5 w-3.5" />
					</button>

					{/* Dropdown selector */}
					<div className="relative flex-1" ref={dropdownRef}>
						<button
							type="button"
							onClick={() => setIsDropdownOpen(!isDropdownOpen)}
							className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] transition-colors text-left"
						>
							<span className="text-sm text-white/70 truncate">{app.name}</span>
							<ChevronDown className={`h-3 w-3 text-white/30 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
						</button>

						{isDropdownOpen && (
							<div className="absolute top-full left-0 right-0 mt-1 z-20 glass-card p-1 max-h-48 overflow-y-auto">
								{apps.map((a, i) => (
									<button
										key={a.id}
										type="button"
										onClick={() => {
											goTo(i, i > currentIndex ? "left" : "right");
											setIsDropdownOpen(false);
										}}
										className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors truncate ${
											i === currentIndex
												? "bg-white/[0.08] text-white/80"
												: "text-white/40 hover:bg-white/[0.06] hover:text-white/60"
										}`}
									>
										{a.name}
										{a.deployment?.status === "live" && (
											<span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
										)}
									</button>
								))}
							</div>
						)}
					</div>

					<button
						type="button"
						onClick={goNext}
						className="h-7 w-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.1] transition-colors flex-shrink-0"
					>
						<ChevronRight className="h-3.5 w-3.5" />
					</button>
				</div>

				{/* Content: iframe + info */}
				<div
					className={`flex flex-col md:flex-row gap-4 transition-all duration-200 ${
						slideDir === "left"
							? "opacity-0 translate-x-4"
							: slideDir === "right"
								? "opacity-0 -translate-x-4"
								: "opacity-100 translate-x-0"
					}`}
				>
					{/* Iframe preview */}
					<div className="flex-1 min-w-0">
						<div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.06]">
							{isDeployed && deployUrl ? (
								<>
									{!iframeLoaded && (
										<div className="absolute inset-0 iframe-shimmer rounded-xl" />
									)}
									<iframe
										src={deployUrl}
										title={`Preview: ${app.name}`}
										className="absolute inset-0 w-full h-full pointer-events-none"
										sandbox="allow-scripts allow-same-origin"
										loading="lazy"
										onLoad={() => setIframeLoaded(true)}
									/>
								</>
							) : (
								<div className="absolute inset-0 flex flex-col items-center justify-center">
									<Ghost className="h-8 w-8 text-white/10 mb-2" />
									<span className="text-xs text-white/20 mb-2">Not Deployed</span>
									<button
										type="button"
										onClick={() => router.push(`/app-builder/${app.id}`)}
										className="text-[10px] text-blue-400/60 hover:text-blue-400 transition-colors flex items-center gap-1"
									>
										<Rocket className="h-3 w-3" />
										Deploy this app
									</button>
								</div>
							)}
						</div>
					</div>

					{/* Info panel */}
					<div className="md:w-48 flex flex-row md:flex-col gap-3 flex-wrap">
						<div className="flex items-center gap-2 text-xs">
							<HardDrive className="h-3 w-3 text-white/20 flex-shrink-0" />
							<div className="flex-1 min-w-0">
								<span className="text-white/50">
									{formatBytes(app.usedStorageBytes)} / {app.storageQuotaMb} MB
								</span>
								<div className="mt-0.5 h-1 bg-white/[0.06] rounded-full overflow-hidden">
									<div
										className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
										style={{
											width: `${Math.min((app.usedStorageBytes / (app.storageQuotaMb * 1024 * 1024)) * 100, 100)}%`,
										}}
									/>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2 text-xs">
							<Power className="h-3 w-3 text-white/20 flex-shrink-0" />
							<StatusBadge status={app.deployment?.status ?? null} />
						</div>

						<div className="flex items-center gap-2 text-xs">
							<Layers className="h-3 w-3 text-white/20 flex-shrink-0" />
							<span className="text-white/40">{app.entityCount} entities</span>
						</div>

						<div className="flex items-center gap-2 text-xs">
							<Zap className="h-3 w-3 text-white/20 flex-shrink-0" />
							<span className="text-white/40">{app.functionCount} functions</span>
						</div>

						<div className="flex items-center gap-2 text-xs">
							<Rocket className="h-3 w-3 text-white/20 flex-shrink-0" />
							<span className="text-white/40">
								Deployed {timeAgo(app.deployment?.deployedAt ?? null)}
							</span>
						</div>
					</div>
				</div>

				{/* Action buttons */}
				<div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
					<button
						type="button"
						onClick={() => setDeleteConfirm(app.id)}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
					>
						<Trash2 className="h-3 w-3" />
						Delete
					</button>

					<button
						type="button"
						disabled
						title="Coming soon"
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/20 cursor-not-allowed"
					>
						<Power className="h-3 w-3" />
						ON/OFF
					</button>

					<div className="flex-1" />

					<button
						type="button"
						disabled={!isDeployed}
						onClick={() => deployUrl && window.open(deployUrl, "_blank")}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
					>
						<ExternalLink className="h-3 w-3" />
						Preview
					</button>

					<button
						type="button"
						onClick={() => router.push(`/app-builder/${app.id}`)}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
					>
						<Pencil className="h-3 w-3" />
						Edit
					</button>
				</div>
			</div>

			{/* Delete confirmation modal */}
			{deleteConfirm && (
				<ConfirmDialog
					appName={apps.find((a) => a.id === deleteConfirm)?.name ?? "this app"}
					onConfirm={handleDelete}
					onCancel={() => setDeleteConfirm(null)}
				/>
			)}
		</>
	);
}
