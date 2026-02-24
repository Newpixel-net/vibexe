"use client";

import type { Task } from "@vibexe-ai/protocol";
import { CopyIcon, FilterIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

interface LogEntry {
	timestamp: number;
	nodeName: string;
	severity: "info" | "warning" | "error";
	message: string;
}

function flattenTaskToLogs(task: Task): LogEntry[] {
	const logs: LogEntry[] = [];

	// Flatten annotations — shown at task creation time
	if (task.annotations) {
		for (const ann of task.annotations) {
			logs.push({
				timestamp: task.createdAt,
				nodeName: "System",
				severity:
					ann.level === "error"
						? "error"
						: ann.level === "warning"
							? "warning"
							: "info",
				message: ann.message,
			});
		}
	}

	// Flatten step data from sequences
	// Use cumulative duration offsets to estimate per-step timing
	let cumulativeDuration = 0;
	for (const seq of task.sequences) {
		for (const step of seq.steps) {
			const stepTimestamp = task.createdAt + cumulativeDuration;
			const severity =
				step.status === "failed"
					? "error"
					: (step.status as string) === "warning"
						? "warning"
						: "info";
			const statusMsg =
				step.status === "completed"
					? `Completed in ${step.duration}ms`
					: step.status === "failed"
						? "Execution failed"
						: (step.status as string) === "skipped"
							? "Skipped"
							: `Status: ${step.status}`;

			logs.push({
				timestamp: stepTimestamp,
				nodeName: step.name,
				severity,
				message: statusMsg,
			});

			if (step.usage.totalTokens > 0) {
				logs.push({
					timestamp: stepTimestamp,
					nodeName: step.name,
					severity: "info",
					message: `Tokens: ${step.usage.inputTokens} in / ${step.usage.outputTokens} out (${step.usage.totalTokens} total)`,
				});
			}

			cumulativeDuration += step.duration;
		}
	}

	return logs.sort((a, b) => a.timestamp - b.timestamp);
}

export function ExecutionLogsPanel({ task }: { task: Task }) {
	const [searchText, setSearchText] = useState("");
	const [severityFilter, setSeverityFilter] = useState<string>("all");
	const [nodeFilter, setNodeFilter] = useState<string>("all");

	const allLogs = useMemo(() => flattenTaskToLogs(task), [task]);

	const uniqueNodes = useMemo(
		() => [...new Set(allLogs.map((l) => l.nodeName))],
		[allLogs],
	);

	const filteredLogs = useMemo(() => {
		return allLogs.filter((log) => {
			if (severityFilter !== "all" && log.severity !== severityFilter)
				return false;
			if (nodeFilter !== "all" && log.nodeName !== nodeFilter) return false;
			if (
				searchText &&
				!log.message.toLowerCase().includes(searchText.toLowerCase()) &&
				!log.nodeName.toLowerCase().includes(searchText.toLowerCase())
			)
				return false;
			return true;
		});
	}, [allLogs, severityFilter, nodeFilter, searchText]);

	const handleCopyAll = () => {
		const text = filteredLogs
			.map(
				(l) =>
					`[${l.severity.toUpperCase()}] [${l.nodeName}] ${l.message}`,
			)
			.join("\n");
		navigator.clipboard.writeText(text);
	};

	return (
		<div className="flex flex-col h-full">
			{/* Filters bar */}
			<div className="flex items-center gap-2 px-3 py-2 border-b border-inverse/10">
				<div className="flex items-center gap-1 flex-1 px-2 py-1 rounded bg-inverse/5 border border-inverse/10">
					<SearchIcon className="size-3 text-inverse/30" />
					<input
						type="text"
						className="flex-1 bg-transparent text-[11px] text-inverse/80 outline-none placeholder:text-inverse/30"
						placeholder="Search logs..."
						value={searchText}
						onChange={(e) => setSearchText(e.target.value)}
					/>
				</div>
				<select
					className="px-2 py-1 rounded bg-inverse/5 border border-inverse/10 text-[11px] text-inverse/70 outline-none"
					value={severityFilter}
					onChange={(e) => setSeverityFilter(e.target.value)}
				>
					<option value="all">All Levels</option>
					<option value="error">Errors</option>
					<option value="warning">Warnings</option>
					<option value="info">Info</option>
				</select>
				<select
					className="px-2 py-1 rounded bg-inverse/5 border border-inverse/10 text-[11px] text-inverse/70 outline-none max-w-[120px]"
					value={nodeFilter}
					onChange={(e) => setNodeFilter(e.target.value)}
				>
					<option value="all">All Nodes</option>
					{uniqueNodes.map((node) => (
						<option key={node} value={node}>
							{node}
						</option>
					))}
				</select>
				<button
					type="button"
					className="p-1 rounded hover:bg-inverse/10 text-inverse/40 hover:text-inverse/70"
					onClick={handleCopyAll}
					title="Copy all logs"
				>
					<CopyIcon className="size-3" />
				</button>
			</div>

			{/* Log entries */}
			<div className="flex-1 overflow-y-auto">
				{filteredLogs.length === 0 ? (
					<div className="px-4 py-8 text-center text-xs text-inverse/30">
						No log entries match filters.
					</div>
				) : (
					<div className="divide-y divide-inverse/5">
						{filteredLogs.slice(0, 500).map((log, idx) => (
							<div
								key={`log-${idx}`}
								className="flex items-start gap-2 px-3 py-1.5 text-[11px] hover:bg-inverse/3"
							>
								<span
									className={`shrink-0 w-[10px] h-[10px] rounded-full mt-[3px] ${
										log.severity === "error"
											? "bg-red-500/60"
											: log.severity === "warning"
												? "bg-yellow-500/60"
												: "bg-blue-500/30"
									}`}
								/>
								<span className="shrink-0 text-inverse/40 font-medium min-w-[80px] truncate">
									{log.nodeName}
								</span>
								<span className="text-inverse/70 flex-1">
									{log.message}
								</span>
							</div>
						))}
						{filteredLogs.length > 500 && (
							<div className="px-3 py-2 text-[10px] text-inverse/30 text-center">
								Showing first 500 of {filteredLogs.length} entries
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
