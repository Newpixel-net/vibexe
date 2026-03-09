"use client";

/**
 * Debug Overlay — Runtime Diagnostic HUD (v2)
 *
 * Floating button in game mode preview that queries iframe systems
 * and displays a modern diagnostic panel showing health of all subsystems
 * PLUS detected problems with actionable descriptions.
 */

import { Activity, AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
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
	inactive: "INACTIVE",
	missing: "MISSING",
	off: "OFF",
	muted: "MUTED",
	none: "NONE",
};

export function DebugOverlay({ iframeRef }: DebugOverlayProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [systems, setSystems] = useState<SystemReport[]>([]);
	const [problems, setProblems] = useState<Problem[]>([]);
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [lastUpdate, setLastUpdate] = useState<number>(0);
	const queryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const queryHealth = useCallback(() => {
		const iframe = iframeRef.current;
		if (!iframe?.contentWindow) return;
		iframe.contentWindow.postMessage({ type: "vibexe-debug-query-systems" }, "*");
	}, [iframeRef]);

	useEffect(() => {
		const handler = (ev: MessageEvent) => {
			if (ev.data?.type === "vibexe-debug-system-report-all") {
				setSystems(ev.data.systems || []);
				setProblems(ev.data.problems || []);
				setLastUpdate(Date.now());
			}
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, []);

	// Auto-refresh every 2s when panel is open
	useEffect(() => {
		if (isOpen) {
			queryHealth();
			queryIntervalRef.current = setInterval(queryHealth, 2000);
		} else {
			if (queryIntervalRef.current) {
				clearInterval(queryIntervalRef.current);
				queryIntervalRef.current = null;
			}
		}
		return () => {
			if (queryIntervalRef.current) clearInterval(queryIntervalRef.current);
		};
	}, [isOpen, queryHealth]);

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

	return (
		<div
			className="absolute bottom-3 left-3 z-[100] w-80 rounded-xl border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
			style={{ background: "rgba(10, 10, 14, 0.92)" }}
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
						Detected Problems
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
			<div className="max-h-64 overflow-y-auto scrollbar-thin">
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
											<span className="text-white/30 min-w-[60px]">{k}</span>
											<span
												className="font-mono truncate"
												style={{
													color:
														v === false
															? "#f87171"
															: v === true
																? "#6ee7b7"
																: "#71717a",
												}}
											>
												{typeof v === "object" ? JSON.stringify(v) : String(v)}
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
				<button
					type="button"
					onClick={queryHealth}
					className="text-[9px] text-white/30 hover:text-white/60 transition-colors"
				>
					Refresh
				</button>
				<span className="text-[8px] text-white/15 font-mono">vibexe diagnostics v2</span>
			</div>
		</div>
	);
}
