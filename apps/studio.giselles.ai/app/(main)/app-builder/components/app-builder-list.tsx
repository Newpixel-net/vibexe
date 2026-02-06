"use client";

import {
	ChevronDown,
	ChevronRight,
	Clock,
	Folder,
	FolderPlus,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BuilderApp, BuilderProject } from "@/db/schema";

type ProjectWithApps = BuilderProject & {
	apps: (BuilderApp & { project: { id: string; name: string } | null })[];
};

type AppWithProject = BuilderApp & {
	project: { id: string; name: string } | null;
};

interface AppBuilderListProps {
	projects: ProjectWithApps[];
	unorganizedApps: AppWithProject[];
	createAppAction: () => Promise<void>;
	createProjectAction: () => Promise<void>;
}

function AppCard({ app }: { app: BuilderApp }) {
	return (
		<Link
			href={`/app-builder/${app.id}`}
			className="block p-4 border border-border/50 rounded-lg hover:border-primary/50 transition-colors bg-card/50"
		>
			<h3 className="font-medium mb-1 text-sm">{app.name}</h3>
			{app.description && (
				<p className="text-xs text-muted-foreground mb-2 line-clamp-2">
					{app.description}
				</p>
			)}
			<div className="flex items-center gap-1 text-xs text-muted-foreground">
				<Clock className="h-3 w-3" />
				{new Date(app.updatedAt).toLocaleDateString()}
			</div>
		</Link>
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
					className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
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
						className="text-sm font-semibold bg-transparent border-b border-primary outline-none px-1"
						autoFocus
					/>
				) : (
					<span className="text-sm font-semibold">{project.name}</span>
				)}

				<span className="text-xs text-muted-foreground">
					({apps.length} {apps.length === 1 ? "app" : "apps"})
				</span>

				<div className="relative ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
					<button
						type="button"
						onClick={() => setShowMenu(!showMenu)}
						className="p-1 rounded hover:bg-muted transition-colors"
					>
						<MoreHorizontal className="h-4 w-4 text-muted-foreground" />
					</button>
					{showMenu && (
						<>
							<div
								className="fixed inset-0 z-10"
								onClick={() => setShowMenu(false)}
								onKeyDown={() => {}}
							/>
							<div className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
								<button
									type="button"
									onClick={() => {
										setIsEditing(true);
										setShowMenu(false);
									}}
									className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors"
								>
									<Pencil className="h-3.5 w-3.5" />
									Rename
								</button>
								<button
									type="button"
									onClick={handleDelete}
									className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-muted transition-colors"
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
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 pl-6">
					{apps.length === 0 ? (
						<p className="text-xs text-muted-foreground col-span-full py-4">
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
	const totalApps =
		projects.reduce((sum, p) => sum + p.apps.length, 0) +
		unorganizedApps.length;
	const hasContent = totalApps > 0 || projects.length > 0;

	return (
		<div className="container mx-auto py-8 px-4">
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-2xl font-bold">App Builder</h1>
					<p className="text-muted-foreground">
						Create and manage your AI-generated applications
					</p>
				</div>
				<div className="flex items-center gap-2">
					<form action={createProjectAction}>
						<button
							type="submit"
							className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors text-sm"
						>
							<FolderPlus className="h-4 w-4" />
							New Project
						</button>
					</form>
					<form action={createAppAction}>
						<button
							type="submit"
							className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
						>
							<Plus className="h-4 w-4" />
							New App
						</button>
					</form>
				</div>
			</div>

			{!hasContent ? (
				<div className="text-center py-16 border border-dashed rounded-lg">
					<Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
					<h3 className="text-lg font-medium mb-2">No apps yet</h3>
					<p className="text-muted-foreground mb-4">
						Create your first app to get started
					</p>
					<form action={createAppAction}>
						<button
							type="submit"
							className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
						>
							<Plus className="h-4 w-4" />
							Create App
						</button>
					</form>
				</div>
			) : (
				<div>
					{/* Project groups */}
					{projects.map((project) => (
						<ProjectSection
							key={project.id}
							project={project}
							apps={project.apps}
						/>
					))}

					{/* Unorganized apps */}
					{unorganizedApps.length > 0 && (
						<div className="mb-6">
							{projects.length > 0 && (
								<div className="flex items-center gap-2 mb-3">
									<span className="text-sm font-semibold text-muted-foreground">
										Unorganized
									</span>
									<span className="text-xs text-muted-foreground">
										({unorganizedApps.length}{" "}
										{unorganizedApps.length === 1 ? "app" : "apps"})
									</span>
								</div>
							)}
							<div
								className={`grid gap-3 md:grid-cols-2 lg:grid-cols-3 ${projects.length > 0 ? "pl-6" : ""}`}
							>
								{unorganizedApps.map((app) => (
									<AppCard key={app.id} app={app} />
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
