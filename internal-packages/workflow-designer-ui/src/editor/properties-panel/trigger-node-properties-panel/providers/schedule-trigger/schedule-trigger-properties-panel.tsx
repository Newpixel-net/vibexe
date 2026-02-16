"use client";

import type { TriggerNode } from "@giselles-ai/protocol";
import { useTrigger } from "@giselles-ai/react";
import { CheckCircle2Icon, ClockIcon, PowerIcon } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
	useAppDesignerStore,
	useUpdateNodeData,
	useUpdateNodeDataContent,
} from "../../../../../app-designer";
import { useGiselle } from "../../../../../app-designer/store/giselle-client-provider";
import { SpinnerIcon } from "../../../../../icons";

const CRON_PRESETS = [
	{ label: "Every minute", cron: "* * * * *" },
	{ label: "Every 5 minutes", cron: "*/5 * * * *" },
	{ label: "Every 15 minutes", cron: "*/15 * * * *" },
	{ label: "Every hour", cron: "0 * * * *" },
	{ label: "Every 6 hours", cron: "0 */6 * * *" },
	{ label: "Daily at midnight", cron: "0 0 * * *" },
	{ label: "Daily at 9 AM", cron: "0 9 * * *" },
	{ label: "Weekly (Monday 9 AM)", cron: "0 9 * * 1" },
	{ label: "Monthly (1st at midnight)", cron: "0 0 1 * *" },
] as const;

const TIMEZONES = [
	"UTC",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Asia/Tokyo",
	"Asia/Shanghai",
	"Asia/Kolkata",
	"Australia/Sydney",
] as const;

function describeCron(cron: string): string {
	const preset = CRON_PRESETS.find((p) => p.cron === cron);
	if (preset) return preset.label;
	return `Custom: ${cron}`;
}

export function ScheduleTriggerPropertiesPanel({
	node,
}: {
	node: TriggerNode;
}) {
	const updateNodeDataContent = useUpdateNodeDataContent();
	const updateNodeData = useUpdateNodeData();
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const client = useGiselle();
	const { callbacks } = useTrigger();
	const [customCron, setCustomCron] = useState("");
	const [showCustom, setShowCustom] = useState(false);
	const [isPending, startTransition] = useTransition();

	// Reset local state when node changes
	useEffect(() => {
		setCustomCron("");
		setShowCustom(false);
	}, [node.id]);

	const content = node.content as Record<string, unknown>;
	const currentCron = (content.scheduleCron as string) ?? "0 * * * *";
	const currentTimezone = (content.scheduleTimezone as string) ?? "UTC";
	const isConfigured = content.state
		? (content.state as Record<string, unknown>).status === "configured"
		: false;
	const isEnabled = (content.scheduleEnabled as boolean) ?? false;

	const handlePresetSelect = useCallback(
		(cron: string) => {
			setShowCustom(false);
			updateNodeDataContent(node, {
				scheduleCron: cron,
			} as Record<string, unknown>);
		},
		[node, updateNodeDataContent],
	);

	const handleTimezoneChange = useCallback(
		(tz: string) => {
			updateNodeDataContent(node, {
				scheduleTimezone: tz,
			} as Record<string, unknown>);
		},
		[node, updateNodeDataContent],
	);

	const handleSave = useCallback(
		(enabled: boolean) => {
			startTransition(async () => {
				const { triggerId } = await client.configureTrigger({
					trigger: {
						nodeId: node.id,
						workspaceId,
						enable: true,
						configuration: {
							provider: "schedule",
							event: {
								id: "schedule.cron",
								cronExpression: currentCron,
								timezone: currentTimezone,
							},
							enabled,
						},
					},
				});

				await callbacks?.triggerUpdate?.({
					id: triggerId,
					nodeId: node.id,
					workspaceId,
					enable: true,
					configuration: {
						provider: "schedule",
						event: {
							id: "schedule.cron",
							cronExpression: currentCron,
							timezone: currentTimezone,
						},
						enabled,
					},
				});

				updateNodeData(node, {
					content: {
						...node.content,
						scheduleCron: currentCron,
						scheduleTimezone: currentTimezone,
						scheduleEnabled: enabled,
						state: {
							status: "configured",
							flowTriggerId: triggerId,
						},
					} as any,
					name: node.name,
				});
			});
		},
		[
			client,
			node,
			workspaceId,
			currentCron,
			currentTimezone,
			updateNodeData,
			callbacks?.triggerUpdate,
		],
	);

	return (
		<div className="flex flex-col gap-[16px] p-[16px]">
			{/* Header */}
			<div className="flex items-center gap-[8px]">
				<ClockIcon className="size-[16px] text-trigger-node-1" />
				<span className="text-[13px] font-semibold text-inverse">
					Schedule Configuration
				</span>
			</div>

			{/* Status */}
			<div
				className={`flex items-center gap-[8px] rounded-[8px] p-[10px] ${
					isEnabled
						? "bg-green-500/10 border border-green-500/30"
						: "bg-inverse/5"
				}`}
			>
				{isEnabled ? (
					<CheckCircle2Icon className="size-[14px] text-green-400" />
				) : (
					<PowerIcon className="size-[14px] text-inverse/40" />
				)}
				<span
					className={`text-[12px] font-medium ${isEnabled ? "text-green-400" : "text-inverse/50"}`}
				>
					{isEnabled ? "Active" : "Inactive"}
				</span>
			</div>

			{/* Current Schedule */}
			<div className="bg-inverse/5 rounded-[8px] p-[12px]">
				<div className="text-[11px] text-inverse/50 mb-[4px]">
					Current Schedule
				</div>
				<div className="text-[13px] text-inverse font-medium">
					{describeCron(currentCron)}
				</div>
				<div className="text-[11px] text-inverse/40 mt-[2px]">
					Timezone: {currentTimezone}
				</div>
			</div>

			{/* Presets */}
			<div className="flex flex-col gap-[8px]">
				<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					Schedule Presets
				</span>
				<div className="grid grid-cols-2 gap-[4px]">
					{CRON_PRESETS.map((preset) => (
						<button
							key={preset.cron}
							type="button"
							onClick={() => handlePresetSelect(preset.cron)}
							className={`px-[8px] py-[6px] rounded-[6px] text-[11px] text-left transition-colors ${
								currentCron === preset.cron
									? "bg-trigger-node-1/20 border border-trigger-node-1 text-inverse"
									: "bg-inverse/5 text-inverse/60 hover:bg-inverse/10 hover:text-inverse/80 border border-transparent"
							}`}
						>
							{preset.label}
						</button>
					))}
				</div>
			</div>

			{/* Custom Cron */}
			<div className="flex flex-col gap-[8px]">
				<button
					type="button"
					onClick={() => setShowCustom(!showCustom)}
					className="text-[11px] text-inverse/50 hover:text-inverse/70 text-left underline"
				>
					{showCustom ? "Hide custom editor" : "Use custom cron expression"}
				</button>
				{showCustom && (
					<div className="flex gap-[8px]">
						<input
							type="text"
							value={customCron}
							onChange={(e) => setCustomCron(e.target.value)}
							placeholder="* * * * *"
							className="flex-1 bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[12px] text-inverse font-mono"
						/>
						<button
							type="button"
							onClick={() => {
								if (customCron.trim()) {
									handlePresetSelect(customCron.trim());
								}
							}}
							className="px-[12px] py-[6px] rounded-md text-[11px] bg-trigger-node-1/20 border border-trigger-node-1 text-inverse hover:bg-trigger-node-1/30"
						>
							Apply
						</button>
					</div>
				)}
			</div>

			{/* Timezone */}
			<div className="flex flex-col gap-[8px]">
				<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					Timezone
				</span>
				<select
					value={currentTimezone}
					onChange={(e) => handleTimezoneChange(e.target.value)}
					className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[12px] text-inverse"
				>
					{TIMEZONES.map((tz) => (
						<option key={tz} value={tz}>
							{tz}
						</option>
					))}
				</select>
			</div>

			{/* Enable / Disable + Save */}
			<div className="flex gap-[8px] pt-[8px]">
				{isEnabled ? (
					<button
						type="button"
						onClick={() => handleSave(false)}
						disabled={isPending}
						className="flex-1 flex items-center justify-center gap-[6px] px-[12px] py-[8px] rounded-[8px] bg-red-500/10 border border-red-500/30 text-red-400 text-[12px] font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
					>
						{isPending ? (
							<SpinnerIcon className="animate-follow-through-overlap-spin size-[14px]" />
						) : (
							<PowerIcon className="size-[14px]" />
						)}
						{isPending ? "Saving..." : "Disable Schedule"}
					</button>
				) : (
					<button
						type="button"
						onClick={() => handleSave(true)}
						disabled={isPending}
						className="flex-1 flex items-center justify-center gap-[6px] px-[12px] py-[8px] rounded-[8px] bg-green-500/10 border border-green-500/30 text-green-400 text-[12px] font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
					>
						{isPending ? (
							<SpinnerIcon className="animate-follow-through-overlap-spin size-[14px]" />
						) : (
							<PowerIcon className="size-[14px]" />
						)}
						{isPending ? "Saving..." : "Enable Schedule"}
					</button>
				)}
				{!isEnabled && (
					<button
						type="button"
						onClick={() => handleSave(false)}
						disabled={isPending}
						className="px-[12px] py-[8px] rounded-[8px] bg-inverse/5 border border-inverse/20 text-inverse/60 text-[12px] font-medium hover:bg-inverse/10 transition-colors disabled:opacity-50"
					>
						Save Only
					</button>
				)}
			</div>

			{/* Help text */}
			<p className="text-[10px] text-inverse/30">
				Cron format: minute hour day-of-month month day-of-week. The schedule
				trigger will automatically execute this workflow at the specified
				intervals.
			</p>
		</div>
	);
}
