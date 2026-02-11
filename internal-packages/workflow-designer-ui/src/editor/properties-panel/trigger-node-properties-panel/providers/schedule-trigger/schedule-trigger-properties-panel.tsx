"use client";

import type { TriggerNode } from "@giselles-ai/protocol";
import { ClockIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useUpdateNodeDataContent } from "../../../../../app-designer";

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
	const [customCron, setCustomCron] = useState("");
	const [showCustom, setShowCustom] = useState(false);

	// Read current configuration from node state (stored externally)
	// For now, show the configuration UI
	const handlePresetSelect = useCallback(
		(cron: string) => {
			setShowCustom(false);
			// Store the cron expression in the trigger node state
			// The actual configuration happens via configureTrigger server action
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

	const currentCron =
		(node.content as Record<string, unknown>).scheduleCron as string ??
		"0 * * * *";
	const currentTimezone =
		(node.content as Record<string, unknown>).scheduleTimezone as string ??
		"UTC";

	return (
		<div className="flex flex-col gap-[16px] p-[16px]">
			{/* Header */}
			<div className="flex items-center gap-[8px]">
				<ClockIcon className="size-[16px] text-trigger-node-1" />
				<span className="text-[13px] font-semibold text-inverse">
					Schedule Configuration
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

			{/* Help text */}
			<p className="text-[10px] text-inverse/30">
				Cron format: minute hour day-of-month month day-of-week. The schedule
				trigger will automatically execute this workflow at the specified
				intervals.
			</p>
		</div>
	);
}
