"use client";

/**
 * ChatBottomBar Component
 *
 * Bottom action bar with model picker and action buttons.
 * Model selection persists per-app via localStorage.
 */

import { ChevronDown, MessageSquare, Mic, Plus, Settings } from "lucide-react";
import {
	DEFAULT_MODEL_ID,
	MODEL_OPTIONS,
} from "@/app/(main)/app-builder/lib/model-resolver";
import { cn } from "@/lib/utils";

interface ChatBottomBarProps {
	onSettings?: () => void;
	onPlus?: () => void;
	onDiscuss?: () => void;
	onMic?: () => void;
	selectedModelId: string;
	onModelChange: (modelId: string) => void;
}

const tierColors: Record<string, string> = {
	opus: "text-purple-400",
	sonnet: "text-blue-400",
	haiku: "text-green-400",
	standard: "text-muted-foreground",
};

export function ChatBottomBar({
	onSettings,
	onPlus,
	onDiscuss,
	onMic,
	selectedModelId,
	onModelChange,
}: ChatBottomBarProps) {
	const iconButtonClass = cn(
		"flex items-center justify-center h-8 w-8 rounded-md transition-colors",
		"text-muted-foreground hover:text-foreground hover:bg-muted/50",
	);

	const textButtonClass = cn(
		"flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors",
		"text-muted-foreground hover:text-foreground hover:bg-muted/50",
	);

	const selected =
		MODEL_OPTIONS.find((m) => m.id === selectedModelId) ||
		MODEL_OPTIONS.find((m) => m.id === DEFAULT_MODEL_ID)!;

	return (
		<div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-card">
			{/* Model picker dropdown */}
			<div className="relative">
				<select
					value={selectedModelId}
					onChange={(e) => onModelChange(e.target.value)}
					className="appearance-none bg-muted/50 border border-border rounded-md pl-2 pr-7 py-1.5 text-xs font-medium text-foreground cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
				>
					{MODEL_OPTIONS.map((opt) => (
						<option key={opt.id} value={opt.id}>
							{opt.name}
						</option>
					))}
				</select>
				<ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
			</div>

			{/* Settings icon button */}
			<button
				type="button"
				onClick={onSettings}
				className={iconButtonClass}
				aria-label="Settings"
			>
				<Settings className="h-4 w-4 shrink-0" />
			</button>

			{/* Plus icon button */}
			<button
				type="button"
				onClick={onPlus}
				className={iconButtonClass}
				aria-label="Add attachment"
			>
				<Plus className="h-4 w-4 shrink-0" />
			</button>

			{/* Discuss button with icon and text */}
			<button type="button" onClick={onDiscuss} className={textButtonClass}>
				<MessageSquare className="h-4 w-4 shrink-0" />
				<span>Discuss</span>
			</button>

			{/* Spacer to push mic to right */}
			<div className="flex-1" />

			{/* Mic icon button */}
			<button
				type="button"
				onClick={onMic}
				className={iconButtonClass}
				aria-label="Voice input"
			>
				<Mic className="h-4 w-4 shrink-0" />
			</button>
		</div>
	);
}
