"use client";

/**
 * ChatBottomBar Component — Aurora Glass Design
 *
 * Minimal utility bar with Settings gear and Sparkles (capabilities).
 * Model picker, Discuss, Deep Think, and Voice moved into ChatInput.
 */

import { Settings, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CapabilitiesModal } from "./capabilities-modal";
import { ChatSettingsPopover } from "./chat-settings-popover";

interface ChatBottomBarProps {
	appId?: string;
	onInsertText?: (text: string) => void;
	selectedModelId: string;
}

export function ChatBottomBar({
	appId,
	onInsertText,
	selectedModelId,
}: ChatBottomBarProps) {
	const [showSettings, setShowSettings] = useState(false);
	const [showCapabilities, setShowCapabilities] = useState(false);

	const glassIconBtn = cn(
		"flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-200",
		"text-white/40 hover:text-white/70 hover:bg-white/[0.08]",
	);

	return (
		<div className="flex items-center gap-2 px-4 py-1.5 border-t border-white/[0.06] backdrop-blur-md bg-white/[0.03]">
			{/* Settings */}
			<div className="relative">
				<button
					type="button"
					onClick={() => setShowSettings(!showSettings)}
					className={cn(
						glassIconBtn,
						showSettings && "bg-white/[0.08] text-white/70",
					)}
					aria-label="Settings"
				>
					<Settings className="h-4 w-4 shrink-0" />
				</button>
				{showSettings && appId && (
					<ChatSettingsPopover
						modelId={selectedModelId}
						appId={appId}
						onClose={() => setShowSettings(false)}
					/>
				)}
			</div>

			{/* Capabilities */}
			<button
				type="button"
				onClick={() => setShowCapabilities(true)}
				className={glassIconBtn}
				aria-label="AI capabilities"
				title="AI capabilities"
			>
				<Sparkles className="h-4 w-4 shrink-0" />
			</button>

			{/* Capabilities modal */}
			{showCapabilities && (
				<CapabilitiesModal
					onClose={() => setShowCapabilities(false)}
					onInsertText={onInsertText}
				/>
			)}
		</div>
	);
}
