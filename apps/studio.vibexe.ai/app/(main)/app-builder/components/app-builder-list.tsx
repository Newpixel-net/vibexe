"use client";

import {
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@vibexe-internal/ui/dialog";
import {
	ChevronDown,
	ChevronRight,
	Clock,
	CopyIcon,
	DatabaseIcon,
	ExternalLink,
	FileIcon,
	Folder,
	FolderOpen,
	FolderPlus,
	LayoutTemplateIcon,
	MoreHorizontal,
	Pencil,
	Plus,
	Rocket,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { TemplateGallery } from "./template-gallery";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { BuilderProject } from "@/db/schema";
import type { EnrichedBuilderApp } from "../lib/project-queries";
import { SearchHeader } from "../../workflows/components/search-header";
import { Button } from "../../settings/components/button";
import {
	PreviewImage,
	PREVIEW_CONTAINER_HEIGHT,
	injectPreviewScrollKeyframes,
} from "./app-preview-image";

// ============================================================================
// Types
// ============================================================================

type ProjectWithApps = BuilderProject & {
	apps: EnrichedBuilderApp[];
};

type SortOption = "name-asc" | "name-desc" | "date-desc" | "date-asc";
type ViewMode = "grid" | "list";

interface AppBuilderListProps {
	projects: ProjectWithApps[];
	unorganizedApps: EnrichedBuilderApp[];
	createAppAction: () => Promise<void>;
	createProjectAction: () => Promise<void>;
}

// ============================================================================
// Helpers
// ============================================================================

function sortApps(apps: EnrichedBuilderApp[], sortOption: SortOption): EnrichedBuilderApp[] {
	return [...apps].sort((a, b) => {
		switch (sortOption) {
			case "name-asc":
				return (a.name || "").localeCompare(b.name || "");
			case "name-desc":
				return (b.name || "").localeCompare(a.name || "");
			case "date-asc":
				return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
			case "date-desc":
			default:
				return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		}
	});
}

function filterApps(apps: EnrichedBuilderApp[], query: string): EnrichedBuilderApp[] {
	if (!query.trim()) return apps;
	const q = query.toLowerCase();
	return apps.filter(
		(app) =>
			(app.name || "").toLowerCase().includes(q) ||
			(app.description || "").toLowerCase().includes(q),
	);
}

/** Deterministic gradient from app name hash */
const GRADIENT_PAIRS = [
	"from-blue-600/40 to-cyan-500/30",
	"from-violet-600/40 to-fuchsia-500/30",
	"from-emerald-600/40 to-teal-500/30",
	"from-orange-600/40 to-amber-500/30",
	"from-rose-600/40 to-pink-500/30",
	"from-indigo-600/40 to-blue-500/30",
	"from-teal-600/40 to-emerald-500/30",
	"from-fuchsia-600/40 to-purple-500/30",
];

function getAppGradient(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	return GRADIENT_PAIRS[Math.abs(hash) % GRADIENT_PAIRS.length];
}

/** Folder color from project name */
const FOLDER_COLORS = [
	"text-blue-400",
	"text-violet-400",
	"text-emerald-400",
	"text-orange-400",
	"text-rose-400",
	"text-cyan-400",
	"text-amber-400",
	"text-fuchsia-400",
];

function getFolderColor(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	return FOLDER_COLORS[Math.abs(hash) % FOLDER_COLORS.length];
}

/** Relative time helper */
function relativeTime(date: Date | string): string {
	const now = Date.now();
	const d = new Date(date).getTime();
	const diffMs = now - d;
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHr = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHr / 24);

	if (diffSec < 60) return "just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay < 7) return `${diffDay}d ago`;
	if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
	return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================================================
// App Card — Premium Design
// ============================================================================

function AppCard({
	app,
	projects,
	viewMode,
}: {
	app: EnrichedBuilderApp;
	projects: BuilderProject[];
	viewMode: ViewMode;
}) {
	const router = useRouter();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [duplicateOpen, setDuplicateOpen] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [isDeletePending, startDeleteTransition] = useTransition();
	const [isDuplicatePending, startDuplicateTransition] = useTransition();
	const [moveMenuOpen, setMoveMenuOpen] = useState(false);
	const [isMovePending, startMoveTransition] = useTransition();
	const cardRef = useRef<HTMLDivElement>(null);

	// Hover preview state
	const [previewVisible, setPreviewVisible] = useState(false);
	const [previewPos, setPreviewPos] = useState({ top: 0, left: 0 });
	const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const previewImageUrl = app.fullpageUrl || app.thumbnailUrl;

	const handleDelete = useCallback(() => {
		startDeleteTransition(async () => {
			try {
				const res = await fetch(`/api/app-builder/apps/${app.id}`, {
					method: "DELETE",
				});
				if (res.ok) {
					setDeleteOpen(false);
					setMenuOpen(false);
					router.refresh();
				}
			} catch {
				// Error handled silently
			}
		});
	}, [app.id, router]);

	const handleDuplicate = useCallback(() => {
		startDuplicateTransition(async () => {
			try {
				const res = await fetch(`/api/app-builder/apps/${app.id}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ action: "duplicate" }),
				});
				if (res.ok) {
					const data = await res.json();
					setDuplicateOpen(false);
					setMenuOpen(false);
					router.push(data.redirectPath);
				}
			} catch {
				// Error handled silently
			}
		});
	}, [app.id, router]);

	const handleMove = useCallback(
		(projectId: string | null) => {
			startMoveTransition(async () => {
				try {
					await fetch(`/api/app-builder/apps/${app.id}/move`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ projectId }),
					});
					setMoveMenuOpen(false);
					setMenuOpen(false);
					router.refresh();
				} catch {
					// silently fail
				}
			});
		},
		[app.id, router],
	);

	// Preview hover handlers
	const showPreview = useCallback(() => {
		if (!cardRef.current || !previewImageUrl) return;
		const rect = cardRef.current.getBoundingClientRect();
		const previewWidth = 400;
		const padding = 16;
		let left = rect.right + padding;
		if (left + previewWidth > window.innerWidth - padding) {
			left = rect.left - previewWidth - padding;
		}
		left = Math.max(padding, Math.min(left, window.innerWidth - previewWidth - padding));
		let top = rect.top;
		const previewApproxHeight = PREVIEW_CONTAINER_HEIGHT + 80;
		if (top + previewApproxHeight > window.innerHeight - padding) {
			top = window.innerHeight - previewApproxHeight - padding;
		}
		top = Math.max(padding, top);
		setPreviewPos({ top, left });
		setPreviewVisible(true);
	}, [previewImageUrl]);

	const handleThumbEnter = useCallback(() => {
		if (exitTimerRef.current) { clearTimeout(exitTimerRef.current); exitTimerRef.current = null; }
		enterTimerRef.current = setTimeout(showPreview, 300);
	}, [showPreview]);

	const handleThumbLeave = useCallback(() => {
		if (enterTimerRef.current) { clearTimeout(enterTimerRef.current); enterTimerRef.current = null; }
		exitTimerRef.current = setTimeout(() => setPreviewVisible(false), 200);
	}, []);

	const handlePreviewEnter = useCallback(() => {
		if (exitTimerRef.current) { clearTimeout(exitTimerRef.current); exitTimerRef.current = null; }
	}, []);

	const handlePreviewLeave = useCallback(() => {
		exitTimerRef.current = setTimeout(() => setPreviewVisible(false), 200);
	}, []);

	useEffect(() => {
		return () => {
			if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
			if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
		};
	}, []);

	const gradient = getAppGradient(app.name || "Untitled");

	// ---- LIST VIEW ----
	if (viewMode === "list") {
		return (
			<>
				<Link
					href={`/app-builder/${app.id}`}
					prefetch={false}
					className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.03] transition-all"
				>
					{/* Small thumbnail */}
					<div className="flex-shrink-0 w-16 h-10 rounded-lg overflow-hidden border border-white/10">
						{app.thumbnailUrl ? (
							<img src={app.thumbnailUrl} alt="" className="w-full h-full object-cover" />
						) : (
							<div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
								<Rocket className="size-3.5 text-white/20" />
							</div>
						)}
					</div>

					{/* Name + description */}
					<div className="flex-1 min-w-0">
						<h3 className="text-sm font-medium text-white/90 truncate group-hover:text-blue-300 transition-colors">
							{app.name || "Untitled App"}
						</h3>
						{app.description && (
							<p className="text-[12px] text-white/35 truncate">{app.description}</p>
						)}
					</div>

					{/* Stats */}
					<div className="hidden md:flex items-center gap-4 text-[11px] text-white/30 flex-shrink-0">
						<span className="inline-flex items-center gap-1">
							<FileIcon className="size-3" />
							{app.fileCount}
						</span>
						{app.entityCount > 0 && (
							<span className="inline-flex items-center gap-1">
								<DatabaseIcon className="size-3" />
								{app.entityCount}
							</span>
						)}
					</div>

					{/* Time */}
					<span className="text-[11px] text-white/25 flex-shrink-0 w-16 text-right">
						{relativeTime(app.updatedAt)}
					</span>

					{/* Actions */}
					<div className="flex-shrink-0 relative" onClick={(e) => e.preventDefault()}>
						<button
							type="button"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								setMenuOpen(!menuOpen);
							}}
							className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
						>
							<MoreHorizontal className="size-4" />
						</button>
					</div>
				</Link>
				{renderMenuAndDialogs()}
			</>
		);
	}

	// ---- GRID VIEW (default) ----
	return (
		<>
			<div
				ref={cardRef}
				className="group relative border border-white/[0.08] rounded-2xl overflow-hidden hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.03] transition-all duration-200 cursor-pointer"
			>
				<Link href={`/app-builder/${app.id}`} prefetch={false} className="block">
					{/* Thumbnail header */}
					<div
						className={`h-36 relative overflow-hidden ${app.thumbnailUrl ? "" : `bg-gradient-to-br ${gradient}`}`}
						onMouseEnter={previewImageUrl ? handleThumbEnter : undefined}
						onMouseLeave={previewImageUrl ? handleThumbLeave : undefined}
					>
						{app.thumbnailUrl ? (
							<>
								<img
									src={app.thumbnailUrl}
									alt={app.name || ""}
									className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
								/>
								<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
							</>
						) : (
							<div className="absolute inset-0 flex items-center justify-center">
								<Rocket className="size-8 text-white/10" />
							</div>
						)}
					</div>

					{/* Content body */}
					<div className="p-4">
						<h3 className="text-[15px] font-semibold text-white/90 line-clamp-1 mb-1 group-hover:text-blue-300 transition-colors">
							{app.name || "Untitled App"}
						</h3>
						{app.description && (
							<p className="text-[13px] text-white/40 line-clamp-2 leading-relaxed mb-3">
								{app.description}
							</p>
						)}

						{/* Stats row */}
						<div className="flex items-center gap-3 text-[11px] text-white/30 mb-2">
							<span className="inline-flex items-center gap-1">
								<FileIcon className="size-3" />
								{app.fileCount} files
							</span>
							{app.entityCount > 0 && (
								<span className="inline-flex items-center gap-1">
									<DatabaseIcon className="size-3" />
									{app.entityCount} entities
								</span>
							)}
						</div>

						{/* Relative time */}
						<div className="flex items-center gap-1 text-[11px] text-white/25">
							<Clock className="size-3" />
							{relativeTime(app.updatedAt)}
						</div>
					</div>
				</Link>

				{/* 3-dot menu (hover reveal) */}
				<div className="absolute top-2.5 right-2.5 z-10">
					<button
						type="button"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setMenuOpen(!menuOpen);
						}}
						className="p-1.5 rounded-lg bg-black/30 backdrop-blur-sm text-white/60 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-black/50 transition-all"
					>
						<MoreHorizontal className="size-4" />
					</button>
				</div>
			</div>
			{renderMenuAndDialogs()}

			{/* Hover Preview Portal */}
			{typeof document !== "undefined" &&
				createPortal(
					<AnimatePresence>
						{previewVisible && previewImageUrl && (
							<motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								transition={{ duration: 0.15 }}
								className="fixed z-50 w-[400px] rounded-2xl overflow-hidden border border-white/15 bg-[#0d0d1a]/95 backdrop-blur-xl shadow-2xl shadow-black/50"
								style={{ top: previewPos.top, left: previewPos.left }}
								onMouseEnter={handlePreviewEnter}
								onMouseLeave={handlePreviewLeave}
							>
								<div
									className="overflow-hidden bg-black/20"
									style={{ height: PREVIEW_CONTAINER_HEIGHT }}
								>
									<PreviewImage
										src={previewImageUrl}
										alt={app.name || "App preview"}
										containerHeight={PREVIEW_CONTAINER_HEIGHT}
									/>
								</div>
								<div className="px-4 py-3 border-t border-white/[0.06]">
									<p className="text-sm font-medium text-white/80 truncate">
										{app.name || "Untitled App"}
									</p>
									{app.description && (
										<p className="text-[11px] text-white/35 mt-0.5 line-clamp-2">
											{app.description}
										</p>
									)}
								</div>
							</motion.div>
						)}
					</AnimatePresence>,
					document.body,
				)}
		</>
	);

	// ---- Shared menus and dialogs ----
	function renderMenuAndDialogs() {
		return (
			<>
				{/* Dropdown menu */}
				{menuOpen && (
					<>
						<div
							className="fixed inset-0 z-30"
							onClick={() => {
								setMenuOpen(false);
								setMoveMenuOpen(false);
							}}
							onKeyDown={() => {}}
						/>
						<div
							className="absolute right-2.5 top-10 z-40 bg-[#1a1a2e] border border-white/15 rounded-xl shadow-xl shadow-black/40 py-1.5 min-w-[180px]"
							style={viewMode === "list" ? { right: 12, top: "100%" } : undefined}
						>
							<Link
								href={`/app-builder/${app.id}`}
								className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-colors"
								onClick={() => setMenuOpen(false)}
							>
								<ExternalLink className="size-3.5" />
								Open
							</Link>
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setMenuOpen(false);
									setDuplicateOpen(true);
								}}
								className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-colors"
							>
								<CopyIcon className="size-3.5" />
								Duplicate
							</button>
							{/* Move to... */}
							<div className="relative">
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setMoveMenuOpen(!moveMenuOpen);
									}}
									className="w-full flex items-center justify-between gap-2.5 px-3.5 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-colors"
								>
									<span className="flex items-center gap-2.5">
										<Folder className="size-3.5" />
										Move to...
									</span>
									<ChevronRight className="size-3" />
								</button>
								{moveMenuOpen && (
									<div className="absolute left-full top-0 ml-1 bg-[#1a1a2e] border border-white/15 rounded-xl shadow-xl shadow-black/40 py-1.5 min-w-[160px]">
										<button
											type="button"
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												handleMove(null);
											}}
											disabled={isMovePending}
											className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-colors"
										>
											Unorganized
										</button>
										{projects.map((p) => (
											<button
												key={p.id}
												type="button"
												onClick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													handleMove(p.id);
												}}
												disabled={isMovePending || app.projectDbId === p.dbId}
												className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-colors disabled:opacity-30"
											>
												<Folder className="size-3" />
												{p.name}
											</button>
										))}
									</div>
								)}
							</div>
							<div className="my-1 border-t border-white/[0.06]" />
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setMenuOpen(false);
									setDeleteOpen(true);
								}}
								className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors"
							>
								<Trash2 className="size-3.5" />
								Delete
							</button>
						</div>
					</>
				)}

				{/* Delete Dialog */}
				<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
					<DialogContent variant="destructive">
						<DialogHeader>
							<div className="flex items-center justify-between">
								<DialogTitle className="font-sans text-[20px] font-medium tracking-tight text-error-900">
									Delete App
								</DialogTitle>
								<DialogClose className="rounded-sm text-inverse opacity-70 hover:opacity-100 focus:outline-none">
									<X className="h-5 w-5" />
									<span className="sr-only">Close</span>
								</DialogClose>
							</div>
							<DialogDescription className="font-geist mt-2 text-[14px] text-error-900/50">
								{`This action cannot be undone. This will permanently delete the app "${app.name || "Untitled"}".`}
							</DialogDescription>
						</DialogHeader>
						<DialogBody />
						<DialogFooter>
							<div className="mt-6 flex justify-end gap-x-3">
								<Button variant="link" onClick={() => setDeleteOpen(false)}>
									Cancel
								</Button>
								<Button
									variant="destructive"
									onClick={handleDelete}
									disabled={isDeletePending}
								>
									{isDeletePending ? "Deleting..." : "Delete"}
								</Button>
							</div>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Duplicate Dialog */}
				<Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
					<DialogContent variant="glass">
						<DialogHeader>
							<div className="flex items-center justify-between">
								<DialogTitle className="font-sans text-[20px] font-medium tracking-tight text-inverse">
									{`Duplicate "${app.name || "Untitled"}"?`}
								</DialogTitle>
								<DialogClose className="rounded-sm text-inverse opacity-70 hover:opacity-100 focus:outline-none">
									<X className="h-5 w-5" />
									<span className="sr-only">Close</span>
								</DialogClose>
							</div>
							<DialogDescription className="font-geist mt-2 text-[14px] text-text-muted">
								This will create a new app with the same files as the original.
							</DialogDescription>
						</DialogHeader>
						<DialogBody />
						<DialogFooter>
							<div className="mt-6 flex justify-end gap-x-3">
								<Button variant="link" onClick={() => setDuplicateOpen(false)}>
									Cancel
								</Button>
								<Button
									variant="primary"
									onClick={handleDuplicate}
									disabled={isDuplicatePending}
								>
									{isDuplicatePending ? "Duplicating..." : "Duplicate"}
								</Button>
							</div>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</>
		);
	}
}

// ============================================================================
// Project Section — Enhanced Folder
// ============================================================================

function ProjectSection({
	project,
	apps,
	projects,
	viewMode,
}: {
	project: BuilderProject;
	apps: EnrichedBuilderApp[];
	projects: BuilderProject[];
	viewMode: ViewMode;
}) {
	const [isOpen, setIsOpen] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState(project.name);
	const [showMenu, setShowMenu] = useState(false);
	const [isPending, startTransition] = useTransition();
	const router = useRouter();
	const folderColor = getFolderColor(project.name);

	const handleRename = async () => {
		if (!editName.trim()) return;
		await fetch(`/api/app-builder/projects/${project.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: editName.trim() }),
		});
		setIsEditing(false);
		startTransition(() => router.refresh());
	};

	const handleDelete = async () => {
		if (
			!confirm(
				`Delete project "${project.name}"? Apps inside will be moved to Unorganized.`,
			)
		)
			return;
		await fetch(`/api/app-builder/projects/${project.id}`, {
			method: "DELETE",
		});
		setShowMenu(false);
		startTransition(() => router.refresh());
	};

	return (
		<div className="mb-8">
			<div className="flex items-center gap-2.5 mb-4 group">
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className="flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white/90 transition-colors"
				>
					{isOpen ? (
						<ChevronDown className="size-4 text-white/40" />
					) : (
						<ChevronRight className="size-4 text-white/40" />
					)}
					{isOpen ? (
						<FolderOpen className={`size-4 ${folderColor}`} />
					) : (
						<Folder className={`size-4 ${folderColor}`} />
					)}
				</button>

				{isEditing ? (
					<input
						type="text"
						value={editName}
						onChange={(e) => setEditName(e.target.value)}
						onBlur={handleRename}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleRename();
							if (e.key === "Escape") {
								setIsEditing(false);
								setEditName(project.name);
							}
						}}
						className="text-sm font-semibold bg-transparent border-b border-blue-500/50 outline-none px-1 text-white/90"
						autoFocus
					/>
				) : (
					<span className="text-sm font-semibold text-white/90">
						{project.name}
					</span>
				)}

				<span className="text-[11px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">
					{apps.length}
				</span>

				<div className="relative ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
					<button
						type="button"
						onClick={() => setShowMenu(!showMenu)}
						className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
					>
						<MoreHorizontal className="size-4 text-white/40" />
					</button>
					{showMenu && (
						<>
							<div
								className="fixed inset-0 z-10"
								onClick={() => setShowMenu(false)}
								onKeyDown={() => {}}
							/>
							<div className="absolute right-0 top-full mt-1 z-20 bg-[#1a1a2e] border border-white/15 rounded-xl shadow-xl shadow-black/40 py-1.5 min-w-[140px]">
								<button
									type="button"
									onClick={() => {
										setIsEditing(true);
										setShowMenu(false);
									}}
									className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-colors"
								>
									<Pencil className="size-3.5" />
									Rename
								</button>
								<button
									type="button"
									onClick={handleDelete}
									className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors"
								>
									<Trash2 className="size-3.5" />
									Delete
								</button>
							</div>
						</>
					)}
				</div>
			</div>

			{/* Collapse/expand with CSS grid transition */}
			<div
				className="overflow-hidden transition-all duration-200"
				style={{
					display: "grid",
					gridTemplateRows: isOpen ? "1fr" : "0fr",
				}}
			>
				<div className="min-h-0">
					{viewMode === "grid" ? (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pl-7">
							{apps.length === 0 ? (
								<p className="text-xs text-white/30 col-span-full py-6 text-center">
									No apps in this project yet
								</p>
							) : (
								apps.map((a) => (
									<AppCard key={a.id} app={a} projects={projects} viewMode={viewMode} />
								))
							)}
						</div>
					) : (
						<div className="flex flex-col gap-1.5 pl-7">
							{apps.length === 0 ? (
								<p className="text-xs text-white/30 py-4 text-center">
									No apps in this project yet
								</p>
							) : (
								apps.map((a) => (
									<AppCard key={a.id} app={a} projects={projects} viewMode={viewMode} />
								))
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ onNewApp, onBrowseTemplates }: { onNewApp: () => void; onBrowseTemplates: () => void }) {
	return (
		<div className="relative py-20 px-8 text-center rounded-2xl border border-dashed border-white/[0.08] overflow-hidden">
			{/* Animated gradient background */}
			<div className="absolute inset-0 opacity-30">
				<div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-violet-600/10 to-fuchsia-600/20" />
				<div
					className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent"
					style={{ animation: "pulse 4s ease-in-out infinite" }}
				/>
			</div>

			<div className="relative z-10">
				<div className="mx-auto mb-6 inline-flex p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
					<Sparkles className="size-10 text-blue-400/60" />
				</div>
				<h3 className="text-2xl font-bold text-white/90 mb-2">
					Build Something Amazing
				</h3>
				<p className="text-sm text-white/40 max-w-md mx-auto mb-8">
					Create your first app from scratch or start with a template.
					AI-powered code generation makes it easy.
				</p>
				<div className="flex items-center justify-center gap-3">
					<button
						type="button"
						onClick={onNewApp}
						className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600/90 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
					>
						<Plus className="size-4" />
						Create from Scratch
					</button>
					<button
						type="button"
						onClick={onBrowseTemplates}
						className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white/70 text-sm font-medium hover:bg-white/[0.1] hover:text-white/90 transition-colors"
					>
						<LayoutTemplateIcon className="size-4" />
						Browse Templates
					</button>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Main Export
// ============================================================================

export function AppBuilderList({
	projects,
	unorganizedApps,
	createAppAction,
	createProjectAction,
}: AppBuilderListProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [sortOption, setSortOption] = useState<SortOption>("date-desc");
	const [galleryOpen, setGalleryOpen] = useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>(() => {
		if (typeof window !== "undefined") {
			return (localStorage.getItem("vibexe-app-builder-view") as ViewMode) || "grid";
		}
		return "grid";
	});

	// Persist view mode
	useEffect(() => {
		localStorage.setItem("vibexe-app-builder-view", viewMode);
	}, [viewMode]);

	// Inject preview scroll keyframes
	useEffect(() => {
		injectPreviewScrollKeyframes();
	}, []);

	const allApps = useMemo(() => {
		const projectApps = projects.flatMap((p) => p.apps);
		return [...projectApps, ...unorganizedApps];
	}, [projects, unorganizedApps]);

	const totalApps = allApps.length;
	const hasContent = totalApps > 0 || projects.length > 0;

	// Flat project list for move menu
	const allProjects = useMemo(() => projects as BuilderProject[], [projects]);

	// Filter and sort for flat view (when searching)
	const isSearching = searchQuery.trim().length > 0;
	const filteredApps = useMemo(
		() => sortApps(filterApps(allApps, searchQuery), sortOption),
		[allApps, searchQuery, sortOption],
	);

	// Sort project apps and unorganized apps separately (when not searching)
	const sortedProjects = useMemo(
		() =>
			projects.map((p) => ({
				...p,
				apps: sortApps(p.apps, sortOption),
			})),
		[projects, sortOption],
	);

	const sortedUnorganized = useMemo(
		() => sortApps(unorganizedApps, sortOption),
		[unorganizedApps, sortOption],
	);

	return (
		<div className="h-full bg-bg">
			<div className="px-[40px] py-[24px] flex-1 max-w-[1400px] mx-auto w-full">
				{/* Header */}
				<div className="flex justify-between items-start mb-8">
					<div>
						<h1 className="font-sans text-[28px] font-semibold tracking-tight text-inverse">
							App Builder
						</h1>
						<p className="text-[14px] text-white/40 mt-1">
							{totalApps > 0
								? `${totalApps} app${totalApps !== 1 ? "s" : ""}${projects.length > 0 ? ` across ${projects.length} project${projects.length !== 1 ? "s" : ""}` : ""}`
								: "Create and manage your AI-generated applications"}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<form action={createProjectAction}>
							<button
								type="submit"
								className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.1] text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors text-sm font-medium"
							>
								<FolderPlus className="size-4" />
								New Project
							</button>
						</form>
						<button
							type="button"
							onClick={() => setGalleryOpen(true)}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/90 text-white hover:bg-blue-500 transition-colors text-sm font-medium"
						>
							<Plus className="size-4" />
							New App
						</button>
					</div>
				</div>

				{!hasContent ? (
					<EmptyState
						onNewApp={() => setGalleryOpen(true)}
						onBrowseTemplates={() => setGalleryOpen(true)}
					/>
				) : (
					<div>
						{/* Search + Sort + View Toggle */}
						<SearchHeader
							searchQuery={searchQuery}
							onSearchChange={setSearchQuery}
							searchPlaceholder="Search apps..."
							sortOption={sortOption}
							onSortChange={setSortOption}
							showViewToggle={true}
							viewMode={viewMode}
							onViewModeChange={setViewMode}
						/>

						{isSearching ? (
							/* Flat search results */
							<div>
								<p className="text-xs text-white/40 mb-3">
									{filteredApps.length} result
									{filteredApps.length !== 1 ? "s" : ""} for &quot;
									{searchQuery}&quot;
								</p>
								{filteredApps.length === 0 ? (
									<p className="text-sm text-white/30 text-center py-12">
										No apps found
									</p>
								) : viewMode === "grid" ? (
									<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
										{filteredApps.map((app) => (
											<AppCard key={app.id} app={app} projects={allProjects} viewMode={viewMode} />
										))}
									</div>
								) : (
									<div className="flex flex-col gap-1.5">
										{filteredApps.map((app) => (
											<AppCard key={app.id} app={app} projects={allProjects} viewMode={viewMode} />
										))}
									</div>
								)}
							</div>
						) : (
							/* Grouped view */
							<div>
								{sortedProjects.map((project) => (
									<ProjectSection
										key={project.id}
										project={project}
										apps={project.apps}
										projects={allProjects}
										viewMode={viewMode}
									/>
								))}

								{sortedUnorganized.length > 0 && (
									<div className="mb-8">
										{projects.length > 0 && (
											<div className="flex items-center gap-2.5 mb-4">
												<span className="text-sm font-semibold text-white/50">
													Unorganized
												</span>
												<span className="text-[11px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">
													{sortedUnorganized.length}
												</span>
											</div>
										)}
										{viewMode === "grid" ? (
											<div
												className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${projects.length > 0 ? "pl-7" : ""}`}
											>
												{sortedUnorganized.map((app) => (
													<AppCard key={app.id} app={app} projects={allProjects} viewMode={viewMode} />
												))}
											</div>
										) : (
											<div
												className={`flex flex-col gap-1.5 ${projects.length > 0 ? "pl-7" : ""}`}
											>
												{sortedUnorganized.map((app) => (
													<AppCard key={app.id} app={app} projects={allProjects} viewMode={viewMode} />
												))}
											</div>
										)}
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>

			<TemplateGallery
				open={galleryOpen}
				onOpenChange={setGalleryOpen}
				createAppAction={createAppAction}
			/>
		</div>
	);
}
