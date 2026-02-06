"use client";

/**
 * BuilderLayout Component
 *
 * VibeSDK-style full-screen layout.
 *
 * Layout structure:
 * - BuilderHeader: Top bar with back button, app name, Upgrade/Publish buttons
 * - Content area: 3-column layout (flex-1)
 *   - LeftNavBar: Narrow vertical navigation (orange + button, settings, clear)
 *   - ChatColumn: Chat interface with bottom action bar
 *   - MainContentPanel: Preview/Code/Documents tabs
 *     - Preview tab: Sandpack preview (placeholder)
 *     - Code tab: Sidebar + code editor
 *     - Documents tab: ReadmePanel with doc browser and TOC
 *
 * Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/components/builder-layout.tsx
 */

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";
import type { FileType } from "../types/vibesdk";
import { BuilderHeader } from "./builder-header";
import { ChatColumn } from "./chat-column";
import { LeftNavBar } from "./left-nav-bar";
import { MainContentPanel, type ViewType } from "./main-content-panel";
import { SettingsFab } from "./settings-fab";

interface BuilderLayoutProps {
	app: {
		id: string;
		name: string;
	};
	files: AppFile[];
}

/**
 * BuilderLayout - VibeSDK-style full-screen layout with header.
 *
 * View state is lifted here and passed to MainContentPanel.
 * File clicks in PhaseTimeline trigger view change to "code" tab.
 */
export function BuilderLayout({
	app,
	files: initialFiles,
}: BuilderLayoutProps) {
	const router = useRouter();

	// View state for MainContentPanel tabs (default: preview)
	const [view, setView] = useState<ViewType>("preview");

	// Selected file for Code tab
	const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

	// Local files state for updates
	const [files, setFiles] = useState<AppFile[]>(initialFiles);

	// Handle file selection from PhaseTimeline in ChatColumn (switches to Code view)
	// Note: DashboardPanel manages its own section state; user can access Code via sidebar
	const handleFileClick = useCallback((file: FileType) => {
		setSelectedFileId(file.id);
		setView("code");
	}, []);

	// Handle file content update after save
	const handleFileUpdate = useCallback((fileId: string, content: string) => {
		setFiles((prevFiles) =>
			prevFiles.map((file) =>
				file.id === fileId ? { ...file, content } : file,
			),
		);
	}, []);

	// Handle files refresh after AI modifications
	const handleFilesChange = useCallback(async () => {
		try {
			const response = await fetch(`/api/app-builder/apps/${app.id}/files`);
			if (response.ok) {
				const data = await response.json();
				setFiles(data.files);
			}
		} catch {
			// Silently fail - file refresh is not critical
		}
	}, [app.id]);

	return (
		<div className="flex flex-col h-dvh w-screen overflow-hidden bg-background">
			{/* Header with back button and app name */}
			<BuilderHeader appName={app.name} />

			{/* Content area - 3-column layout */}
			<div className="flex-1 flex min-h-0">
				{/* Left Nav Bar - narrow vertical navigation */}
				<LeftNavBar
					onNewApp={() => router.push("/app-builder")}
					onClearChat={() => {
						/* TODO: Clear chat */
					}}
					onSettings={() => {
						/* TODO: Open settings modal */
					}}
				/>

				{/* Chat Column - constrained width, ALWAYS visible */}
				<div className="flex flex-col w-full max-w-md border-r border-border bg-card">
					<ChatColumn
						appId={app.id}
						appName={app.name}
						files={files}
						onFilesChange={handleFilesChange}
						onFileClick={handleFileClick}
					/>
				</div>

				{/* Main Content Panel - fills remaining space */}
				<div className="flex-1 flex flex-col min-w-0">
					<MainContentPanel
						appId={app.id}
						files={files}
						selectedFileId={selectedFileId}
						onFileSelect={setSelectedFileId}
						onFileUpdate={handleFileUpdate}
						view={view}
						onViewChange={setView}
					/>
				</div>
			</div>

			{/* Settings FAB - bottom right corner */}
			<SettingsFab
				badgeCount={3}
				onClick={() => {
					/* TODO: Open settings panel */
				}}
			/>
		</div>
	);
}
