"use client";

import {
	ChevronDownIcon,
	ChevronRightIcon,
	CopyIcon,
	LoaderIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface WebhookLog {
	dbId: number;
	method: string;
	path: string;
	headers: Record<string, string>;
	body: unknown;
	statusCode: number;
	responseBody: unknown;
	ipAddress: string | null;
	createdAt: string;
}

function formatRelativeTime(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	if (diff < 60000) return "just now";
	if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
	if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
	return `${Math.floor(diff / 86400000)}d ago`;
}

function LogRow({ log }: { log: WebhookLog }) {
	const [expanded, setExpanded] = useState(false);

	const handleCopyCurl = useCallback(() => {
		const headerEntries = Object.entries(log.headers || {})
			.filter(([k]) => !k.startsWith(":") && k !== "host" && k !== "content-length")
			.slice(0, 5)
			.map(([k, v]) => `-H "${k}: ${v}"`)
			.join(" \\\n  ");

		const bodyStr = log.body && Object.keys(log.body as object).length > 0
			? `-d '${JSON.stringify(log.body)}'`
			: "";

		const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://vibexe.online";
		const curl = `curl -X ${log.method} "${siteUrl}/api/webhooks/${log.path}" \\\n  ${headerEntries}${bodyStr ? ` \\\n  ${bodyStr}` : ""}`;
		navigator.clipboard.writeText(curl);
	}, [log]);

	return (
		<div className="border-b border-inverse/5 last:border-0">
			<button
				type="button"
				className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-inverse/5 transition-colors"
				onClick={() => setExpanded(!expanded)}
			>
				{expanded ? (
					<ChevronDownIcon className="size-3 text-inverse/40 shrink-0" />
				) : (
					<ChevronRightIcon className="size-3 text-inverse/40 shrink-0" />
				)}

				<span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
					log.method === "POST" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
				}`}>
					{log.method}
				</span>

				<span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
					log.statusCode >= 200 && log.statusCode < 300
						? "bg-green-500/10 text-green-400"
						: log.statusCode >= 400
							? "bg-red-500/10 text-red-400"
							: "bg-yellow-500/10 text-yellow-400"
				}`}>
					{log.statusCode}
				</span>

				<span className="flex-1 text-[10px] text-inverse/50 truncate">
					{log.ipAddress ?? "—"}
				</span>

				<span className="text-[10px] text-inverse/30 shrink-0">
					{formatRelativeTime(log.createdAt)}
				</span>
			</button>

			{expanded && (
				<div className="px-4 pb-3 pt-1 ml-5 space-y-2">
					{log.body && Object.keys(log.body as object).length > 0 && (
						<div>
							<div className="text-[9px] text-inverse/40 uppercase tracking-wider mb-1">Request Body</div>
							<pre className="p-2 rounded bg-black/30 text-[10px] text-inverse/60 font-mono whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto">
								{JSON.stringify(log.body, null, 2)}
							</pre>
						</div>
					)}

					{log.responseBody && (
						<div>
							<div className="text-[9px] text-inverse/40 uppercase tracking-wider mb-1">Response</div>
							<pre className="p-2 rounded bg-black/30 text-[10px] text-inverse/60 font-mono whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto">
								{JSON.stringify(log.responseBody, null, 2)}
							</pre>
						</div>
					)}

					<button
						type="button"
						onClick={handleCopyCurl}
						className="flex items-center gap-1 text-[10px] text-inverse/40 hover:text-inverse/70 transition-colors"
					>
						<CopyIcon className="size-2.5" />
						Copy as cURL
					</button>
				</div>
			)}
		</div>
	);
}

export function WebhookLogs({ webhookPath }: { webhookPath: string | null }) {
	const [logs, setLogs] = useState<WebhookLog[]>([]);
	const [loading, setLoading] = useState(false);
	const [autoRefresh, setAutoRefresh] = useState(false);

	const fetchLogs = useCallback(async () => {
		if (!webhookPath) return;
		setLoading(true);
		try {
			const res = await fetch(`/api/webhooks/logs?path=${encodeURIComponent(webhookPath)}&limit=50`);
			if (res.ok) {
				const data = await res.json();
				setLogs(data.logs ?? []);
			}
		} catch {
			// ignore
		} finally {
			setLoading(false);
		}
	}, [webhookPath]);

	useEffect(() => {
		fetchLogs();
	}, [fetchLogs]);

	useEffect(() => {
		if (!autoRefresh) return;
		const interval = setInterval(fetchLogs, 5000);
		return () => clearInterval(interval);
	}, [autoRefresh, fetchLogs]);

	if (!webhookPath) {
		return (
			<div className="px-3 py-4 text-center text-[11px] text-inverse/30">
				Save the webhook first to see request logs.
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			{/* Header */}
			<div className="flex items-center gap-2 px-3 py-2 border-b border-inverse/10">
				<span className="text-[11px] text-inverse/50 font-medium flex-1">
					Recent Requests ({logs.length})
				</span>
				<button
					type="button"
					onClick={() => setAutoRefresh(!autoRefresh)}
					className={`text-[10px] px-2 py-0.5 rounded ${
						autoRefresh
							? "bg-green-500/20 text-green-400"
							: "bg-inverse/5 text-inverse/40 hover:text-inverse/60"
					}`}
				>
					{autoRefresh ? "Auto" : "Manual"}
				</button>
				<button
					type="button"
					onClick={fetchLogs}
					disabled={loading}
					className="p-1 rounded hover:bg-inverse/10 text-inverse/40 hover:text-inverse/70 disabled:opacity-50"
				>
					{loading ? (
						<LoaderIcon className="size-3 animate-spin" />
					) : (
						<RefreshCwIcon className="size-3" />
					)}
				</button>
			</div>

			{/* Log list */}
			{logs.length === 0 ? (
				<div className="px-3 py-6 text-center text-[11px] text-inverse/30">
					No webhook requests received yet.
				</div>
			) : (
				<div className="max-h-[300px] overflow-y-auto">
					{logs.map((log) => (
						<LogRow key={log.dbId} log={log} />
					))}
				</div>
			)}
		</div>
	);
}
