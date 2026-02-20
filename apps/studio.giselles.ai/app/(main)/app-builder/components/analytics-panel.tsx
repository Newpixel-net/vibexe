"use client";

/**
 * AnalyticsPanel Component
 *
 * Visitor analytics dashboard for deployed apps.
 * Shows live visitors, total visitors, page views, top pages, and traffic charts.
 * Fetches data from GET /api/apps/{appId}/analytics.
 * Auto-refreshes live visitor count every 10 seconds.
 */

import {
	Activity,
	BarChart3,
	ChevronDown,
	ChevronRight,
	Clock,
	Code2,
	Eye,
	FileCode2,
	Globe,
	Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";

interface AnalyticsPanelProps {
	appId: string;
	files: AppFile[];
}

type Period = "24h" | "7d" | "30d";

interface AnalyticsData {
	liveVisitors: number;
	totalVisitors: number;
	totalPageViews: number;
	topPages: Array<{ path: string; views: number }>;
	visitsByHour: Array<{ hour: string; count: number }>;
	visitsByDay: Array<{ day: string; count: number }>;
}

function MetricCard({
	icon: Icon,
	label,
	value,
	sublabel,
	live,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string | number;
	sublabel?: string;
	live?: boolean;
}) {
	return (
		<div className="p-4">
			<div className="flex items-center justify-between mb-3">
				<Icon className="h-4 w-4 text-white/20" />
				{live && (
					<span className="flex items-center gap-1.5">
						<span className="relative flex h-2 w-2">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
							<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
						</span>
						<span className="text-[10px] text-green-400 font-medium">LIVE</span>
					</span>
				)}
			</div>
			<div className="text-3xl font-light tracking-tight text-white/90">{value}</div>
			<div className="text-[11px] text-white/30 uppercase tracking-wider mt-1">{label}</div>
			{sublabel && (
				<div className="text-[10px] text-white/20 mt-0.5">
					{sublabel}
				</div>
			)}
		</div>
	);
}

function TimeBarChart({
	data,
	label,
}: {
	data: Array<{ label: string; value: number }>;
	label: string;
}) {
	const maxValue = Math.max(...data.map((d) => d.value), 1);

	if (data.length === 0) {
		return (
			<div className="text-center py-8">
				<BarChart3 className="h-8 w-8 text-white/40/20 mx-auto mb-2" />
				<p className="text-xs text-white/40">No data yet</p>
			</div>
		);
	}

	return (
		<div className="space-y-1">
			<div className="flex items-end gap-[2px] h-28">
				{data.map((item, i) => (
					<div
						key={`${item.label}-${i}`}
						className="flex-1 flex flex-col items-center justify-end h-full"
						title={`${item.label}: ${item.value} views`}
					>
						<div
							className="w-full rounded-t bg-violet-500/40 hover:bg-violet-500/60 transition-colors min-h-[2px]"
							style={{
								height: `${Math.max(2, (item.value / maxValue) * 100)}%`,
							}}
						/>
					</div>
				))}
			</div>
			<div className="flex justify-between text-[9px] text-white/40 px-0.5">
				{data.length > 2 && (
					<>
						<span>{data[0].label}</span>
						<span>{data[data.length - 1].label}</span>
					</>
				)}
			</div>
		</div>
	);
}

export function AnalyticsPanel({ appId, files }: AnalyticsPanelProps) {
	const [period, setPeriod] = useState<Period>("24h");
	const [data, setData] = useState<AnalyticsData | null>(null);
	const [loading, setLoading] = useState(true);
	const [liveCount, setLiveCount] = useState(0);
	const [codeStatsOpen, setCodeStatsOpen] = useState(false);

	const fetchAnalytics = useCallback(
		async (showLoading = false) => {
			if (showLoading) setLoading(true);
			try {
				const res = await fetch(
					`/api/apps/${appId}/analytics?period=${period}`,
				);
				if (res.ok) {
					const json = await res.json();
					setData(json);
					setLiveCount(json.liveVisitors || 0);
				}
			} catch {
				// Network error, keep existing data
			}
			if (showLoading) setLoading(false);
		},
		[appId, period],
	);

	// Initial fetch + period change
	useEffect(() => {
		fetchAnalytics(true);
	}, [fetchAnalytics]);

	// Auto-refresh live visitors every 10 seconds
	useEffect(() => {
		const interval = setInterval(async () => {
			try {
				const res = await fetch(
					`/api/apps/${appId}/analytics?period=${period}`,
				);
				if (res.ok) {
					const json = await res.json();
					setLiveCount(json.liveVisitors || 0);
				}
			} catch {
				// Silently fail
			}
		}, 10_000);
		return () => clearInterval(interval);
	}, [appId, period]);

	// Format chart data
	const hourlyData = useMemo(() => {
		if (!data?.visitsByHour) return [];
		return data.visitsByHour.map((v) => {
			const d = new Date(v.hour);
			return {
				label: `${d.getHours().toString().padStart(2, "0")}:00`,
				value: v.count,
			};
		});
	}, [data]);

	const dailyData = useMemo(() => {
		if (!data?.visitsByDay) return [];
		return data.visitsByDay.map((v) => {
			const d = new Date(v.day);
			return {
				label: `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`,
				value: v.count,
			};
		});
	}, [data]);

	// Code stats (secondary, collapsible)
	const codeStats = useMemo(() => {
		const sourceFiles = files.filter((f) => f.path !== "Blueprint.md");
		const totalLines = sourceFiles.reduce(
			(sum, f) => sum + (f.content?.split("\n").length || 0),
			0,
		);
		return {
			fileCount: sourceFiles.length,
			totalLines,
		};
	}, [files]);

	const hasData =
		data &&
		(data.totalVisitors > 0 ||
			data.totalPageViews > 0 ||
			data.liveVisitors > 0);

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-5xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-white/90">Analytics</h1>
						<p className="text-sm text-white/40 mt-1">
							Visitor traffic and engagement metrics
						</p>
					</div>

					{/* Period selector */}
					<div className="flex bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-xl p-1 gap-1">
						{(["24h", "7d", "30d"] as Period[]).map((p) => (
							<button
								key={p}
								type="button"
								onClick={() => setPeriod(p)}
								className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
									period === p
										? "bg-white/[0.08] text-white/90 border border-white/[0.08]"
										: "text-white/40 hover:text-white/70"
								}`}
							>
								{p === "24h"
									? "Last 24h"
									: p === "7d"
										? "7 Days"
										: "30 Days"}
							</button>
						))}
					</div>
				</div>

				{loading && !data ? (
					<div className="flex items-center justify-center py-20">
						<div className="animate-spin rounded-full h-6 w-6 border-2 border-muted-foreground border-t-transparent" />
					</div>
				) : !hasData ? (
					/* Empty state */
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<div className="rounded-full bg-white/[0.06] border border-white/[0.08] p-4 mb-4">
							<Globe className="h-10 w-10 text-white/40/40" />
						</div>
						<h2 className="text-lg font-semibold text-white/90 mb-2">
							No visitor data yet
						</h2>
						<p className="text-sm text-white/40 max-w-sm">
							Publish your app to start collecting visitor analytics.
							Traffic data will appear here once users visit your app.
						</p>
					</div>
				) : (
					<>
						{/* Top metric cards */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<MetricCard
								icon={Activity}
								label="Live Visitors"
								value={liveCount}
								sublabel="Active in last 5 min"
								live
							/>
							<MetricCard
								icon={Users}
								label="Total Visitors"
								value={
									data?.totalVisitors?.toLocaleString() || "0"
								}
								sublabel={`In ${period === "24h" ? "last 24 hours" : period === "7d" ? "last 7 days" : "last 30 days"}`}
							/>
							<MetricCard
								icon={Eye}
								label="Total Page Views"
								value={
									data?.totalPageViews?.toLocaleString() || "0"
								}
							/>
							<MetricCard
								icon={Clock}
								label="Avg Session Duration"
								value={"\u2014"}
								sublabel="Coming soon"
							/>
						</div>

						{/* Traffic charts */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
								<h3 className="text-sm font-medium text-white/80 mb-4">
									Visits by Hour (24h)
								</h3>
								<TimeBarChart
									data={hourlyData}
									label="Hourly"
								/>
							</div>
							<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
								<h3 className="text-sm font-medium text-white/80 mb-4">
									Visits by Day (30d)
								</h3>
								<TimeBarChart
									data={dailyData}
									label="Daily"
								/>
							</div>
						</div>

						{/* Top Pages table */}
						{data?.topPages && data.topPages.length > 0 && (
							<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden">
								<div className="p-4 border-b border-white/[0.06]">
									<h3 className="text-sm font-medium text-white/80">
										Top Pages
									</h3>
								</div>
								<table className="w-full text-sm">
									<thead>
										<tr className="bg-white/[0.03]">
											<th className="px-4 py-2.5 text-left text-xs font-medium text-white/40">
												Page Path
											</th>
											<th className="px-4 py-2.5 text-right text-xs font-medium text-white/40">
												Views
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-white/[0.06]">
										{data.topPages.map((page) => (
											<tr
												key={page.path}
												className="hover:bg-white/[0.04]"
											>
												<td className="px-4 py-2.5 text-white/90 font-mono text-xs">
													{page.path}
												</td>
												<td className="px-4 py-2.5 text-right text-white/90">
													{page.views.toLocaleString()}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</>
				)}

				{/* Collapsible Code Stats section */}
				<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm">
					<button
						type="button"
						onClick={() => setCodeStatsOpen(!codeStatsOpen)}
						className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.04] transition-colors"
					>
						{codeStatsOpen ? (
							<ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" />
						) : (
							<ChevronRight className="h-4 w-4 text-white/40 flex-shrink-0" />
						)}
						<Code2 className="h-4 w-4 text-white/40 flex-shrink-0" />
						<span className="text-sm font-medium text-white/80">
							Code Stats
						</span>
						<span className="text-xs text-white/40 ml-auto">
							{codeStats.fileCount} files,{" "}
							{codeStats.totalLines.toLocaleString()} lines
						</span>
					</button>
					{codeStatsOpen && (
						<div className="px-4 pb-4 pt-0 border-t border-white/[0.06]">
							<div className="grid grid-cols-2 gap-4 mt-4">
								<div className="flex items-center gap-3">
									<FileCode2 className="h-4 w-4 text-white/40" />
									<div>
										<div className="text-lg font-bold text-white/90">
											{codeStats.fileCount}
										</div>
										<div className="text-xs text-white/40">
											Source Files
										</div>
									</div>
								</div>
								<div className="flex items-center gap-3">
									<BarChart3 className="h-4 w-4 text-white/40" />
									<div>
										<div className="text-lg font-bold text-white/90">
											{codeStats.totalLines.toLocaleString()}
										</div>
										<div className="text-xs text-white/40">
											Lines of Code
										</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
