"use client";

/**
 * Debug Overlay — Runtime Diagnostic HUD
 *
 * Floating button in game mode preview that queries iframe systems
 * and displays a modern diagnostic panel showing health of all subsystems.
 */

import { Activity, ChevronDown, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SystemReport {
	system: string;
	status: "ok" | "inactive" | "missing" | "off" | "muted" | "none" | string;
	details?: Record<string, unknown> | null;
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

	if (!isOpen) {
		return (
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				className="absolute bottom-3 left-3 z-[100] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all duration-200 backdrop-blur-md border"
				style={{
					background: warnCount > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.1)",
					borderColor: warnCount > 0 ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.2)",
					color: warnCount > 0 ? "#fbbf24" : "#6ee7b7",
				}}
				title="Open system diagnostics"
			>
				<Activity className="w-3.5 h-3.5" />
				<span className="hidden sm:inline">Debug</span>
				{systems.length > 0 && (
					<span className="ml-1 tabular-nums">
						{okCount}/{systems.length}
					</span>
				)}
			</button>
		);
	}

	return (
		<div
			className="absolute bottom-3 left-3 z-[100] w-72 rounded-xl border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
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
			</div>

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
											<span className="text-white/50 font-mono truncate">
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
				<span className="text-[8px] text-white/15 font-mono">vibexe diagnostics</span>
			</div>
		</div>
	);
}
