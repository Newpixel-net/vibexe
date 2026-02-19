"use client";

/**
 * LogsPanel Component
 *
 * Application log viewer with filtering and search.
 * Shows build logs, API request logs, and error logs.
 */

import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Filter,
	Info,
	Loader2,
	RefreshCw,
	Search,
	Terminal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface LogEntry {
	id: string;
	timestamp: string;
	level: "info" | "warn" | "error" | "debug";
	message: string;
	source: string;
}

interface LogsPanelProps {
	appId: string;
}

const LEVEL_STYLES: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
	info: { icon: Info, color: "text-blue-500" },
	warn: { icon: AlertCircle, color: "text-yellow-500" },
	error: { icon: AlertCircle, color: "text-red-500" },
	debug: { icon: Terminal, color: "text-muted-foreground" },
};

export function LogsPanel({ appId }: LogsPanelProps) {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState<string>("all");
	const [search, setSearch] = useState("");

	const fetchLogs = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/apps/${appId}/logs`);
			if (res.ok) {
				const data = await res.json();
				setLogs(data.logs || []);
			}
		} catch {
			// API may not exist yet — that's fine
		}
		setLoading(false);
	}, [appId]);

	useEffect(() => {
		fetchLogs();
	}, [fetchLogs]);

	const filteredLogs = logs.filter((log) => {
		if (filter !== "all" && log.level !== filter) return false;
		if (search && !log.message.toLowerCase().includes(search.toLowerCase()))
			return false;
		return true;
	});

	return (
		<div className="flex-1 flex flex-col min-h-0">
			{/* Header */}
			<div className="flex-shrink-0 p-4 border-b border-border">
				<div className="flex items-center justify-between mb-3">
					<div>
						<h1 className="text-lg font-bold text-foreground">Logs</h1>
						<p className="text-xs text-muted-foreground">
							Application logs and debug output
						</p>
					</div>
					<button
						type="button"
						onClick={fetchLogs}
						className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
						title="Refresh logs"
					>
						<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
					</button>
				</div>

				{/* Filters */}
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
					<div className="flex gap-1">
						{["all", "info", "warn", "error"].map((level) => (
							<button
								type="button"
								key={level}
								onClick={() => setFilter(level)}
								className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
									filter === level
										? "bg-muted text-foreground"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								{level === "all" ? "All" : level.charAt(0).toUpperCase() + level.slice(1)}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Log entries */}
			<div className="flex-1 overflow-y-auto">
				{loading ? (
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
							const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
							const Icon = style.icon;
							return (
								<div
									key={log.id}
									className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
								>
									<Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${style.color}`} />
									<span className="text-muted-foreground flex-shrink-0 w-[140px]">
										{new Date(log.timestamp).toLocaleString()}
									</span>
									<span className="text-muted-foreground flex-shrink-0 w-[80px]">
										{log.source}
									</span>
									<span className="text-foreground break-all">{log.message}</span>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
