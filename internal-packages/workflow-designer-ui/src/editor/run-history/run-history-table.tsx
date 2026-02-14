import { Button } from "@giselle-internal/ui/button";
import { EmptyState } from "@giselle-internal/ui/empty-state";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@giselle-internal/ui/table";
import type { Task } from "@giselles-ai/protocol";
import { FilterIcon, LoaderIcon, RefreshCcwIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { useAppDesignerStore } from "../../app-designer";
import { useGiselle } from "../../app-designer/store/giselle-client-provider";
import { RunDetailView } from "./run-detail-view";

function formatDateTime(timestamp: number): string {
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function formatDuration(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

export function RunHistoryTable({
	onDebug,
}: {
	onDebug?: (task: Task) => void;
} = {}) {
	const client = useGiselle();
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);
	const [tagFilter, setTagFilter] = useState<string | null>(null);
	const { data, isLoading, isValidating, mutate } = useSWR(
		{
			namespace: "getWorkspaceActs",
			workspaceId,
		},
		({ workspaceId }) =>
			client.getWorkspaceTasks({ workspaceId }).then((res) => res.tasks),
	);

	// Collect all unique tags across all tasks
	const allTags = useMemo(() => {
		if (!data) return [];
		const tagSet = new Set<string>();
		for (const task of data) {
			for (const tag of task.tags ?? []) {
				tagSet.add(tag);
			}
		}
		return Array.from(tagSet).sort();
	}, [data]);

	// Filter tasks by selected tag
	const filteredData = useMemo(() => {
		if (!data) return undefined;
		if (!tagFilter) return data;
		return data.filter((task) => (task.tags ?? []).includes(tagFilter));
	}, [data, tagFilter]);

	if (isLoading) {
		return null;
	}

	// Show drill-down view when a task is selected
	if (selectedTask) {
		return (
			<div className="h-full">
				<RunDetailView
					task={selectedTask}
					onBack={() => setSelectedTask(null)}
					onDebug={onDebug}
				/>
			</div>
		);
	}

	return (
		<div className="pl-4 pb-4 pt-2 h-full">
			<div className="flex items-center justify-between pb-2 gap-2">
				{/* Tag filter */}
				{allTags.length > 0 && (
					<div className="flex items-center gap-1.5">
						<FilterIcon className="size-3 text-inverse/30" />
						{allTags.map((tag) => (
							<button
								key={tag}
								type="button"
								onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
								className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
									tagFilter === tag
										? "bg-blue-500/20 text-blue-400 border-blue-500/30"
										: "bg-inverse/5 text-inverse/40 border-inverse/10 hover:border-inverse/20"
								}`}
							>
								{tag}
							</button>
						))}
						{tagFilter && (
							<button
								type="button"
								onClick={() => setTagFilter(null)}
								className="text-inverse/30 hover:text-inverse/60"
								title="Clear filter"
							>
								<XIcon className="size-3" />
							</button>
						)}
					</div>
				)}
				<div className="flex-1" />
				<Button
					type="button"
					variant="outline"
					size="compact"
					onClick={() => mutate()}
					disabled={isValidating}
					leftIcon={
						isValidating ? (
							<LoaderIcon className="size-[12px] animate-spin" />
						) : (
							<RefreshCcwIcon className="size-[12px]" />
						)
					}
				>
					{isValidating ? "Refreshing..." : "Refresh"}
				</Button>
			</div>
			{filteredData === undefined || filteredData.length < 1 ? (
				<EmptyState title="No run" description="No runs have been executed." />
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Time</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Steps</TableHead>
							<TableHead>Tags</TableHead>
							<TableHead>Trigger</TableHead>
							<TableHead>
								Duration
								<br />
								<span className="whitespace-nowrap">(Wall-Clock)</span>
							</TableHead>
							<TableHead>
								Duration
								<br />
								<span className="whitespace-nowrap">(Total tasks)</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredData.map((run) => (
							<TableRow
								key={run.id}
								className="cursor-pointer hover:bg-inverse/5 transition-colors"
								onClick={() => setSelectedTask(run)}
							>
								<TableCell className="whitespace-nowrap">
									{formatDateTime(run.createdAt)}
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{run.status === "completed" ? (
										<span className="text-[#39FF7F]">completed</span>
									) : run.status === "failed" ? (
										<span className="text-[#FF3D71]">failed</span>
									) : run.status === "inProgress" ? (
										<span className="inline-flex items-center gap-1">
											<LoaderIcon className="size-3 animate-spin text-amber-400" />
											<span className="text-amber-400">
												{Date.now() - run.createdAt > 15 * 60 * 1000
													? "stuck"
													: "running"}
											</span>
										</span>
									) : run.status === "cancelled" ? (
										<span className="text-inverse/40">cancelled</span>
									) : (
										run.status
									)}
								</TableCell>
								<TableCell className="whitespace-nowrap">
									<span className="inline-flex items-center gap-1">
										{run.steps.completed > 0 && (
											<>
												<span className="w-4 h-4 rounded-full bg-[#39FF7F] text-black text-xs flex items-center justify-center font-bold">
													✓
												</span>
												<span className="text-xs">{run.steps.completed}</span>
											</>
										)}
										{run.steps.failed > 0 && (
											<>
												<span className="w-4 h-4 rounded-full bg-[#FF3D71] text-black text-xs flex items-center justify-center font-bold">
													✕
												</span>
												<span className="text-xs">{run.steps.failed}</span>
											</>
										)}
										{(run.steps.skipped ?? 0) > 0 && (
											<>
												<span className="w-4 h-4 rounded-full bg-inverse/20 text-inverse/50 text-[9px] flex items-center justify-center">
													⊘
												</span>
												<span className="text-xs text-inverse/40">{run.steps.skipped}</span>
											</>
										)}
									</span>
								</TableCell>
								<TableCell>
									<div className="flex flex-wrap gap-1">
										{(run.tags ?? []).map((tag) => (
											<span
												key={tag}
												className="px-1.5 py-0.5 rounded-full text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20"
											>
												{tag}
											</span>
										))}
									</div>
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{run.trigger}
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{formatDuration(run.duration.wallClock)}
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{formatDuration(run.duration.totalTask)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}
