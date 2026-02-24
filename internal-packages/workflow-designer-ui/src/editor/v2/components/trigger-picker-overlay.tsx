"use client";

import { GlassSurfaceLayers } from "@vibexe-internal/ui/glass-surface";
import {
	createAppEntryNode,
	createErrorTriggerNode,
	createFormTriggerNode,
	createTriggerNode,
} from "@vibexe-ai/node-registry";
import type { TriggerContent } from "@vibexe-ai/protocol";
import { useFeatureFlag } from "@vibexe-ai/react";
import clsx from "clsx/lite";
import {
	AlertTriangleIcon,
	ClockIcon,
	FormInputIcon,
	GithubIcon,
	GlobeIcon,
	LinkIcon,
	MessageSquareIcon,
	PlayIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAddAppEntryWithEndNodes, useAddNode, useWorkspaceActions } from "../../../app-designer";

interface TriggerOption {
	id: string;
	icon: ReactNode;
	label: string;
	description: string;
	create: () => ReturnType<typeof createTriggerNode> | ReturnType<typeof createErrorTriggerNode> | ReturnType<typeof createFormTriggerNode>;
	requiresStageFlag?: boolean;
}

const TRIGGER_OPTIONS: TriggerOption[] = [
	{
		id: "manual",
		icon: <PlayIcon className="w-5 h-5" />,
		label: "Run manually",
		description: "Execute with the Run button",
		create: () => createTriggerNode("manual"),
	},
	{
		id: "schedule",
		icon: <ClockIcon className="w-5 h-5" />,
		label: "On a schedule",
		description: "Run at intervals (hourly, daily, cron)",
		create: () => createTriggerNode("schedule"),
	},
	{
		id: "webhook",
		icon: <LinkIcon className="w-5 h-5" />,
		label: "On webhook call",
		description: "Start on HTTP request",
		create: () => createTriggerNode("webhook"),
	},
	{
		id: "appEvent",
		icon: <GlobeIcon className="w-5 h-5" />,
		label: "On app event",
		description: "Triggered by external app events",
		create: () => createTriggerNode("appEvent"),
	},
	{
		id: "chat",
		icon: <MessageSquareIcon className="w-5 h-5" />,
		label: "On chat message",
		description: "Start from chat widget",
		create: () => createTriggerNode("chat"),
	},
	{
		id: "form",
		icon: <FormInputIcon className="w-5 h-5" />,
		label: "On form submission",
		description: "Start from a web form",
		create: () => createFormTriggerNode(),
	},
	{
		id: "error",
		icon: <AlertTriangleIcon className="w-5 h-5" />,
		label: "On workflow error",
		description: "Run when a node fails",
		create: () => createErrorTriggerNode(),
	},
	{
		id: "github",
		icon: <GithubIcon className="w-5 h-5" />,
		label: "On GitHub event",
		description: "Triggered by GitHub repo events",
		create: () => createTriggerNode("github"),
		requiresStageFlag: true,
	},
];

interface TriggerPickerOverlayProps {
	onSelect: (node: ReturnType<TriggerOption["create"]>) => void;
	onLegacyFlow: () => void;
}

export function TriggerPickerOverlay({ onSelect, onLegacyFlow }: TriggerPickerOverlayProps) {
	const { stage } = useFeatureFlag();

	const visibleOptions = TRIGGER_OPTIONS.filter(
		(opt) => !opt.requiresStageFlag || stage,
	);

	return (
		<div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
			<div className="pointer-events-auto relative w-[480px] rounded-[16px] overflow-hidden shadow-2xl">
				<div
					className="absolute inset-0 -z-10 rounded-[16px] pointer-events-none"
					style={{
						backgroundColor:
							"color-mix(in srgb, var(--color-background, #00020b) 70%, transparent)",
					}}
				/>
				<GlassSurfaceLayers
					tone="default"
					borderStyle="solid"
					withBaseFill={false}
					blurClass="backdrop-blur-xl"
					zIndexClass="z-0"
				/>

				<div className="relative z-10 px-6 py-5">
					<h2 className="text-[18px] font-semibold text-inverse mb-1">
						What triggers this workflow?
					</h2>
					<p className="text-[12px] text-inverse/50 mb-5">
						Choose how this workflow gets started
					</p>

					<div className="grid grid-cols-2 gap-2">
						{visibleOptions.map((option) => (
							<button
								key={option.id}
								type="button"
								onClick={() => onSelect(option.create())}
								className={clsx(
									"flex items-start gap-3 px-3 py-3 rounded-[10px] text-left",
									"bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15",
									"transition-all duration-150 group/trigger",
								)}
							>
								<div className="w-[36px] h-[36px] rounded-[8px] bg-white/8 flex items-center justify-center text-inverse/60 group-hover/trigger:text-inverse group-hover/trigger:bg-white/12 transition-colors shrink-0 mt-0.5">
									{option.icon}
								</div>
								<div className="min-w-0">
									<div className="text-[13px] font-medium text-inverse">
										{option.label}
									</div>
									<div className="text-[10px] text-inverse/45 leading-tight mt-0.5">
										{option.description}
									</div>
								</div>
							</button>
						))}
					</div>

					<div className="mt-4 pt-3 border-t border-white/5 text-center">
						<button
							type="button"
							onClick={onLegacyFlow}
							className="text-[11px] text-inverse/40 hover:text-inverse/70 transition-colors underline underline-offset-2"
						>
							Or start with an App (Start + End)
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
