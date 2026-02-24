"use client";

/**
 * RightPanelTabs Component — Aurora Glass Design
 *
 * Glass pill tab navigation with active glow.
 */

import { Code2, Eye, FileText, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

export type RightPanelView = "preview" | "code" | "readme" | "workflows";

interface RightPanelTabsProps {
	view: RightPanelView;
	onViewChange: (view: RightPanelView) => void;
}

const TABS: { id: RightPanelView; label: string; icon: typeof Eye }[] = [
	{ id: "preview", label: "Preview", icon: Eye },
	{ id: "code", label: "Dashboard", icon: Code2 },
	{ id: "readme", label: "Documents", icon: FileText },
	{ id: "workflows", label: "Workflows", icon: Workflow },
];

export function RightPanelTabs({ view, onViewChange }: RightPanelTabsProps) {
	return (
		<div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.06] bg-white/[0.03]">
			{TABS.map(({ id, label, icon: Icon }) => (
				<button
					key={id}
					type="button"
					onClick={() => onViewChange(id)}
					className={cn(
						"flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-xl transition-all duration-200",
						view === id
							? "bg-white/[0.08] border border-white/[0.12] text-white/90 shadow-[0_0_12px_rgba(124,58,237,0.08)]"
							: "text-white/40 hover:text-white/70 hover:bg-white/[0.04]",
					)}
				>
					<Icon className="h-4 w-4 shrink-0" />
					<span>{label}</span>
				</button>
			))}
		</div>
	);
}
