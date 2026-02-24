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
	Folder,
	FolderPlus,
	LoaderCircleIcon,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
	TrashIcon,
	X,
} from "lucide-react";
import { TemplateGallery } from "./template-gallery";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BuilderApp, BuilderProject } from "@/db/schema";
import { SearchHeader } from "../../workflows/components/search-header";
import { Button } from "../../settings/components/button";

type ProjectWithApps = BuilderProject & {
	apps: (BuilderApp & { project: { id: string; name: string } | null })[];
};

type AppWithProject = BuilderApp & {
	project: { id: string; name: string } | null;
};

type SortOption = "name-asc" | "name-desc" | "date-desc" | "date-asc";

interface AppBuilderListProps {
	projects: ProjectWithApps[];
	unorganizedApps: AppWithProject[];
	createAppAction: () => Promise<void>;
	createProjectAction: () => Promise<void>;
}

function sortApps(apps: BuilderApp[], sortOption: SortOption): BuilderApp[] {
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

function filterApps(apps: BuilderApp[], query: string): BuilderApp[] {
	if (!query.trim()) return apps;
	const q = query.toLowerCase();
	return apps.filter(
		(app) =>
			(app.name || "").toLowerCase().includes(q) ||
			(app.description || "").toLowerCase().includes(q),
	);
}

function AppCard({ app }: { app: BuilderApp }) {
	const router = useRouter();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [duplicateOpen, setDuplicateOpen] = useState(false);
	const [isDeletePending, startDeleteTransition] = useTransition();
	const [isDuplicatePending, startDuplicateTransition] = useTransition();

	const handleDelete = useCallback(() => {
		startDeleteTransition(async () => {
			try {
				const res = await fetch(`/api/app-builder/apps/${app.id}`, {
					method: "DELETE",
				});
				if (res.ok) {
					setDeleteOpen(false);
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
					router.push(data.redirectPath);
				}
			} catch {
				// Error handled silently
			}
		});
	}, [app.id, router]);

	return (
		<section
			aria-label={app.name || "Untitled"}
			className="relative flex h-[200px] w-full flex-none flex-col rounded-[12px] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-blue-muted)_10%,var(--color-background))_0%,color-mix(in_srgb,var(--color-blue-muted)_6%,var(--color-stage-background))_55%,color-mix(in_srgb,var(--color-blue-muted)_4%,var(--color-background))_100%)]"
		>
			{/* Top reflection line */}
			<div className="pointer-events-none absolute top-0 left-4 right-4 z-10 h-px bg-gradient-to-r from-transparent via-text/20 to-transparent" />
			{/* Inner border */}
			<div className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-[0.5px] border-border-muted" />

			<div className="relative z-10 flex h-full w-full cursor-pointer flex-col pt-2 px-2 pb-4">
				{/* Action buttons */}
				<div className="flex w-full justify-end gap-x-2">
					{/* Duplicate */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									aria-label="Duplicate app"
									className="grid size-6 place-items-center rounded-full text-text/60 transition-colors hover:text-inverse"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setDuplicateOpen(true);
									}}
								>
									<CopyIcon className="size-4" />
								</button>
							</TooltipTrigger>
							<TooltipContent>Duplicate App</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					{/* Delete */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									aria-label="Delete app"
									className="grid size-6 place-items-center rounded-full text-text/60 transition-colors hover:text-red-500"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setDeleteOpen(true);
									}}
								>
									<TrashIcon className="size-4" />
								</button>
							</TooltipTrigger>
							<TooltipContent>Delete App</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>

				<Link
					href={`/app-builder/${app.id}`}
					className="flex h-full flex-col pt-2 px-2"
					prefetch={false}
				>
					<h3 className="font-sans text-[18px] font-semibold text-inverse line-clamp-2 mb-3">
						{app.name || "Untitled App"}
					</h3>
					{app.description && (
						<p className="mb-2 font-geist text-[13px] text-link-muted line-clamp-2">
							{app.description}
						</p>
					)}
					<div className="mt-auto flex items-center gap-1 font-geist text-[12px] text-text/60">
						<Clock className="h-3 w-3" />
						{new Date(app.updatedAt).toLocaleDateString()}
					</div>
				</Link>
			</div>

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
		</section>
	);
}

function ProjectSection({
	project,
	apps,
}: {
	project: BuilderProject;
	apps: AppWithProject[];
}) {
	const [isOpen, setIsOpen] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState(project.name);
	const [showMenu, setShowMenu] = useState(false);
	const [isPending, startTransition] = useTransition();
	const router = useRouter();

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
		<div className="mb-6">
			<div className="flex items-center gap-2 mb-3 group">
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className="flex items-center gap-2 text-sm font-semibold text-text/60 hover:text-inverse transition-colors"
				>
					{isOpen ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
					<Folder className="h-4 w-4" />
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
						className="text-sm font-semibold bg-transparent border-b border-primary outline-none px-1 text-inverse"
						autoFocus
					/>
				) : (
					<span className="text-sm font-semibold text-inverse">
						{project.name}
					</span>
				)}

				<span className="text-xs text-text/60">
					({apps.length} {apps.length === 1 ? "app" : "apps"})
				</span>

				<div className="relative ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
					<button
						type="button"
						onClick={() => setShowMenu(!showMenu)}
						className="p-1 rounded hover:bg-surface/10 transition-colors"
					>
						<MoreHorizontal className="h-4 w-4 text-text/60" />
					</button>
					{showMenu && (
						<>
							<div
								className="fixed inset-0 z-10"
								onClick={() => setShowMenu(false)}
								onKeyDown={() => {}}
							/>
							<div className="absolute right-0 top-full mt-1 z-20 bg-bg border border-border-muted rounded-lg shadow-lg py-1 min-w-[140px]">
								<button
									type="button"
									onClick={() => {
										setIsEditing(true);
										setShowMenu(false);
									}}
									className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text/80 hover:bg-surface/10 transition-colors"
								>
									<Pencil className="h-3.5 w-3.5" />
									Rename
								</button>
								<button
									type="button"
									onClick={handleDelete}
									className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-error-900 hover:bg-error-900/20 transition-colors"
								>
									<Trash2 className="h-3.5 w-3.5" />
									Delete
								</button>
							</div>
						</>
					)}
				</div>
			</div>

			{isOpen && (
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pl-6">
					{apps.length === 0 ? (
						<p className="text-xs text-text/60 col-span-full py-4">
							No apps in this project yet
						</p>
					) : (
						apps.map((app) => <AppCard key={app.id} app={app} />)
					)}
				</div>
			)}
		</div>
	);
}

export function AppBuilderList({
	projects,
	unorganizedApps,
	createAppAction,
	createProjectAction,
}: AppBuilderListProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [sortOption, setSortOption] = useState<SortOption>("date-desc");
	const [galleryOpen, setGalleryOpen] = useState(false);

	const allApps = useMemo(() => {
		const projectApps = projects.flatMap((p) => p.apps);
		return [...projectApps, ...unorganizedApps];
	}, [projects, unorganizedApps]);

	const totalApps = allApps.length;
	const hasContent = totalApps > 0 || projects.length > 0;

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
				apps: sortApps(p.apps, sortOption) as AppWithProject[],
			})),
		[projects, sortOption],
	);

	const sortedUnorganized = useMemo(
		() => sortApps(unorganizedApps, sortOption) as AppWithProject[],
		[unorganizedApps, sortOption],
	);

	return (
		<div className="h-full bg-bg">
			<div className="px-[40px] py-[24px] flex-1 max-w-[1200px] mx-auto w-full">
				{/* Header */}
				<div className="flex justify-between items-center mb-8">
					<div>
						<h1 className="font-sans text-[28px] font-semibold tracking-tight text-inverse">
							App Builder
						</h1>
						<p className="text-[14px] text-text/60 mt-1">
							Create and manage your AI-generated applications
						</p>
					</div>
					<div className="flex items-center gap-2">
						<form action={createProjectAction}>
							<button
								type="submit"
								className="inline-flex items-center gap-2 px-3 py-2 rounded-[8px] border border-border-muted text-text/80 hover:bg-surface/10 hover:text-inverse transition-colors text-sm font-medium"
							>
								<FolderPlus className="h-4 w-4" />
								New Project
							</button>
						</form>
						<button
							type="button"
							onClick={() => setGalleryOpen(true)}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-primary-200 text-background hover:bg-primary-200/90 transition-colors text-sm font-medium"
						>
							<Plus className="h-4 w-4" />
							New App
						</button>
					</div>
				</div>

				{!hasContent ? (
					<div className="text-center py-16 border border-dashed border-border-muted rounded-[12px]">
						<Folder className="h-12 w-12 mx-auto text-text/40 mb-4" />
						<h3 className="text-lg font-medium mb-2 text-inverse">
							No apps yet
						</h3>
						<p className="text-text/60 mb-4">
							Create your first app to get started
						</p>
						<button
							type="button"
							onClick={() => setGalleryOpen(true)}
							className="inline-flex items-center gap-2 px-4 py-2 bg-primary-200 text-background rounded-[8px] hover:bg-primary-200/90 transition-colors"
						>
							<Plus className="h-4 w-4" />
							Create App
						</button>
					</div>
				) : (
					<div>
						{/* Search + Sort */}
						<SearchHeader
							searchQuery={searchQuery}
							onSearchChange={setSearchQuery}
							searchPlaceholder="Search Apps..."
							sortOption={sortOption}
							onSortChange={setSortOption}
							showViewToggle={false}
						/>

						{isSearching ? (
							/* Flat search results */
							<div>
								<p className="text-xs text-text/60 mb-3">
									{filteredApps.length} result
									{filteredApps.length !== 1 ? "s" : ""} for &quot;
									{searchQuery}&quot;
								</p>
								{filteredApps.length === 0 ? (
									<p className="text-sm text-text/40 text-center py-8">
										No apps found
									</p>
								) : (
									<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
										{filteredApps.map((app) => (
											<AppCard key={app.id} app={app} />
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
									/>
								))}

								{sortedUnorganized.length > 0 && (
									<div className="mb-6">
										{projects.length > 0 && (
											<div className="flex items-center gap-2 mb-3">
												<span className="text-sm font-semibold text-text/60">
													Unorganized
												</span>
												<span className="text-xs text-text/60">
													({sortedUnorganized.length}{" "}
													{sortedUnorganized.length === 1 ? "app" : "apps"})
												</span>
											</div>
										)}
										<div
											className={`grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${projects.length > 0 ? "pl-6" : ""}`}
										>
											{sortedUnorganized.map((app) => (
												<AppCard key={app.id} app={app} />
											))}
										</div>
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
