"use client";

/**
 * DashboardClient — Main dashboard layout
 *
 * Hero prompt → Stats bar → Bento grid (apps + workflows) →
 * Activity feed → Quick links
 */

import {
	ArrowRight,
	ArrowUpRight,
	BookOpen,
	Clock,
	Code2,
	FileCode2,
	GitBranch,
	Globe,
	Layers,
	Loader2,
	Plus,
	Rocket,
	Shield,
	Sparkles,
	Users,
	Workflow,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData, ActivityItem, EnhancedApp, RecentWorkflow } from "@/lib/dashboard/get-dashboard-data";
import { HeroPrompt } from "./hero-prompt";

// ====================================================================
// ANIMATED COUNTER HOOK
// ====================================================================

function useCountUp(target: number, duration = 1200) {
	const [value, setValue] = useState(0);
	const ref = useRef<HTMLSpanElement>(null);
	const counted = useRef(false);

	useEffect(() => {
		if (counted.current || target === 0) {
			setValue(target);
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting || counted.current) return;
				counted.current = true;
				observer.disconnect();

				const start = performance.now();
				const step = (now: number) => {
					const elapsed = now - start;
					const progress = Math.min(elapsed / duration, 1);
					// easeOutExpo
					const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
					setValue(Math.round(eased * target));
					if (progress < 1) requestAnimationFrame(step);
				};
				requestAnimationFrame(step);
			},
			{ threshold: 0.3 },
		);

		if (ref.current) observer.observe(ref.current);
		return () => observer.disconnect();
	}, [target, duration]);

	return { value, ref };
}

// ====================================================================
// STAT CARD
// ====================================================================

function StatCard({
	label,
	value,
	icon: Icon,
	color,
}: {
	label: string;
	value: number;
	icon: React.ElementType;
	color: string;
}) {
	const { value: animated, ref } = useCountUp(value);
	return (
		<div className="glass-card p-4 flex items-center gap-3 group hover:bg-white/[0.06] transition-colors">
			<div
				className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
				style={{ background: `${color}15` }}
			>
				<Icon className="h-4 w-4" style={{ color }} />
			</div>
			<div>
				<span ref={ref} className="text-lg font-semibold text-white/90 tabular-nums">
					{animated}
				</span>
				<p className="text-[11px] text-white/30 leading-tight">{label}</p>
			</div>
		</div>
	);
}

// ====================================================================
// APP CARD
// ====================================================================

function AppCard({ app }: { app: EnhancedApp }) {
	const deployBadge = app.deployment ? (
		<span
			className={`
				inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
				${
					app.deployment.status === "live"
						? "bg-emerald-500/10 text-emerald-400"
						: app.deployment.status === "building"
							? "bg-amber-500/10 text-amber-400"
							: "bg-white/[0.06] text-white/30"
				}
			`}
		>
			{app.deployment.status === "live" && <Globe className="h-2.5 w-2.5" />}
			{app.deployment.status === "live" ? "Live" : app.deployment.status}
		</span>
	) : null;

	return (
		<Link
			href={`/app-builder/${app.id}`}
			className="glass-card p-4 group hover:bg-white/[0.06] hover:border-white/[0.12] transition-all block"
		>
			<div className="flex items-start justify-between mb-2">
				<div className="flex items-center gap-2 min-w-0">
					<div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
						<Layers className="h-4 w-4 text-blue-400" />
					</div>
					<h3 className="text-sm font-medium text-white/80 truncate group-hover:text-white/90 transition-colors">
						{app.name}
					</h3>
				</div>
				{deployBadge}
			</div>

			{app.description && (
				<p className="text-xs text-white/30 line-clamp-2 mb-3 ml-10">
					{app.description}
				</p>
			)}

			<div className="flex items-center gap-3 ml-10 text-[10px] text-white/20">
				{app.entityCount > 0 && (
					<span className="flex items-center gap-0.5">
						<FileCode2 className="h-2.5 w-2.5" />
						{app.entityCount} entities
					</span>
				)}
				{app.hasAuth && (
					<span className="flex items-center gap-0.5">
						<Shield className="h-2.5 w-2.5" />
						Auth
					</span>
				)}
				{app.functionCount > 0 && (
					<span className="flex items-center gap-0.5">
						<Zap className="h-2.5 w-2.5" />
						{app.functionCount} functions
					</span>
				)}
				<span className="flex items-center gap-0.5 ml-auto">
					<Clock className="h-2.5 w-2.5" />
					{timeAgo(app.updatedAt)}
				</span>
			</div>
		</Link>
	);
}

// ====================================================================
// WORKFLOW CARD
// ====================================================================

function WorkflowCard({ workflow }: { workflow: RecentWorkflow }) {
	return (
		<Link
			href={`/workflows/${workflow.id}`}
			className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
		>
			<div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
				<GitBranch className="h-4 w-4 text-violet-400" />
			</div>
			<div className="flex-1 min-w-0">
				<h4 className="text-sm text-white/70 truncate group-hover:text-white/85 transition-colors">
					{workflow.name || "Untitled Workflow"}
				</h4>
				<p className="text-[10px] text-white/20">{timeAgo(workflow.updatedAt)}</p>
			</div>
			<ArrowRight className="h-3.5 w-3.5 text-white/10 group-hover:text-white/30 transition-colors" />
		</Link>
	);
}

// ====================================================================
// ACTIVITY ITEM
// ====================================================================

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
	app_created: { icon: Plus, color: "hsl(219, 90%, 60%)" },
	app_deployed: { icon: Rocket, color: "hsl(141, 100%, 61%)" },
	workflow_created: { icon: GitBranch, color: "hsl(275, 96%, 60%)" },
};

function ActivityRow({ item }: { item: ActivityItem }) {
	const config = ACTIVITY_ICONS[item.type] ?? ACTIVITY_ICONS.app_created;
	const Icon = config.icon;

	return (
		<div className="flex items-start gap-3 py-2">
			<div className="relative mt-0.5">
				<div
					className="h-6 w-6 rounded-full flex items-center justify-center"
					style={{ background: `${config.color}15` }}
				>
					<Icon className="h-3 w-3" style={{ color: config.color }} />
				</div>
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-xs text-white/60 truncate">{item.title}</p>
				<p className="text-[10px] text-white/20">{timeAgo(item.timestamp)}</p>
			</div>
		</div>
	);
}

// ====================================================================
// QUICK LINK
// ====================================================================

function QuickLink({
	href,
	icon: Icon,
	label,
	description,
}: {
	href: string;
	icon: React.ElementType;
	label: string;
	description: string;
}) {
	return (
		<Link
			href={href}
			className="glass-card p-4 group hover:bg-white/[0.06] hover:border-white/[0.12] transition-all block"
		>
			<div className="flex items-center gap-3">
				<div className="h-8 w-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
					<Icon className="h-4 w-4 text-white/40 group-hover:text-white/60 transition-colors" />
				</div>
				<div className="flex-1 min-w-0">
					<span className="text-sm text-white/70 group-hover:text-white/85 transition-colors font-medium">
						{label}
					</span>
					<p className="text-[10px] text-white/25">{description}</p>
				</div>
				<ArrowUpRight className="h-3.5 w-3.5 text-white/10 group-hover:text-white/30 transition-colors" />
			</div>
		</Link>
	);
}

// ====================================================================
// TIME HELPER
// ====================================================================

function timeAgo(iso: string): string {
	const seconds = Math.floor(
		(Date.now() - new Date(iso).getTime()) / 1000,
	);
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
// MAIN DASHBOARD CLIENT
// ====================================================================

interface DashboardClientProps {
	data: DashboardData;
}

export function DashboardClient({ data }: DashboardClientProps) {
	const router = useRouter();
	const [isCreating, setIsCreating] = useState(false);

	const handleQuickCreate = useCallback(
		async (type: "app" | "workflow") => {
			if (isCreating) return;
			setIsCreating(true);
			try {
				const endpoint =
					type === "app" ? "/api/app-builder/apps" : "/api/workspaces";
				const res = await fetch(endpoint, { method: "POST" });
				if (res.ok) {
					const d = await res.json();
					if (d.redirectPath) router.push(d.redirectPath);
				}
			} catch {
				// ignored
			}
			setIsCreating(false);
		},
		[isCreating, router],
	);

	const { stats, recentApps, recentWorkflows, activity, user } = data;

	return (
		<div className="max-w-6xl mx-auto px-6 py-6">
			{/* Greeting */}
			<div className="mb-2 dash-animate-fade-up">
				<h2 className="text-lg font-semibold text-white/80">
					Welcome back{user.displayName !== "User" ? `, ${user.displayName}` : ""}
				</h2>
			</div>

			{/* Hero Prompt */}
			<HeroPrompt />

			{/* Stats Bar */}
			<div
				className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 dash-animate-fade-up"
				style={{ animationDelay: "0.15s" }}
			>
				<StatCard label="Apps" value={stats.totalApps} icon={Layers} color="hsl(219, 90%, 60%)" />
				<StatCard label="Workflows" value={stats.totalWorkflows} icon={Workflow} color="hsl(275, 96%, 60%)" />
				<StatCard label="Live Deploys" value={stats.liveDeployments} icon={Rocket} color="hsl(141, 100%, 61%)" />
				<StatCard label="Entities" value={stats.totalEntities} icon={FileCode2} color="hsl(178, 94%, 49%)" />
			</div>

			{/* Bento Grid — Apps (60%) + Workflows (40%) */}
			<div
				className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8 dash-animate-fade-up"
				style={{ animationDelay: "0.2s" }}
			>
				{/* Recent Apps — 3/5 width */}
				<div className="lg:col-span-3">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-medium text-white/50 flex items-center gap-1.5">
							<Sparkles className="h-3.5 w-3.5" />
							Recent Apps
						</h3>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => handleQuickCreate("app")}
								disabled={isCreating}
								className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50 transition-colors disabled:opacity-50"
							>
								<Plus className="h-3 w-3" />
								New
							</button>
							<Link
								href="/app-builder"
								className="text-[10px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-0.5"
							>
								View all <ArrowRight className="h-2.5 w-2.5" />
							</Link>
						</div>
					</div>

					{recentApps.length === 0 ? (
						<div className="glass-card p-8 text-center">
							<Sparkles className="h-8 w-8 mx-auto text-white/10 mb-3" />
							<p className="text-sm text-white/30 mb-3">
								No apps yet. Describe your first project above!
							</p>
						</div>
					) : (
						<div className="grid gap-3 sm:grid-cols-2">
							{recentApps.map((app, i) => (
								<div
									key={app.id}
									className="dash-animate-fade-up"
									style={{ animationDelay: `${0.25 + i * 0.05}s` }}
								>
									<AppCard app={app} />
								</div>
							))}
						</div>
					)}
				</div>

				{/* Recent Workflows — 2/5 width */}
				<div className="lg:col-span-2">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-medium text-white/50 flex items-center gap-1.5">
							<GitBranch className="h-3.5 w-3.5" />
							Recent Workflows
						</h3>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => handleQuickCreate("workflow")}
								disabled={isCreating}
								className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50 transition-colors disabled:opacity-50"
							>
								<Plus className="h-3 w-3" />
								New
							</button>
							<Link
								href="/workflows"
								className="text-[10px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-0.5"
							>
								View all <ArrowRight className="h-2.5 w-2.5" />
							</Link>
						</div>
					</div>

					{recentWorkflows.length === 0 ? (
						<div className="glass-card p-8 text-center">
							<Workflow className="h-8 w-8 mx-auto text-white/10 mb-3" />
							<p className="text-sm text-white/30">No workflows yet</p>
						</div>
					) : (
						<div className="glass-card p-2 space-y-0.5">
							{recentWorkflows.map((w, i) => (
								<div
									key={w.id}
									className="dash-animate-fade-up"
									style={{ animationDelay: `${0.25 + i * 0.05}s` }}
								>
									<WorkflowCard workflow={w} />
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Activity Feed + Quick Links */}
			<div
				className="grid grid-cols-1 lg:grid-cols-5 gap-6 dash-animate-fade-up"
				style={{ animationDelay: "0.3s" }}
			>
				{/* Activity — 3/5 width */}
				<div className="lg:col-span-3">
					<h3 className="text-sm font-medium text-white/50 mb-3 flex items-center gap-1.5">
						<Clock className="h-3.5 w-3.5" />
						Recent Activity
					</h3>
					{activity.length === 0 ? (
						<div className="glass-card p-6 text-center">
							<p className="text-xs text-white/20">
								Activity will appear as you build
							</p>
						</div>
					) : (
						<div className="glass-card p-4 space-y-1 max-h-[240px] overflow-y-auto">
							{activity.slice(0, 10).map((item, i) => (
								<ActivityRow key={`${item.type}-${item.timestamp}-${i}`} item={item} />
							))}
						</div>
					)}
				</div>

				{/* Quick Links — 2/5 width */}
				<div className="lg:col-span-2 space-y-3">
					<h3 className="text-sm font-medium text-white/50 mb-3">Quick Links</h3>
					<QuickLink
						href="/app-builder"
						icon={Code2}
						label="App Builder"
						description="AI-powered app creation"
					/>
					<QuickLink
						href="/workflows"
						icon={Workflow}
						label="Workflows"
						description="Visual automation editor"
					/>
					<QuickLink
						href="/settings/team"
						icon={Users}
						label="Team Settings"
						description="Manage members & billing"
					/>
				</div>
			</div>
		</div>
	);
}
