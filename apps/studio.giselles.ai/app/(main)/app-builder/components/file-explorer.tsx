"use client";

/**
 * FileExplorer Component
 *
 * Displays a file tree with folder expand/collapse functionality.
 * Adapted from VibeSDK for the Giselle App Builder.
 *
 * Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/components/file-explorer.tsx
 */

import { ChevronRight, File, FolderOpen } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { FileTreeItem, FileType } from "../types/vibesdk";

/**
 * Recursive file tree item component
 * Handles both files and folders with expand/collapse state
 */
function FileTreeItemComponent({
	item,
	level = 0,
	currentFile,
	onFileClick,
}: {
	item: FileTreeItem;
	level?: number;
	currentFile: FileType | undefined;
	onFileClick: (file: FileType) => void;
}) {
	const [isExpanded, setIsExpanded] = useState(true);
	const isCurrentFile = currentFile?.filePath === item.filePath;

	if (item.type === "file" && item.file) {
		const file = item.file;
		return (
			<button
				type="button"
				onClick={() => onFileClick(file)}
				className={cn(
					"flex items-center w-full gap-2 py-1 px-3 transition-colors text-sm",
					isCurrentFile
						? "text-primary bg-muted"
						: "text-muted-foreground hover:bg-muted hover:text-foreground",
				)}
				style={{ paddingLeft: `${level * 12 + 12}px` }}
			>
				<File className="size-3 flex-shrink-0" />
				<span className="flex-1 text-left truncate">{item.name}</span>
				{item.file.isGenerating && (
					<span className="size-2 rounded-full bg-primary animate-pulse" />
				)}
				{item.file.needsFixing && (
					<span className="text-[9px] text-orange-400 font-medium">fix</span>
				)}
				{item.file.hasErrors && (
					<span className="text-[9px] text-red-400 font-medium">error</span>
				)}
			</button>
		);
	}

	return (
		<div>
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex items-center gap-2 py-1 px-3 transition-colors text-sm text-muted-foreground hover:bg-muted hover:text-foreground w-full"
				style={{ paddingLeft: `${level * 12 + 12}px` }}
			>
				<ChevronRight
					className={cn(
						"size-3 flex-shrink-0 transition-transform duration-200 ease-in-out",
						isExpanded && "rotate-90",
					)}
				/>
				<FolderOpen className="size-3 flex-shrink-0 text-muted-foreground" />
				<span className="flex-1 text-left truncate">{item.name}</span>
			</button>
			{isExpanded && item.children && (
				<div>
					{getSortedChildren(item.children).map((child) => (
						<FileTreeItemComponent
							key={child.filePath}
							item={child}
							level={level + 1}
							currentFile={currentFile}
							onFileClick={onFileClick}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * Sort children: folders first (alphabetically), then files (alphabetically)
 */
function getSortedChildren(
	children: Record<string, FileTreeItem>,
): FileTreeItem[] {
	return Object.values(children).sort((a, b) => {
		// Folders come first
		if (a.type === "folder" && b.type !== "folder") return -1;
		if (a.type !== "folder" && b.type === "folder") return 1;
		// Alphabetical within same type
		return a.name.localeCompare(b.name);
	});
}

/**
 * Build a file tree structure from a flat array of files
 * Creates nested folder structure based on file paths
 */
function buildFileTree(files: FileType[]): FileTreeItem[] {
	const root: Record<string, FileTreeItem> = {};

	files.forEach((file) => {
		const parts = file.filePath.split("/");
		let currentLevel = root;

		// Create folder nodes for each path segment (except the last which is the file)
		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			if (!currentLevel[part]) {
				currentLevel[part] = {
					name: part,
					type: "folder",
					filePath: parts.slice(0, i + 1).join("/"),
					children: {},
				};
			}
			if (!currentLevel[part].children) {
				currentLevel[part].children = {};
			}
			const children = currentLevel[part].children;
			if (children) {
				currentLevel = children;
			}
		}

		// Create the file node
		const fileName = parts[parts.length - 1];
		currentLevel[fileName] = {
			name: fileName,
			type: "file",
			filePath: file.filePath,
			file: file,
		};
	});

	// Sort root level and return
	return getSortedChildren(root);
}

/**
 * FileExplorer Props
 */
export interface FileExplorerProps {
	/** Array of files to display */
	files: FileType[];
	/** Currently selected file (highlighted in tree) */
	currentFile?: FileType;
	/** Callback when a file is clicked */
	onFileClick: (file: FileType) => void;
	/** Optional className for the container */
	className?: string;
}

/**
 * FileExplorer Component
 *
 * Displays a hierarchical file tree with:
 * - Folder expand/collapse functionality
 * - File selection highlighting
 * - File status indicators (generating, needs fixing, has errors)
 * - Folders sorted before files, both alphabetically
 */
export function FileExplorer({
	files,
	currentFile,
	onFileClick,
	className,
}: FileExplorerProps) {
	const fileTree = buildFileTree(files);

	return (
		<div
			className={cn(
				"w-full bg-card border-r border-border h-full overflow-y-auto",
				className,
			)}
		>
			<div className="p-2 px-3 text-sm flex items-center gap-2 text-muted-foreground font-medium border-b border-border">
				<FolderOpen className="size-4" />
				Files
			</div>
			<div className="flex flex-col py-1">
				{fileTree.length === 0 ? (
					<div className="px-3 py-4 text-sm text-muted-foreground text-center">
						No files yet
					</div>
				) : (
					fileTree.map((item) => (
						<FileTreeItemComponent
							key={item.filePath}
							item={item}
							currentFile={currentFile}
							onFileClick={onFileClick}
						/>
					))
				)}
			</div>
		</div>
	);
}

// Also export the buildFileTree utility for external use
export { buildFileTree };
