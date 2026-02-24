"use client";

/**
 * MainContentPanel Component
 *
 * Right column of the 2-column layout containing RightPanelTabs
 * and tabbed content (Preview, Code, Documents) with smooth transitions.
 *
 * Deploy to: /opt/vibexe/apps/studio.vibexe.ai/app/(main)/app-builder/components/main-content-panel.tsx
 */

import { AnimatePresence, motion } from "framer-motion";
import type { AppFile } from "../adapters/file-adapter";
import { DashboardPanel } from "./dashboard-panel";
import { ReadmePanel } from "./readme-panel";
import { RightPanelTabs, type RightPanelView } from "./right-panel-tabs";
import { SandpackPreview } from "./sandpack-preview";
import { WorkflowsPanel } from "./workflows-panel";

// Re-export RightPanelView as ViewType for backward compatibility
export type { RightPanelView as ViewType };

export interface MainContentPanelProps {
	/** App ID for API calls */
	appId: string;
	/** All files for the app */
	files: AppFile[];
	/** Currently selected file ID (null if none) */
	selectedFileId: string | null;
	/** Callback when file selection changes */
	onFileSelect: (fileId: string | null) => void;
	/** Callback when file content is updated */
	onFileUpdate: (fileId: string, content: string) => void;
	/** Current active view tab */
	view: RightPanelView;
	/** Callback when view tab changes */
	onViewChange: (view: RightPanelView) => void;
	/** Whether AI is currently generating code */
	isGenerating?: boolean;
}

/**
 * MainContentPanel - Tabbed content panel for Preview/Code/Documents
 *
 * Layout:
 * - RightPanelTabs at top with three tabs (Preview/Code/Documents)
 * - Content area with animated transitions between views
 * - Preview tab shows SandpackPreview with live code execution
 * - Code tab shows DashboardPanel (sidebar + code editor)
 * - Documents tab shows ReadmePanel with doc browser and TOC
 */
export function MainContentPanel({
	appId,
	files,
	selectedFileId,
	onFileSelect,
	onFileUpdate,
	view,
	onViewChange,
	isGenerating,
}: MainContentPanelProps) {
	return (
		<div className="flex-1 flex flex-col min-h-0 bg-white/[0.015] backdrop-blur-lg">
			<RightPanelTabs view={view} onViewChange={onViewChange} />

			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<AnimatePresence mode="wait">
					<motion.div
						key={view}
						initial={{ opacity: 0, x: 10 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -10 }}
						transition={{ duration: 0.15, ease: "easeOut" }}
						className="flex-1 flex flex-col min-h-0"
					>
						{view === "preview" && (
							<SandpackPreview
								appId={appId}
								files={files}
								isGenerating={isGenerating}
								onFileUpdate={onFileUpdate}
								onViewChange={onViewChange}
								onFileSelect={(id) => onFileSelect(id)}
							/>
						)}
						{view === "code" && (
							<DashboardPanel
								appId={appId}
								files={files}
								selectedFileId={selectedFileId}
								onFileSelect={onFileSelect}
								onFileUpdate={onFileUpdate}
							/>
						)}
						{view === "readme" && <ReadmePanel files={files} isGenerating={isGenerating} />}
						{view === "workflows" && <WorkflowsPanel appId={appId} />}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}
