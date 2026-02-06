"use client";

/**
 * RightPanelTabs Component
 *
 * Tab navigation for Preview | Code | Documents views (VibeSDK-style).
 * Three tabs with Lucide icons matching VibeSDK interface.
 *
 * Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/components/right-panel-tabs.tsx
 */

import { Code2, Eye, FileText, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Available views in the right panel.
 * - preview: Shows the live preview of the app
 * - code: Shows the DashboardPanel with sidebar and code editor
 * - readme: Shows documentation viewer with TOC
 * - workflows: Shows linked Giselle workflows for automation
 */
export type RightPanelView = "preview" | "code" | "readme" | "workflows";

interface RightPanelTabsProps {
	/** Currently active view */
	view: RightPanelView;
	/** Callback when view changes */
	onViewChange: (view: RightPanelView) => void;
}

/**
 * RightPanelTabs - Preview/Code/Documents tab navigation
 *
 * Styling matches VibeSDK tabs pattern:
 * - Active: bg-muted text-foreground
 * - Inactive: text-muted-foreground with hover states
 * - Each tab has an icon + text label
 */
export function RightPanelTabs({ view, onViewChange }: RightPanelTabsProps) {
	return (
		<div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-background">
			<button
				type="button"
				onClick={() => onViewChange("preview")}
				className={cn(
					"flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
					view === "preview"
						? "bg-muted text-foreground"
						: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
				)}
			>
				<Eye className="h-4 w-4 shrink-0" />
				<span>Preview</span>
			</button>
			<button
				type="button"
				onClick={() => onViewChange("code")}
				className={cn(
					"flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
					view === "code"
						? "bg-muted text-foreground"
						: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
				)}
			>
				<Code2 className="h-4 w-4 shrink-0" />
				<span>Dashboard</span>
			</button>
			<button
				type="button"
				onClick={() => onViewChange("readme")}
				className={cn(
					"flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
					view === "readme"
						? "bg-muted text-foreground"
						: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
				)}
			>
				<FileText className="h-4 w-4 shrink-0" />
				<span>Documents</span>
			</button>
			<button
				type="button"
				onClick={() => onViewChange("workflows")}
				className={cn(
					"flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
					view === "workflows"
						? "bg-muted text-foreground"
						: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
				)}
			>
				<Workflow className="h-4 w-4 shrink-0" />
				<span>Workflows</span>
			</button>
		</div>
	);
}
