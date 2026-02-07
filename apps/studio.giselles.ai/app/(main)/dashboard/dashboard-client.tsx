"use client";

import {
	ArrowRight,
	Clock,
	FolderPlus,
	GitBranch,
	Plus,
	Sparkles,
	Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface RecentApp {
	id: string;
	name: string;
	description: string | null;
	updatedAt: string;
}

interface RecentWorkflow {
	id: string;
	name: string | null;
	updatedAt: string;
}

interface DashboardClientProps {
	recentApps: RecentApp[];
	recentWorkflows: RecentWorkflow[];
}

export function DashboardClient({
	recentApps,
	recentWorkflows,
}: DashboardClientProps) {
	const router = useRouter();
	const [isCreating, setIsCreating] = useState(false);

	const handleCreateApp = async () => {
		if (isCreating) return;
		setIsCreating(true);
		try {
			const res = await fetch("/api/app-builder/apps", { method: "POST" });
			if (res.ok) {
				const data = await res.json();
				if (data.redirectPath) {
					router.push(data.redirectPath);
				}
			}
		} catch {
			setIsCreating(false);
		}
	};

	const handleCreateWorkflow = async () => {
		if (isCreating) return;
		setIsCreating(true);
		try {
			const res = await fetch("/api/workspaces", { method: "POST" });
			if (res.ok) {
				const data = await res.json();
				if (data.redirectPath) {
					router.push(data.redirectPath);
				}
			}
		} catch {
			setIsCreating(false);
		}
	};

	return (
		<div className="container mx-auto py-8 px-4 max-w-6xl">
			{/* Header */}
			<div className="mb-8">
				<h1 className="text-2xl font-bold">Dashboard</h1>
				<p className="text-muted-foreground">
					Welcome back. Here's what's happening with your projects.
				</p>
			</div>

			{/* Quick Actions */}
			<div className="grid gap-4 md:grid-cols-3 mb-10">
				<button
					type="button"
					onClick={handleCreateApp}
					disabled={isCreating}
					className="flex items-center gap-4 p-5 border border-border/50 rounded-xl bg-card/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
				>
					<div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
						<Plus className="h-5 w-5 text-primary" />
					</div>
					<div>
						<div className="font-semibold text-sm">Create App</div>
						<div className="text-xs text-muted-foreground">
							Build with AI chat
						</div>
					</div>
				</button>

				<button
					type="button"
					onClick={handleCreateWorkflow}
					disabled={isCreating}
					className="flex items-center gap-4 p-5 border border-border/50 rounded-xl bg-card/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
				>
					<div className="h-11 w-11 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
						<Workflow className="h-5 w-5 text-blue-500" />
					</div>
					<div>
						<div className="font-semibold text-sm">Create Workflow</div>
						<div className="text-xs text-muted-foreground">
							Visual node editor
						</div>
					</div>
				</button>

				<Link
					href="/app-builder"
					className="flex items-center gap-4 p-5 border border-border/50 rounded-xl bg-card/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
				>
					<div className="h-11 w-11 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
						<FolderPlus className="h-5 w-5 text-green-500" />
					</div>
					<div>
						<div className="font-semibold text-sm">Manage Projects</div>
						<div className="text-xs text-muted-foreground">
							Organize your apps
						</div>
					</div>
				</Link>
			</div>

			{/* Recent Apps */}
			<div className="mb-10">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						Recent Apps
					</h2>
					<Link
						href="/app-builder"
						className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
					>
						View all <ArrowRight className="h-3.5 w-3.5" />
					</Link>
				</div>

				{recentApps.length === 0 ? (
					<div className="text-center py-10 border border-dashed rounded-lg">
						<Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
						<p className="text-sm text-muted-foreground mb-3">
							No apps yet. Create your first app!
						</p>
						<button
							type="button"
							onClick={handleCreateApp}
							disabled={isCreating}
							className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
						>
							<Plus className="h-4 w-4" />
							Create App
						</button>
					</div>
				) : (
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
						{recentApps.map((app) => (
							<Link
								key={app.id}
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
						))}
					</div>
				)}
			</div>

			{/* Recent Workflows */}
			<div>
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold flex items-center gap-2">
						<GitBranch className="h-5 w-5 text-blue-500" />
						Recent Workflows
					</h2>
					<Link
						href="/workflows"
						className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
					>
						View all <ArrowRight className="h-3.5 w-3.5" />
					</Link>
				</div>

				{recentWorkflows.length === 0 ? (
					<div className="text-center py-10 border border-dashed rounded-lg">
						<Workflow className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
						<p className="text-sm text-muted-foreground mb-3">
							No workflows yet. Create your first workflow!
						</p>
						<button
							type="button"
							onClick={handleCreateWorkflow}
							disabled={isCreating}
							className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors text-sm disabled:opacity-50"
						>
							<Plus className="h-4 w-4" />
							Create Workflow
						</button>
					</div>
				) : (
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
						{recentWorkflows.map((w) => (
							<Link
								key={w.id}
								href={`/workflows/${w.id}`}
								className="block p-4 border border-border/50 rounded-lg hover:border-blue-500/50 transition-colors bg-card/50"
							>
								<div className="flex items-center gap-2 mb-2">
									<GitBranch className="h-4 w-4 text-blue-500" />
									<h3 className="font-medium text-sm">
										{w.name || "Untitled Workflow"}
									</h3>
								</div>
								<div className="flex items-center gap-1 text-xs text-muted-foreground">
									<Clock className="h-3 w-3" />
									{new Date(w.updatedAt).toLocaleDateString()}
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
