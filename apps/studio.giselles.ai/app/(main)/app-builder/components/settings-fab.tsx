"use client";

/**
 * Settings Floating Action Button
 *
 * Fixed-position button in the bottom-right corner matching VibeSDK design.
 * Features:
 * - Circular button with Settings gear icon
 * - Orange badge with count (when > 0)
 * - Shadow for elevation
 */

import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsFabProps {
	badgeCount?: number;
	onClick?: () => void;
	className?: string;
}

/**
 * Floating action button for settings access.
 * Positioned in bottom-right corner with optional badge count.
 */
export function SettingsFab({
	badgeCount = 0,
	onClick,
	className,
}: SettingsFabProps) {
	return (
		<div className={cn("fixed bottom-6 right-6 z-50", className)}>
			<button
				type="button"
				onClick={onClick}
				className="h-12 w-12 rounded-full shadow-lg bg-background hover:bg-muted border border-border flex items-center justify-center relative transition-colors"
			>
				<Settings className="h-5 w-5 text-foreground" />
				{badgeCount > 0 && (
					<span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-xs font-medium flex items-center justify-center">
						{badgeCount > 9 ? "9+" : badgeCount}
					</span>
				)}
			</button>
		</div>
	);
}
