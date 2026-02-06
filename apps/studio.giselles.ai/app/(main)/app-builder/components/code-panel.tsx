"use client";

/**
 * CodePanel Component
 *
 * Combines FileExplorer and EditorPanel in a resizable horizontal split layout.
 * Used by the Code tab in MainContentPanel to show file tree alongside code editor.
 *
 * Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/components/code-panel.tsx
 */

import { useCallback, useMemo } from "react";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { AppFile } from "../adapters/file-adapter";
import { toFileTypes } from "../adapters/file-adapter";
import type { FileType } from "../types/vibesdk";
import { EditorPanel } from "./editor-panel";
import { FileExplorer } from "./file-explorer";

export interface CodePanelProps {
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
}

/**
 * CodePanel - File tree + Code editor in a resizable horizontal split
 *
 * Layout:
 * - Left panel (25%): FileExplorer showing project file tree
 * - Right panel (75%): EditorPanel showing selected file content
 * - Resizable handle allows adjusting the split (15%-40% range for left panel)
 */
export function CodePanel({
	appId,
	files,
	selectedFileId,
	onFileSelect,
	onFileUpdate,
}: CodePanelProps) {
	// Convert AppFile[] to FileType[] for FileExplorer
	const vibeFiles = useMemo(() => toFileTypes(files), [files]);

	// Find the current file for FileExplorer highlighting
	const currentFile = useMemo(() => {
		if (!selectedFileId) return undefined;
		return vibeFiles.find((f) => f.id === selectedFileId);
	}, [vibeFiles, selectedFileId]);

	// Handle file click from FileExplorer
	const handleFileClick = useCallback(
		(file: FileType) => {
			onFileSelect(file.id);
		},
		[onFileSelect],
	);

	return (
		<div className="flex flex-col h-full min-h-0">
			<ResizablePanelGroup direction="horizontal" className="flex-1">
				<ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
					<FileExplorer
						files={vibeFiles}
						currentFile={currentFile}
						onFileClick={handleFileClick}
					/>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel defaultSize={75}>
					<EditorPanel
						appId={appId}
						files={files}
						selectedFileId={selectedFileId}
						onFileUpdate={onFileUpdate}
					/>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
