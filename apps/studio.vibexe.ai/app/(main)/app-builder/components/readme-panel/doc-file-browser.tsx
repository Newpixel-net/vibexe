"use client";

/**
 * Documentation File Browser
 *
 * Left sidebar component for the Documents tab that displays a list of
 * documentation files (Blueprint.md, README.md, etc.) for selection.
 *
 * Features matching VibeSDK:
 * - "Documentation" header with file count
 * - FileText icon next to each filename
 * - Orange highlight for selected file
 */

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocFileBrowserProps {
	files: { id?: string; path: string; content: string | null }[];
	selected: string;
	onSelect: (path: string) => void;
}

/**
 * File browser component showing available documentation files.
 * Displays "Documentation" header with file count and file list.
 */
export function DocFileBrowser({
	files,
	selected,
	onSelect,
}: DocFileBrowserProps) {
	// Filter to only show .md files
	const docFiles = files.filter(
		(f) =>
			f.path.endsWith(".md") ||
			f.path.toLowerCase().includes("readme"),
	);

	const fileCount = docFiles.length;
	const fileLabel = fileCount === 1 ? "1 file" : `${fileCount} files`;

	return (
		<div className="flex flex-col h-full border-r bg-background">
			{/* Header */}
			<div className="p-4 border-b">
				<h3 className="font-semibold text-foreground">Documentation</h3>
				<p className="text-sm text-muted-foreground">{fileLabel}</p>
			</div>

			{/* File list */}
			<div className="flex-1 overflow-y-auto p-2">
				{docFiles.map((file) => {
					const fileName = file.path.split("/").pop() || file.path;
					const isSelected = file.path === selected;
					const isWiki = file.path.startsWith("docs/");

					return (
						<button
							type="button"
							key={file.path}
							onClick={() => onSelect(file.path)}
							className={cn(
								"w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors",
								isSelected
									? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
						>
							<FileText className="h-4 w-4 flex-shrink-0" />
							<span className="truncate">{fileName}</span>
							{isWiki && (
								<span className="ml-auto text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">
									Wiki
								</span>
							)}
						</button>
					);
				})}

				{docFiles.length === 0 && (
					<p className="px-3 py-2 text-sm text-muted-foreground">
						No documentation files yet
					</p>
				)}
			</div>
		</div>
	);
}
