"use client";

/**
 * Debug Overlay — Runtime Diagnostic HUD (v3)
 *
 * Floating button in game mode preview that queries iframe systems
 * and displays a modern diagnostic panel showing health of all subsystems
 * PLUS detected problems with actionable descriptions.
 * v3: Expanded system checks, console log viewer, deeper transparency.
 */

import { Activity, AlertTriangle, ChevronDown, ChevronUp, FileText, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SystemReport {
	system: string;
	status: "ok" | "inactive" | "missing" | "off" | "muted" | "none" | string;
	details?: Record<string, unknown> | null;
}

interface Problem {
	id: string;
	severity: "error" | "warn";
	msg: string;
}

interface LogEntry {
	t: number;
	l: "log" | "warn" | "err";
	m: string;
}

interface DebugOverlayProps {
	iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

const STATUS_COLORS: Record<string, string> = {
	ok: "bg-emerald-500/80",
	inactive: "bg-amber-500/80",
	missing: "bg-red-500/80",
	off: "bg-zinc-600/60",
	muted: "bg-amber-500/80",
	none: "bg-zinc-600/60",
};

const STATUS_LABELS: Record<string, string> = {
	ok: "OK",
	inactive: "WARN",
	missing: "MISSING",
	off: "OFF",
	muted: "MUTED",
	none: "NONE",
};

const LOG_COLORS: Record<string, string> = {
	log: "#a1a1aa",
	warn: "#fbbf24",
	err: "#f87171",
};

function formatTime(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleTimeString("en-US", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

export function DebugOverlay({ iframeRef }: DebugOverlayProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [showLogs, setShowLogs] = useState(false);
	const [systems, setSystems] = useState<SystemReport[]>([]);
	const [problems, setProblems] = useState<Problem[]>([]);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [lastUpdate, setLastUpdate] = useState<number>(0);
	const [logFilter, setLogFilter] = useState<string>("all");
	const queryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const logEndRef = useRef<HTMLDivElement | null>(null);

	const queryHealth = useCallback(() => {
		const iframe = iframeRef.current;
		if (!iframe?.contentWindow) return;
		iframe.contentWindow.postMessage({ type: "vibexe-debug-query-systems" }, "*");
	}, [iframeRef]);

	const queryLogs = useCallback(() => {
		const iframe = iframeRef.current;
		if (!iframe?.contentWindow) return;
		iframe.contentWindow.postMessage({ type: "vibexe-debug-query-logs" }, "*");
	}, [iframeRef]);

	useEffect(() => {
		const handler = (ev: MessageEvent) => {
			if (ev.data?.type === "vibexe-debug-system-report-all") {
				setSystems(ev.data.systems || []);
				setProblems(ev.data.problems || []);
				setLastUpdate(Date.now());
			}
			if (ev.data?.type === "vibexe-debug-log-report") {
				setLogs(ev.data.logs || []);
			}
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, []);

	// Auto-refresh every 2s when panel is open
	useEffect(() => {
		if (isOpen) {
			queryHealth();
			if (showLogs) queryLogs();
			queryIntervalRef.current = setInterval(() => {
				queryHealth();
				if (showLogs) queryLogs();
			}, 2000);
		} else {
			if (queryIntervalRef.current) {
				clearInterval(queryIntervalRef.current);
				queryIntervalRef.current = null;
			}
		}
		return () => {
			if (queryIntervalRef.current) clearInterval(queryIntervalRef.current);
		};
	}, [isOpen, showLogs, queryHealth, queryLogs]);

	// Auto-scroll logs
	useEffect(() => {
		if (showLogs && logEndRef.current) {
			logEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [logs, showLogs]);

	const toggleExpand = (sys: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(sys)) next.delete(sys);
			else next.add(sys);
			return next;
		});
	};

	const okCount = systems.filter((s) => s.status === "ok").length;
	const warnCount = systems.filter((s) => ["inactive", "missing", "muted"].includes(s.status)).length;
	const errorProblems = problems.filter((p) => p.severity === "error");
	const warnProblems = problems.filter((p) => p.severity === "warn");

	const filteredLogs = logFilter === "all"
		? logs
		: logFilter === "errors"
			? logs.filter((l) => l.l === "err")
			: logFilter === "warnings"
				? logs.filter((l) => l.l === "warn" || l.l === "err")
				: logs.filter((l) => l.m.toLowerCase().includes(logFilter.toLowerCase()));

	if (!isOpen) {
		const hasErrors = errorProblems.length > 0;
		const hasWarns = warnProblems.length > 0 || warnCount > 0;
		return (
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				className="absolute bottom-3 left-3 z-[100] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all duration-200 backdrop-blur-md border"
				style={{
					background: hasErrors
						? "rgba(239, 68, 68, 0.15)"
						: hasWarns
							? "rgba(245, 158, 11, 0.15)"
							: "rgba(16, 185, 129, 0.1)",
					borderColor: hasErrors
						? "rgba(239, 68, 68, 0.3)"
						: hasWarns
							? "rgba(245, 158, 11, 0.3)"
							: "rgba(16, 185, 129, 0.2)",
					color: hasErrors ? "#f87171" : hasWarns ? "#fbbf24" : "#6ee7b7",
				}}
				title="Open system diagnostics"
			>
				{hasErrors ? (
					<AlertTriangle className="w-3.5 h-3.5" />
				) : (
					<Activity className="w-3.5 h-3.5" />
				)}
				<span className="hidden sm:inline">Debug</span>
				{systems.length > 0 && (
					<span className="ml-1 tabular-nums">
						{okCount}/{systems.length}
					</span>
				)}
				{problems.length > 0 && (
					<span
						className="ml-1 px-1 py-0.5 rounded text-[8px] font-bold"
						style={{
							background: hasErrors ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
							color: hasErrors ? "#f87171" : "#fbbf24",
						}}
					>
						{problems.length}
					</span>
				)}
			</button>
		);
	}

	// Logs panel
	if (showLogs) {
		return (
			<div
				className="absolute bottom-3 left-3 z-[100] w-[420px] rounded-xl border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
				style={{ background: "rgba(10, 10, 14, 0.95)", maxHeight: "70vh" }}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
					<div className="flex items-center gap-2">
						<FileText className="w-3.5 h-3.5 text-blue-400" />
						<span className="text-[11px] font-semibold text-white/80">Runtime Logs</span>
						<span className="text-[9px] text-white/30">{filteredLogs.length} entries</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => { queryLogs(); }}
							className="text-white/30 hover:text-white/60 transition-colors"
							title="Refresh logs"
						>
							<RefreshCw className="w-3 h-3" />
						</button>
						<button
							type="button"
							onClick={() => setShowLogs(false)}
							className="text-[9px] text-blue-400/60 hover:text-blue-400 transition-colors"
						>
							Systems
						</button>
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="text-white/30 hover:text-white/60 transition-colors"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>

				{/* Filter bar */}
				<div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/[0.04] overflow-x-auto">
					{["all", "errors", "warnings", "Terrain", "Character", "SkyWeather", "Physics", "Rapier"].map((f) => (
						<button
							key={f}
							type="button"
							onClick={() => setLogFilter(f)}
							className="px-2 py-0.5 rounded text-[8px] font-medium whitespace-nowrap transition-colors"
							style={{
								background: logFilter === f ? "rgba(96, 165, 250, 0.15)" : "transparent",
								color: logFilter === f ? "#93c5fd" : "rgba(255,255,255,0.3)",
								border: logFilter === f ? "1px solid rgba(96, 165, 250, 0.2)" : "1px solid transparent",
							}}
						>
							{f === "all" ? "All" : f === "errors" ? "Errors" : f === "warnings" ? "Warn+" : f}
						</button>
					))}
				</div>

				{/* Log entries */}
				<div className="overflow-y-auto font-mono" style={{ maxHeight: "50vh" }}>
					{filteredLogs.length === 0 ? (
						<div className="px-3 py-6 text-[10px] text-white/20 text-center">
							{logs.length === 0 ? "No logs captured yet" : "No logs match filter"}
						</div>
					) : (
						filteredLogs.map((entry, idx) => (
							<div
								key={`${entry.t}-${idx}`}
								className="flex gap-2 px-3 py-0.5 hover:bg-white/[0.02] border-b border-white/[0.02]"
								style={{ background: entry.l === "err" ? "rgba(239, 68, 68, 0.04)" : entry.l === "warn" ? "rgba(245, 158, 11, 0.02)" : "transparent" }}
							>
								<span className="text-[8px] text-white/15 flex-shrink-0 tabular-nums pt-0.5" style={{ minWidth: "70px" }}>
									{formatTime(entry.t)}
								</span>
								<span
									className="text-[8px] font-bold flex-shrink-0 pt-0.5"
									style={{ color: LOG_COLORS[entry.l] || "#71717a", minWidth: "24px" }}
								>
									{entry.l === "err" ? "ERR" : entry.l === "warn" ? "WRN" : "LOG"}
								</span>
								<span
									className="text-[9px] leading-tight break-all"
									style={{ color: LOG_COLORS[entry.l] || "#a1a1aa" }}
								>
									{entry.m}
								</span>
							</div>
						))
					)}
					<div ref={logEndRef} />
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between px-3 py-1.5 border-t border-white/[0.06]">
					<span className="text-[8px] text-white/15">Auto-refreshes every 2s</span>
					<span className="text-[8px] text-white/15 font-mono">vibexe diagnostics v3</span>
				</div>
			</div>
		);
	}

	return (
		<div
			className="absolute bottom-3 left-3 z-[100] w-80 rounded-xl border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
			style={{ background: "rgba(10, 10, 14, 0.92)", maxHeight: "80vh" }}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
				<div className="flex items-center gap-2">
					<Activity className="w-3.5 h-3.5 text-emerald-400" />
					<span className="text-[11px] font-semibold text-white/80">System Diagnostics</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-[9px] text-white/30 tabular-nums">
						{lastUpdate > 0 ? `${Math.round((Date.now() - lastUpdate) / 1000)}s ago` : "..."}
					</span>
					<button
						type="button"
						onClick={() => setIsOpen(false)}
						className="text-white/30 hover:text-white/60 transition-colors"
					>
						<X className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>

			{/* Summary bar */}
			<div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/[0.04] text-[9px]">
				<span className="text-emerald-400 font-medium">{okCount} OK</span>
				{warnCount > 0 && <span className="text-amber-400 font-medium">{warnCount} WARN</span>}
				<span className="text-white/20">{systems.length} systems</span>
				{problems.length > 0 && (
					<span
						className="ml-auto font-medium"
						style={{ color: errorProblems.length > 0 ? "#f87171" : "#fbbf24" }}
					>
						{problems.length} problem{problems.length !== 1 ? "s" : ""}
					</span>
				)}
			</div>

			{/* Problems section */}
			{problems.length > 0 && (
				<div className="border-b border-white/[0.06]">
					<div className="px-3 py-1 text-[8px] font-semibold uppercase tracking-wider text-white/25">
						Detected Problems ({problems.length})
					</div>
					{problems.map((p) => (
						<div
							key={p.id}
							className="flex items-start gap-2 px-3 py-1.5"
							style={{
								background:
									p.severity === "error"
										? "rgba(239, 68, 68, 0.06)"
										: "rgba(245, 158, 11, 0.04)",
							}}
						>
							<div
								className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
								style={{
									background:
										p.severity === "error"
											? "rgba(239, 68, 68, 0.8)"
											: "rgba(245, 158, 11, 0.8)",
								}}
							/>
							<span
								className="text-[9px] leading-tight"
								style={{
									color:
										p.severity === "error"
											? "rgba(248, 113, 113, 0.9)"
											: "rgba(251, 191, 36, 0.8)",
								}}
							>
								{p.msg}
							</span>
						</div>
					))}
				</div>
			)}

			{/* Systems list */}
			<div className="overflow-y-auto scrollbar-thin" style={{ maxHeight: "45vh" }}>
				{systems.length === 0 ? (
					<div className="px-3 py-4 text-[10px] text-white/30 text-center">
						Querying systems...
					</div>
				) : (
					systems.map((s) => (
						<div key={s.system} className="border-b border-white/[0.03] last:border-b-0">
							<button
								type="button"
								onClick={() => s.details && toggleExpand(s.system)}
								className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.03] transition-colors text-left"
							>
								<div
									className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[s.status] || "bg-zinc-500/60"}`}
								/>
								<span className="text-[10px] text-white/70 flex-1 truncate">{s.system}</span>
								<span
									className="text-[8px] font-mono px-1.5 py-0.5 rounded"
									style={{
										color:
											s.status === "ok"
												? "#6ee7b7"
												: ["inactive", "missing", "muted"].includes(s.status)
													? "#fbbf24"
													: "#71717a",
										background:
											s.status === "ok"
												? "rgba(16, 185, 129, 0.1)"
												: ["inactive", "missing", "muted"].includes(s.status)
													? "rgba(245, 158, 11, 0.1)"
													: "rgba(113, 113, 122, 0.1)",
									}}
								>
									{STATUS_LABELS[s.status] || s.status.toUpperCase()}
								</span>
								{s.details && (
									expanded.has(s.system) ? (
										<ChevronUp className="w-3 h-3 text-white/20" />
									) : (
										<ChevronDown className="w-3 h-3 text-white/20" />
									)
								)}
							</button>
							{expanded.has(s.system) && s.details && (
								<div className="px-3 pb-2 pl-6">
									{Object.entries(s.details).map(([k, v]) => (
										<div key={k} className="flex items-center gap-2 text-[9px] py-0.5">
											<span className="text-white/30 min-w-[80px]">{k}</span>
											<span
												className="font-mono truncate"
												style={{
													color:
														v === false
															? "#f87171"
															: v === true
																? "#6ee7b7"
																: typeof v === "string" && v === "STALLED"
																	? "#f87171"
																	: typeof v === "string" && v === "yes"
																		? "#6ee7b7"
																		: typeof v === "string" && v === "checking"
																			? "#fbbf24"
																			: typeof v === "string" && v === "airborne"
																				? "#fbbf24"
																				: "#71717a",
												}}
											>
												{Array.isArray(v)
													? v.length === 0
														? "(none)"
														: v.join(", ")
													: typeof v === "object" && v !== null
														? JSON.stringify(v)
														: String(v)}
											</span>
										</div>
									))}
								</div>
							)}
						</div>
					))
				)}
			</div>

			{/* Footer */}
			<div className="flex items-center justify-between px-3 py-1.5 border-t border-white/[0.06]">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={queryHealth}
						className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60 transition-colors"
					>
						<RefreshCw className="w-2.5 h-2.5" />
						Refresh
					</button>
					<button
						type="button"
						onClick={() => { setShowLogs(true); queryLogs(); }}
						className="flex items-center gap-1 text-[9px] text-blue-400/50 hover:text-blue-400 transition-colors"
					>
						<FileText className="w-2.5 h-2.5" />
						View Logs
					</button>
				</div>
				<span className="text-[8px] text-white/15 font-mono">vibexe diagnostics v3</span>
			</div>
		</div>
	);
}
