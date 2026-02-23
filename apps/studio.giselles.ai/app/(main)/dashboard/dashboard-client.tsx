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
	Coins,
	Code2,
	FileCode2,
	GitBranch,
	Globe,
	HardDrive,
	Layers,
	Loader2,
	Plus,
	Rocket,
	Shield,
	Sparkles,
	Users,
	Wallet,
	Workflow,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData, ActivityItem, EnhancedApp, RecentWorkflow } from "@/lib/dashboard/get-dashboard-data";
import { HeroPrompt } from "./hero-prompt";
import { ManageAppsCarousel } from "./manage-apps-carousel";

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
// FORMAT HELPERS
// ====================================================================

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`;
}

// ====================================================================
// STAT CARD
// ====================================================================

interface StatCardProps {
	label: string;
	value: number;
	icon: React.ElementType;
	color: string;
	onQuickAdd?: () => void;
	quickAddLabel?: string;
	suffix?: string;
	progress?: number;
	displayValue?: string;
	comingSoon?: boolean;
}

function StatCard({
	label,
	value,
	icon: Icon,
	color,
	onQuickAdd,
	quickAddLabel,
	suffix,
	progress,
	displayValue,
	comingSoon,
}: StatCardProps) {
	const { value: animated, ref } = useCountUp(comingSoon ? 0 : value);
	return (
		<div className="glass-card p-5 flex items-center gap-3.5 group hover:bg-white/[0.06] transition-colors relative">
			<div
				className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
				style={{ background: `${color}15` }}
			>
				<Icon className="h-5 w-5" style={{ color }} />
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					<span ref={ref} className="text-xl font-semibold text-white/90 tabular-nums">
						{displayValue ?? animated}
					</span>
					{suffix && <span className="text-xs text-white/30">{suffix}</span>}
					{comingSoon && <span className="coming-soon-badge">Coming Soon</span>}
				</div>
				<p className="text-xs text-white/30 leading-tight">{label}</p>
				{progress !== undefined && (
					<div className="mt-1.5 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
						<div
							className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
							style={{ width: `${Math.min(progress, 100)}%` }}
						/>
					</div>
				)}
			</div>
			{onQuickAdd && (
				<button
					type="button"
					onClick={onQuickAdd}
					className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] text-white/30 hover:text-white/50 hover:bg-white/[0.06] transition-colors opacity-0 group-hover:opacity-100"
				>
					<Plus className="h-3 w-3" />
					{quickAddLabel || "New"}
				</button>
			)}
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
			className="glass-card p-5 group hover:bg-white/[0.06] hover:border-white/[0.12] transition-all block"
		>
			<div className="flex items-start justify-between mb-2.5">
				<div className="flex items-center gap-2.5 min-w-0">
					<div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
						<Layers className="h-4.5 w-4.5 text-blue-400" />
					</div>
					<h3 className="text-[15px] font-medium text-white/80 truncate group-hover:text-white/90 transition-colors">
						{app.name}
					</h3>
				</div>
				{deployBadge}
			</div>

			{app.description && (
				<p className="text-xs text-white/30 line-clamp-2 mb-3 ml-[46px]">
					{app.description}
				</p>
			)}

			<div className="flex items-center gap-3 ml-[46px] text-[11px] text-white/20">
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
			className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-white/[0.04] transition-colors group"
		>
			<div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
				<GitBranch className="h-4.5 w-4.5 text-violet-400" />
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
		<div className="flex items-start gap-3 py-2.5">
			<div className="relative mt-0.5">
				<div
					className="h-7 w-7 rounded-full flex items-center justify-center"
					style={{ background: `${config.color}15` }}
				>
					<Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
				</div>
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-[13px] text-white/60 truncate">{item.title}</p>
				<p className="text-[11px] text-white/20">{timeAgo(item.timestamp)}</p>
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
			className="glass-card p-5 group hover:bg-white/[0.06] hover:border-white/[0.12] transition-all block"
		>
			<div className="flex items-center gap-3">
				<div className="h-9 w-9 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
					<Icon className="h-4.5 w-4.5 text-white/40 group-hover:text-white/60 transition-colors" />
				</div>
				<div className="flex-1 min-w-0">
					<span className="text-[15px] text-white/70 group-hover:text-white/85 transition-colors font-medium">
						{label}
					</span>
					<p className="text-[11px] text-white/25">{description}</p>
				</div>
				<ArrowUpRight className="h-4 w-4 text-white/10 group-hover:text-white/30 transition-colors" />
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

	const { stats, recentApps, recentWorkflows, activity, user, allApps, storageStats } = data;

	const storageProgressPct =
		storageStats.totalQuotaMb > 0
			? (storageStats.totalUsedBytes / (storageStats.totalQuotaMb * 1024 * 1024)) * 100
			: 0;

	return (
		<div className="max-w-7xl mx-auto px-6 py-8">
			{/* Greeting */}
			<div className="mb-3 dash-animate-fade-up">
				<h2 className="text-xl font-semibold text-white/80">
					Welcome back{user.displayName !== "User" ? `, ${user.displayName}` : ""}
				</h2>
			</div>

			{/* Hero Prompt */}
			<HeroPrompt />

			{/* Stats Row 1 */}
			<div
				className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 dash-animate-fade-up"
				style={{ animationDelay: "0.15s" }}
			>
				<StatCard
					label="Apps"
					value={stats.totalApps}
					icon={Layers}
					color="hsl(219, 90%, 60%)"
					onQuickAdd={() => handleQuickCreate("app")}
					quickAddLabel="New"
				/>
				<StatCard
					label="Apps Storage"
					value={0}
					displayValue={formatBytes(storageStats.totalUsedBytes)}
					suffix={storageStats.totalQuotaMb > 0 ? `/ ${storageStats.totalQuotaMb} MB` : ""}
					icon={HardDrive}
					color="hsl(192, 73%, 84%)"
					progress={storageProgressPct}
				/>
				<StatCard label="Live Deploys" value={stats.liveDeployments} icon={Rocket} color="hsl(141, 100%, 61%)" />
				<StatCard label="Entities" value={stats.totalEntities} icon={FileCode2} color="hsl(178, 94%, 49%)" />
			</div>

			{/* Stats Row 2 */}
			<div
				className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10 dash-animate-fade-up"
				style={{ animationDelay: "0.18s" }}
			>
				<StatCard
					label="Workflows"
					value={stats.totalWorkflows}
					icon={Workflow}
					color="hsl(275, 96%, 60%)"
					onQuickAdd={() => handleQuickCreate("workflow")}
					quickAddLabel="New"
				/>
				<StatCard
					label="AI Tokens"
					value={0}
					icon={Coins}
					color="hsl(45, 93%, 58%)"
					comingSoon
				/>
				<StatCard
					label="Wallet"
					value={0}
					displayValue="$0.00"
					icon={Wallet}
					color="hsl(160, 84%, 39%)"
					comingSoon
				/>
			</div>

			{/* Manage Your Apps Carousel */}
			<ManageAppsCarousel apps={allApps} />

			{/* Bento Grid — Apps (60%) + Workflows (40%) */}
			<div
				className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10 dash-animate-fade-up"
				style={{ animationDelay: "0.2s" }}
			>
				{/* Recent Apps — 3/5 width */}
				<div className="lg:col-span-3">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-[15px] font-medium text-white/50 flex items-center gap-2">
							<Sparkles className="h-4 w-4" />
							Recent Apps
						</h3>
						<div className="flex items-center gap-2.5">
							<button
								type="button"
								onClick={() => handleQuickCreate("app")}
								disabled={isCreating}
								className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/50 transition-colors disabled:opacity-50"
							>
								<Plus className="h-3 w-3" />
								New
							</button>
							<Link
								href="/app-builder"
								className="text-[11px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-0.5"
							>
								View all <ArrowRight className="h-3 w-3" />
							</Link>
						</div>
					</div>

					{recentApps.length === 0 ? (
						<div className="glass-card p-10 text-center">
							<Sparkles className="h-9 w-9 mx-auto text-white/10 mb-3" />
							<p className="text-[15px] text-white/30 mb-3">
								No apps yet. Describe your first project above!
							</p>
						</div>
					) : (
						<div className="grid gap-4 sm:grid-cols-2">
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
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-[15px] font-medium text-white/50 flex items-center gap-2">
							<GitBranch className="h-4 w-4" />
							Recent Workflows
						</h3>
						<div className="flex items-center gap-2.5">
							<button
								type="button"
								onClick={() => handleQuickCreate("workflow")}
								disabled={isCreating}
								className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/50 transition-colors disabled:opacity-50"
							>
								<Plus className="h-3 w-3" />
								New
							</button>
							<Link
								href="/workflows"
								className="text-[11px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-0.5"
							>
								View all <ArrowRight className="h-3 w-3" />
							</Link>
						</div>
					</div>

					{recentWorkflows.length === 0 ? (
						<div className="glass-card p-10 text-center">
							<Workflow className="h-9 w-9 mx-auto text-white/10 mb-3" />
							<p className="text-[15px] text-white/30">No workflows yet</p>
						</div>
					) : (
						<div className="glass-card p-2.5 space-y-0.5">
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
					<h3 className="text-[15px] font-medium text-white/50 mb-4 flex items-center gap-2">
						<Clock className="h-4 w-4" />
						Recent Activity
					</h3>
					{activity.length === 0 ? (
						<div className="glass-card p-8 text-center">
							<p className="text-xs text-white/20">
								Activity will appear as you build
							</p>
						</div>
					) : (
						<div className="glass-card p-5 space-y-1 max-h-[280px] overflow-y-auto">
							{activity.slice(0, 10).map((item, i) => (
								<ActivityRow key={`${item.type}-${item.timestamp}-${i}`} item={item} />
							))}
						</div>
					)}
				</div>

				{/* Quick Links — 2/5 width */}
				<div className="lg:col-span-2 space-y-3.5">
					<h3 className="text-[15px] font-medium text-white/50 mb-4">Quick Links</h3>
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
