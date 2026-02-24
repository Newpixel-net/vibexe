"use client";

/**
 * ChatBottomBar Component — Aurora Glass Design
 *
 * Glass bar with custom model picker dropdown (no native select),
 * glass action buttons, and voice input.
 */

import { Check, ChevronDown, MessageSquare, Plus, Settings, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	DEFAULT_MODEL_ID,
	MODEL_OPTIONS,
} from "@/app/(main)/app-builder/lib/model-resolver";
import { cn } from "@/lib/utils";
import type { ChatMode } from "../types/vibesdk";
import { CapabilitiesModal } from "./capabilities-modal";
import { ChatSettingsPopover } from "./chat-settings-popover";
import { VoiceInputButton } from "./voice-input-button";

interface ChatBottomBarProps {
	appId?: string;
	onPlus?: () => void;
	onDiscuss?: () => void;
	selectedModelId: string;
	onModelChange: (modelId: string) => void;
	mode?: ChatMode;
	onVoiceTranscript?: (text: string) => void;
	onNewChat?: () => void;
	onInsertText?: (text: string) => void;
}

/**
 * Custom glass model picker dropdown.
 */
function ModelPicker({
	selectedModelId,
	onModelChange,
}: {
	selectedModelId: string;
	onModelChange: (modelId: string) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [focusIndex, setFocusIndex] = useState(-1);
	const containerRef = useRef<HTMLDivElement>(null);

	const selectedModel = MODEL_OPTIONS.find((m) => m.id === selectedModelId) || MODEL_OPTIONS[0];

	// Close on outside click
	useEffect(() => {
		if (!isOpen) return;
		const handleClick = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [isOpen]);

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!isOpen) {
				if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
					e.preventDefault();
					setIsOpen(true);
					setFocusIndex(MODEL_OPTIONS.findIndex((m) => m.id === selectedModelId));
				}
				return;
			}

			switch (e.key) {
				case "Escape":
					e.preventDefault();
					setIsOpen(false);
					break;
				case "ArrowDown":
					e.preventDefault();
					setFocusIndex((prev) => Math.min(prev + 1, MODEL_OPTIONS.length - 1));
					break;
				case "ArrowUp":
					e.preventDefault();
					setFocusIndex((prev) => Math.max(prev - 1, 0));
					break;
				case "Enter":
				case " ":
					e.preventDefault();
					if (focusIndex >= 0 && focusIndex < MODEL_OPTIONS.length) {
						onModelChange(MODEL_OPTIONS[focusIndex].id);
						setIsOpen(false);
					}
					break;
			}
		},
		[isOpen, focusIndex, selectedModelId, onModelChange],
	);

	return (
		<div ref={containerRef} className="relative">
			{/* Trigger chip */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				onKeyDown={handleKeyDown}
				className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs font-medium text-white/70 hover:bg-white/[0.1] hover:text-white/90 transition-all duration-200"
				aria-haspopup="listbox"
				aria-expanded={isOpen}
			>
				{selectedModel.name}
				<ChevronDown className={cn("h-3 w-3 transition-transform duration-200", isOpen && "rotate-180")} />
			</button>

			{/* Dropdown panel */}
			{isOpen && (
				<div
					className="absolute bottom-full mb-1 left-0 min-w-[200px] rounded-xl backdrop-blur-xl bg-[#1a1a2e]/95 border border-white/[0.1] shadow-xl overflow-hidden z-50"
					role="listbox"
				>
					{MODEL_OPTIONS.map((opt, index) => (
						<button
							key={opt.id}
							type="button"
							role="option"
							aria-selected={opt.id === selectedModelId}
							onClick={() => {
								onModelChange(opt.id);
								setIsOpen(false);
							}}
							className={cn(
								"flex items-center justify-between w-full px-3 py-2 text-xs transition-colors",
								focusIndex === index && "bg-white/[0.06]",
								opt.id === selectedModelId
									? "text-white/90"
									: "text-white/50 hover:text-white/70 hover:bg-white/[0.04]",
							)}
						>
							<span className="font-medium">{opt.name}</span>
							{opt.id === selectedModelId && (
								<Check className="h-3 w-3 text-violet-400" />
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

export function ChatBottomBar({
	appId,
	onPlus,
	onDiscuss,
	selectedModelId,
	onModelChange,
	mode = "generate",
	onVoiceTranscript,
	onNewChat,
	onInsertText,
}: ChatBottomBarProps) {
	const isDiscussMode = mode === "discuss";
	const [showSettings, setShowSettings] = useState(false);
	const [showCapabilities, setShowCapabilities] = useState(false);

	const glassIconBtn = cn(
		"flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-200",
		"text-white/40 hover:text-white/70 hover:bg-white/[0.08]",
	);

	return (
		<div className="flex items-center gap-2 px-4 py-2 border-t border-white/[0.06] backdrop-blur-md bg-white/[0.03]">
			{/* Custom model picker */}
			<ModelPicker
				selectedModelId={selectedModelId}
				onModelChange={onModelChange}
			/>

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

			{/* Plus */}
			<button
				type="button"
				onClick={onPlus}
				className={glassIconBtn}
				aria-label="Add attachment"
			>
				<Plus className="h-4 w-4 shrink-0" />
			</button>

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

			{/* Discuss toggle — glass pill */}
			<button
				type="button"
				onClick={onDiscuss}
				className={cn(
					"flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200",
					isDiscussMode
						? "bg-violet-500/[0.12] text-violet-300 border border-violet-500/[0.2]"
						: "text-white/40 hover:text-white/70 hover:bg-white/[0.06]",
				)}
			>
				<MessageSquare className="h-4 w-4 shrink-0" />
				<span>{isDiscussMode ? "Discussing" : "Discuss"}</span>
			</button>

			{/* Spacer */}
			<div className="flex-1" />

			{/* Voice input */}
			<VoiceInputButton
				onTranscript={onVoiceTranscript}
				className={glassIconBtn}
			/>

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
