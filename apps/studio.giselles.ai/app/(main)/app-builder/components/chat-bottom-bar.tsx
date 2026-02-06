"use client";

/**
 * ChatBottomBar Component
 *
 * Bottom action bar with 4 buttons (BASE44 style):
 * Settings, Plus, Discuss, Mic
 *
 * Reference: base44-Dashboard-1.png shows: gear | + | Discuss | mic
 *
 * Note: Uses plain <button> elements instead of Button component
 * because the custom Button has base styles (w-full, px-[20px], border)
 * that interfere with icon-only button rendering.
 */

import { MessageSquare, Mic, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatBottomBarProps {
	onSettings?: () => void;
	onPlus?: () => void;
	onDiscuss?: () => void;
	onMic?: () => void;
}

/**
 * ChatBottomBar - 4-button action bar below chat input
 *
 * Layout (matching BASE44):
 * - Settings gear (left)
 * - Plus button (left)
 * - Discuss button with text (center-left)
 * - Mic button (right)
 */
export function ChatBottomBar({
	onSettings,
	onPlus,
	onDiscuss,
	onMic,
}: ChatBottomBarProps) {
	// Base styles for icon-only buttons
	const iconButtonClass = cn(
		"flex items-center justify-center h-8 w-8 rounded-md transition-colors",
		"text-muted-foreground hover:text-foreground hover:bg-muted/50",
	);

	// Styles for the Discuss button with text
	const textButtonClass = cn(
		"flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors",
		"text-muted-foreground hover:text-foreground hover:bg-muted/50",
	);

	return (
		<div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-card">
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
