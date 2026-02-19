"use client";

/**
 * LogsPanel Component
 *
 * Application log viewer with filtering, search, export, and auto-refresh.
 * Shows build logs, API request logs, and error logs.
 */

import {
	AlertCircle,
	ChevronDown,
	ChevronRight,
	Clock,
	Download,
	Info,
	Loader2,
	Pause,
	Play,
	RefreshCw,
	Search,
	Terminal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface LogEntry {
	id: string;
	timestamp: string;
	level: "info" | "warn" | "error" | "debug";
	message: string;
	source: string;
	details?: string;
}

interface LogsPanelProps {
	appId: string;
}

const LEVEL_CONFIG: Record<
	string,
	{
		icon: React.ComponentType<{ className?: string }>;
		color: string;
		bg: string;
		label: string;
	}
> = {
	info: {
		icon: Info,
		color: "text-blue-500",
		bg: "bg-blue-500/10",
		label: "INFO",
	},
	warn: {
		icon: AlertCircle,
		color: "text-yellow-500",
		bg: "bg-yellow-500/10",
		label: "WARN",
	},
	error: {
		icon: AlertCircle,
		color: "text-red-500",
		bg: "bg-red-500/10",
		label: "ERROR",
	},
	debug: {
		icon: Terminal,
		color: "text-muted-foreground",
		bg: "bg-muted/50",
		label: "DEBUG",
	},
};

export function LogsPanel({ appId }: LogsPanelProps) {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState<string>("all");
	const [search, setSearch] = useState("");
	const [autoRefresh, setAutoRefresh] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [sourceFilter, setSourceFilter] = useState("all");
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchLogs = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/logs`);
			if (res.ok) {
				const data = await res.json();
				setLogs(data.logs || []);
			}
		} catch {
			// API may not exist yet
		}
		setLoading(false);
	}, [appId]);

	useEffect(() => {
		setLoading(true);
		fetchLogs();
	}, [fetchLogs]);

	// Auto-refresh
	useEffect(() => {
		if (autoRefresh) {
			intervalRef.current = setInterval(fetchLogs, 5000);
		} else if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [autoRefresh, fetchLogs]);

	// Unique sources
	const sources = useMemo(() => {
		const sourceSet = new Set(logs.map((l) => l.source));
		return Array.from(sourceSet).sort();
	}, [logs]);

	const filteredLogs = useMemo(() => {
		return logs.filter((log) => {
			if (filter !== "all" && log.level !== filter) return false;
			if (sourceFilter !== "all" && log.source !== sourceFilter) return false;
			if (search) {
				const q = search.toLowerCase();
				if (
					!log.message.toLowerCase().includes(q) &&
					!log.source.toLowerCase().includes(q)
				)
					return false;
			}
			return true;
		});
	}, [logs, filter, search, sourceFilter]);

	// Level counts for badges
	const levelCounts = useMemo(() => {
		const counts: Record<string, number> = { info: 0, warn: 0, error: 0, debug: 0 };
		for (const log of logs) {
			if (counts[log.level] !== undefined) counts[log.level]++;
		}
		return counts;
	}, [logs]);

	// Export
	const handleExport = (format: "json" | "csv") => {
		if (format === "json") {
			const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `app-logs-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
		} else {
			const header = "Timestamp,Level,Source,Message\n";
			const rows = filteredLogs
				.map(
					(l) =>
						`"${l.timestamp}","${l.level}","${l.source}","${l.message.replace(/"/g, '""')}"`,
				)
				.join("\n");
			const blob = new Blob([header + rows], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `app-logs-${new Date().toISOString().slice(0, 10)}.csv`;
			a.click();
			URL.revokeObjectURL(url);
		}
	};

	return (
		<div className="flex-1 flex flex-col min-h-0">
			{/* Header */}
			<div className="flex-shrink-0 p-4 border-b border-border space-y-3">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-lg font-bold text-foreground">Logs</h1>
						<p className="text-xs text-muted-foreground">
							{filteredLogs.length} log entries
							{logs.length !== filteredLogs.length &&
								` (${logs.length} total)`}
						</p>
					</div>
					<div className="flex items-center gap-2">
						{/* Auto-refresh toggle */}
						<button
							type="button"
							onClick={() => setAutoRefresh(!autoRefresh)}
							className={`p-2 rounded-md transition-colors flex items-center gap-1.5 text-xs ${
								autoRefresh
									? "bg-green-500/10 text-green-500"
									: "hover:bg-muted text-muted-foreground hover:text-foreground"
							}`}
							title={
								autoRefresh ? "Stop auto-refresh" : "Auto-refresh (5s)"
							}
						>
							{autoRefresh ? (
								<Pause className="h-3.5 w-3.5" />
							) : (
								<Play className="h-3.5 w-3.5" />
							)}
							{autoRefresh ? "Live" : "Auto"}
						</button>
						{/* Export */}
						<div className="relative group">
							<button
								type="button"
								className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-xs"
							>
								<Download className="h-3.5 w-3.5" />
								Export
							</button>
							<div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-10">
								<button
									type="button"
									onClick={() => handleExport("json")}
									className="block w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
								>
									Export JSON
								</button>
								<button
									type="button"
									onClick={() => handleExport("csv")}
									className="block w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
								>
									Export CSV
								</button>
							</div>
						</div>
						{/* Refresh */}
						<button
							type="button"
							onClick={() => {
								setLoading(true);
								fetchLogs();
							}}
							className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
							title="Refresh logs"
						>
							<RefreshCw
								className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
							/>
						</button>
					</div>
				</div>

				{/* Search + Filters */}
				<div className="flex items-center gap-3">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search logs..."
							className="w-full pl-9 pr-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>
					{sources.length > 1 && (
						<select
							value={sourceFilter}
							onChange={(e) => setSourceFilter(e.target.value)}
							className="px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="all">All Sources</option>
							{sources.map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
					)}
				</div>

				{/* Level filter pills */}
				<div className="flex gap-1.5">
					<button
						type="button"
						onClick={() => setFilter("all")}
						className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
							filter === "all"
								? "bg-foreground text-background"
								: "text-muted-foreground hover:text-foreground hover:bg-muted"
						}`}
					>
						All ({logs.length})
					</button>
					{(["error", "warn", "info", "debug"] as const).map((level) => {
						const config = LEVEL_CONFIG[level];
						return (
							<button
								type="button"
								key={level}
								onClick={() =>
									setFilter(filter === level ? "all" : level)
								}
								className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
									filter === level
										? `${config.bg} ${config.color}`
										: "text-muted-foreground hover:text-foreground hover:bg-muted"
								}`}
							>
								{config.label}
								{levelCounts[level] > 0 && (
									<span className="opacity-70">
										({levelCounts[level]})
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>

			{/* Log entries */}
			<div className="flex-1 overflow-y-auto">
				{loading && logs.length === 0 ? (
					<div className="flex items-center justify-center p-8">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : filteredLogs.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-12 text-center">
						<Terminal className="h-10 w-10 text-muted-foreground/30 mb-4" />
						<h3 className="text-sm font-medium text-foreground mb-1">
							{logs.length === 0 ? "No logs yet" : "No matching logs"}
						</h3>
						<p className="text-xs text-muted-foreground max-w-sm">
							{logs.length === 0
								? "Logs will appear here as your app receives traffic and processes requests."
								: "Try adjusting your search or filter criteria."}
						</p>
					</div>
				) : (
					<div className="divide-y divide-border font-mono text-xs">
						{filteredLogs.map((log) => {
							const config = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
							const Icon = config.icon;
							const isExpanded = expandedId === log.id;
							return (
								<div key={log.id}>
									<button
										type="button"
										onClick={() =>
											setExpandedId(isExpanded ? null : log.id)
										}
										className="w-full flex items-start gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors text-left"
									>
										{log.details ? (
											isExpanded ? (
												<ChevronDown className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
											) : (
												<ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
											)
										) : (
											<span className="w-3 flex-shrink-0" />
										)}
										<span
											className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${config.bg} ${config.color}`}
										>
											{config.label}
										</span>
										<span className="text-muted-foreground flex-shrink-0 w-[130px]">
											{new Date(log.timestamp).toLocaleString()}
										</span>
										<span className="text-muted-foreground flex-shrink-0 w-[70px] truncate">
											{log.source}
										</span>
										<span className="text-foreground break-all flex-1">
											{log.message}
										</span>
									</button>
									{isExpanded && log.details && (
										<div className="px-4 pb-3 ml-8">
											<pre className="text-[11px] text-muted-foreground bg-muted/30 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
												{log.details}
											</pre>
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Footer status bar */}
			{autoRefresh && (
				<div className="flex-shrink-0 px-4 py-1.5 border-t border-border bg-muted/20 flex items-center gap-2">
					<span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
					<span className="text-[10px] text-muted-foreground">
						Auto-refreshing every 5 seconds
					</span>
				</div>
			)}
		</div>
	);
}
