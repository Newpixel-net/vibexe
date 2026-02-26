"use client";

/**
 * DashboardClient — Main dashboard layout
 *
 * Hero prompt → Stats bar → Manage Apps → Workspace (tabbed recent + activity pulse + dock)
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
	Settings,
	Shield,
	Sparkles,
	Users,
	Wallet,
	Workflow,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
// UNIFIED WORK ITEM — renders both apps and workflows in the "All" stream
// ====================================================================

type WorkItem =
	| { kind: "app"; data: EnhancedApp }
	| { kind: "workflow"; data: RecentWorkflow };

function WorkItemRow({ item }: { item: WorkItem }) {
	const isApp = item.kind === "app";
	const name = isApp ? item.data.name : (item.data.name || "Untitled Workflow");
	const href = isApp ? `/app-builder/${item.data.id}` : `/workflows/${item.data.id}`;
	const updatedAt = item.data.updatedAt;

	const IconComp = isApp ? Layers : GitBranch;
	const iconColor = isApp ? "text-blue-400" : "text-violet-400";
	const iconBg = isApp ? "bg-blue-500/10" : "bg-violet-500/10";

	const deployBadge = isApp && (item.data as EnhancedApp).deployment?.status === "live" ? (
		<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
			<Globe className="h-2.5 w-2.5" />
			Live
		</span>
	) : null;

	return (
		<Link
			href={href}
			className="flex items-center gap-3.5 px-4 py-3 rounded-xl hover:bg-white/[0.04] transition-all group"
		>
			<div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
				<IconComp className={`h-4 w-4 ${iconColor}`} />
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<h4 className="text-[14px] text-white/75 truncate group-hover:text-white/90 transition-colors font-medium">
						{name}
					</h4>
					{deployBadge}
				</div>
				<div className="flex items-center gap-3 mt-0.5 text-[11px] text-white/25">
					<span className="capitalize">{item.kind}</span>
					{isApp && (item.data as EnhancedApp).entityCount > 0 && (
						<span className="flex items-center gap-0.5">
							<FileCode2 className="h-2.5 w-2.5" />
							{(item.data as EnhancedApp).entityCount} entities
						</span>
					)}
					{isApp && (item.data as EnhancedApp).hasAuth && (
						<span className="flex items-center gap-0.5">
							<Shield className="h-2.5 w-2.5" />
							Auth
						</span>
					)}
					<span className="flex items-center gap-0.5 ml-auto">
						<Clock className="h-2.5 w-2.5" />
						{timeAgo(updatedAt)}
					</span>
				</div>
			</div>
			<ArrowRight className="h-3.5 w-3.5 text-white/[0.06] group-hover:text-white/25 transition-colors flex-shrink-0" />
		</Link>
	);
}

// ====================================================================
// ACTIVITY PULSE — vertical timeline sidebar
// ====================================================================

const PULSE_COLORS: Record<string, string> = {
	app_created: "hsl(219, 90%, 60%)",
	app_deployed: "hsl(141, 100%, 61%)",
	workflow_created: "hsl(275, 96%, 60%)",
};

function ActivityPulse({ items }: { items: ActivityItem[] }) {
	if (items.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-[12px] text-white/15 py-10">
				Activity appears as you build
			</div>
		);
	}

	return (
		<div className="relative pl-5 space-y-0">
			{/* Timeline spine */}
			<div className="absolute left-[7px] top-3 bottom-3 w-px bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-transparent" />

			{items.slice(0, 12).map((item, i) => {
				const color = PULSE_COLORS[item.type] ?? PULSE_COLORS.app_created;
				return (
					<div key={`${item.type}-${item.timestamp}-${i}`} className="relative flex items-start gap-3 py-2">
						{/* Dot */}
						<div className="absolute left-[-15px] top-[11px]">
							<div
								className="h-[7px] w-[7px] rounded-full"
								style={{ background: color, boxShadow: `0 0 6px ${color}40` }}
							/>
						</div>
						{/* Content */}
						<div className="flex-1 min-w-0">
							<p className="text-[12px] text-white/50 truncate leading-tight">{item.title}</p>
							<p className="text-[10px] text-white/15 mt-0.5">{timeAgo(item.timestamp)}</p>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ====================================================================
// DOCK — compact horizontal action bar
// ====================================================================

const DOCK_ITEMS = [
	{ href: "/app-builder", icon: Code2, label: "App Builder" },
	{ href: "/workflows", icon: Workflow, label: "Workflows" },
	{ href: "/settings/team", icon: Settings, label: "Settings" },
	{ href: "https://docs.vibexe.ai/en/guides/introduction", icon: BookOpen, label: "Docs", external: true },
] as const;

function ActionDock() {
	return (
		<div className="flex items-center justify-center gap-1 py-3">
			{DOCK_ITEMS.map((item) => {
				const Icon = item.icon;
				const isExternal = "external" in item && item.external;
				return (
					<Link
						key={item.href}
						href={item.href}
						target={isExternal ? "_blank" : undefined}
						className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all group"
					>
						<Icon className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
						{item.label}
						{isExternal && <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
					</Link>
				);
			})}
		</div>
	);
}

// ====================================================================
// WORKSPACE SECTION — the unified bottom area
// ====================================================================

type WorkspaceTab = "all" | "apps" | "workflows";

function WorkspaceSection({
	recentApps,
	recentWorkflows,
	activity,
	isCreating,
	onQuickCreate,
}: {
	recentApps: EnhancedApp[];
	recentWorkflows: RecentWorkflow[];
	activity: ActivityItem[];
	isCreating: boolean;
	onQuickCreate: (type: "app" | "workflow") => void;
}) {
	const [activeTab, setActiveTab] = useState<WorkspaceTab>("all");

	// Merge apps + workflows chronologically for "All" view
	const allItems: WorkItem[] = useMemo(() => {
		const apps: WorkItem[] = recentApps.map((a) => ({ kind: "app" as const, data: a }));
		const workflows: WorkItem[] = recentWorkflows.map((w) => ({ kind: "workflow" as const, data: w }));
		return [...apps, ...workflows].sort(
			(a, b) => new Date(b.data.updatedAt).getTime() - new Date(a.data.updatedAt).getTime(),
		);
	}, [recentApps, recentWorkflows]);

	const displayItems: WorkItem[] = useMemo(() => {
		if (activeTab === "apps") return allItems.filter((i) => i.kind === "app");
		if (activeTab === "workflows") return allItems.filter((i) => i.kind === "workflow");
		return allItems;
	}, [activeTab, allItems]);

	const tabs: { id: WorkspaceTab; label: string; count: number }[] = [
		{ id: "all", label: "All", count: allItems.length },
		{ id: "apps", label: "Apps", count: recentApps.length },
		{ id: "workflows", label: "Workflows", count: recentWorkflows.length },
	];

	return (
		<div className="dash-animate-fade-up" style={{ animationDelay: "0.2s" }}>
			<div className="glass-card overflow-hidden">
				{/* Header bar */}
				<div className="flex items-center justify-between px-5 pt-4 pb-0">
					<div className="flex items-center gap-1">
						{/* Tabs */}
						{tabs.map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								className={`
									relative px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-200
									${
										activeTab === tab.id
											? "text-white/85 bg-white/[0.07]"
											: "text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
									}
								`}
							>
								{tab.label}
								<span
									className={`ml-1.5 text-[11px] tabular-nums ${
										activeTab === tab.id ? "text-white/40" : "text-white/15"
									}`}
								>
									{tab.count}
								</span>
							</button>
						))}
					</div>

					{/* Actions */}
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => onQuickCreate(activeTab === "workflows" ? "workflow" : "app")}
							disabled={isCreating}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-white/30 hover:text-white/55 hover:bg-white/[0.05] transition-all disabled:opacity-40"
						>
							{isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
							New
						</button>
						<Link
							href={activeTab === "workflows" ? "/workflows" : "/app-builder"}
							className="text-[11px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-1"
						>
							View all <ArrowRight className="h-3 w-3" />
						</Link>
					</div>
				</div>

				{/* Content: Work items + Activity Pulse sidebar */}
				<div className="flex min-h-[320px]">
					{/* Work items stream */}
					<div className="flex-1 min-w-0 p-3 border-r border-white/[0.04]">
						{displayItems.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full text-center py-12">
								<Sparkles className="h-8 w-8 text-white/[0.06] mb-3" />
								<p className="text-[14px] text-white/25">
									{activeTab === "workflows"
										? "No workflows yet"
										: activeTab === "apps"
											? "No apps yet — describe your first project above!"
											: "Start building to see your work here"}
								</p>
							</div>
						) : (
							<div className="space-y-0.5 max-h-[420px] overflow-y-auto workspace-scroll">
								{displayItems.map((item, i) => (
									<div
										key={`${item.kind}-${item.data.id}`}
										className="dash-animate-fade-up"
										style={{ animationDelay: `${0.22 + i * 0.03}s` }}
									>
										<WorkItemRow item={item} />
									</div>
								))}
							</div>
						)}
					</div>

					{/* Activity Pulse sidebar */}
					<div className="hidden lg:block w-[240px] flex-shrink-0 p-4 overflow-y-auto max-h-[420px] workspace-scroll">
						<h4 className="text-[11px] font-medium text-white/20 uppercase tracking-wider mb-3">Pulse</h4>
						<ActivityPulse items={activity} />
					</div>
				</div>

				{/* Dock bar */}
				<div className="border-t border-white/[0.04]">
					<ActionDock />
				</div>
			</div>
		</div>
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

			{/* Hero Prompt — only this section is Emergent-style */}
			<HeroPrompt recentApps={recentApps} />

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

			{/* ============================================================ */}
			{/* UNIFIED WORKSPACE — tabbed recent work + activity pulse      */}
			{/* ============================================================ */}
			<WorkspaceSection
				recentApps={recentApps}
				recentWorkflows={recentWorkflows}
				activity={activity}
				isCreating={isCreating}
				onQuickCreate={handleQuickCreate}
			/>
		</div>
	);
}
