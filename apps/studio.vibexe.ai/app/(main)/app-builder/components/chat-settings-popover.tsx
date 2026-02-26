"use client";

/**
 * ChatSettingsPopover Component
 *
 * Settings popover anchored to the Settings button in ChatBottomBar.
 * Shows model capabilities (read-only) and user preferences.
 */

import { Check, FileText, Image as ImageIcon, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type ModelCapabilities, getModelCapabilities } from "../lib/model-options";

interface ChatSettingsPopoverProps {
	modelId: string;
	appId: string;
	onClose: () => void;
}

/** localStorage key for per-app settings */
export const getSettingsKey = (appId: string) => `vibexe-builder-settings-${appId}`;

export interface ChatSettings {
	autoNameApps: boolean;
	deepThinking: boolean;
}

export const DEFAULT_SETTINGS: ChatSettings = {
	autoNameApps: true,
	deepThinking: false,
};

export function ChatSettingsPopover({ modelId, appId, onClose }: ChatSettingsPopoverProps) {
	const popoverRef = useRef<HTMLDivElement>(null);
	const capabilities = getModelCapabilities(modelId);
	const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);

	// Load from localStorage
	useEffect(() => {
		try {
			const stored = localStorage.getItem(getSettingsKey(appId));
			if (stored) {
				setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
			}
		} catch {
			// ignore
		}
	}, [appId]);

	// Save settings
	const updateSettings = useCallback(
		(patch: Partial<ChatSettings>) => {
			setSettings((prev) => {
				const next = { ...prev, ...patch };
				localStorage.setItem(getSettingsKey(appId), JSON.stringify(next));
				return next;
			});
		},
		[appId],
	);

	// Close on click outside
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [onClose]);

	// Close on Escape
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);

	return (
		<div
			ref={popoverRef}
			className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-border bg-[#2f343e] shadow-lg z-50"
		>
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-border">
				<span className="text-sm font-medium">Chat Settings</span>
				<button
					type="button"
					onClick={onClose}
					className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			</div>

			{/* Model Capabilities (read-only) */}
			<div className="px-3 py-2 border-b border-border">
				<div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
					Model Capabilities
				</div>
				<div className="space-y-1">
					<CapabilityRow
						icon={<ImageIcon className="h-3.5 w-3.5" />}
						label="Vision (images)"
						supported={capabilities.vision}
					/>
					<CapabilityRow
						icon={<FileText className="h-3.5 w-3.5" />}
						label="Documents (PDF)"
						supported={capabilities.documents}
					/>
				</div>
				<div className="text-[11px] text-muted-foreground mt-1.5">
					Max {capabilities.maxFiles} files, {capabilities.maxFileSizeMB}MB each
				</div>
			</div>

			{/* User Preferences */}
			<div className="px-3 py-2">
				<div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
					Preferences
				</div>
				<label className="flex items-center gap-2 cursor-pointer">
					<button
						type="button"
						onClick={() => updateSettings({ autoNameApps: !settings.autoNameApps })}
						className={cn(
							"h-4 w-4 rounded border flex items-center justify-center transition-colors",
							settings.autoNameApps
								? "bg-primary border-primary text-primary-foreground"
								: "border-muted-foreground",
						)}
					>
						{settings.autoNameApps && <Check className="h-3 w-3" />}
					</button>
					<span className="text-xs">Auto-name apps</span>
				</label>
				<label className="flex items-center gap-2 cursor-pointer mt-1.5">
					<button
						type="button"
						onClick={() => updateSettings({ deepThinking: !settings.deepThinking })}
						className={cn(
							"h-4 w-4 rounded border flex items-center justify-center transition-colors",
							settings.deepThinking
								? "bg-cyan-500 border-cyan-500 text-white"
								: "border-muted-foreground",
						)}
					>
						{settings.deepThinking && <Check className="h-3 w-3" />}
					</button>
					<span className="text-xs">Deep Thinking</span>
					<span className="text-[10px] text-muted-foreground">auto-review</span>
				</label>
			</div>
		</div>
	);
}

function CapabilityRow({
	icon,
	label,
	supported,
}: {
	icon: React.ReactNode;
	label: string;
	supported: boolean;
}) {
	return (
		<div className="flex items-center gap-2 text-xs">
			<span className={supported ? "text-green-500" : "text-muted-foreground/40"}>
				{icon}
			</span>
			<span className={supported ? "text-foreground" : "text-muted-foreground line-through"}>
				{label}
			</span>
			{supported && <Check className="h-3 w-3 text-green-500 ml-auto" />}
		</div>
	);
}
