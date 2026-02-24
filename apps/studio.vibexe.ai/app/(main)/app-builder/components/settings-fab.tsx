"use client";

/**
 * Settings FAB — Aurora Glass Design
 *
 * Glass circle with backdrop blur and hover glow.
 */

import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsFabProps {
	badgeCount?: number;
	onClick?: () => void;
	className?: string;
}

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
				className="h-12 w-12 rounded-full backdrop-blur-md bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.12] flex items-center justify-center relative transition-all duration-200 shadow-lg hover:shadow-[0_0_20px_rgba(124,58,237,0.12)]"
			>
				<Settings className="h-5 w-5 text-white/70" />
				{badgeCount > 0 && (
					<span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-xs font-medium flex items-center justify-center">
						{badgeCount > 9 ? "9+" : badgeCount}
					</span>
				)}
			</button>
		</div>
	);
}
