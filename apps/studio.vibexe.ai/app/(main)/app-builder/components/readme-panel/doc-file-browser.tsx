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

import { ChevronDown, ChevronUp, FileText, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Description for each known wiki page */
const WIKI_GUIDE: { file: string; desc: string }[] = [
	{ file: "README.md", desc: "Project overview, features & tech stack" },
	{ file: "ARCHITECTURE.md", desc: "File structure & component diagrams" },
	{ file: "DATA-MODEL.md", desc: "Entity schemas, relations & ER diagram" },
	{ file: "API-REFERENCE.md", desc: "SDK methods used across the app" },
	{ file: "COMPONENTS.md", desc: "Component catalog with imports" },
	{ file: "CHANGELOG.md", desc: "Timestamped change history" },
	{ file: "BACKEND.md", desc: "Functions, hooks & scheduled jobs" },
	{ file: "SECURITY.md", desc: "Auth providers & access policies" },
	{ file: "DEPLOYMENT.md", desc: "Subdomain, storage & integrations" },
];

interface DocFileBrowserProps {
	files: { id?: string; path: string; content: string | null }[];
	selected: string;
	onSelect: (path: string) => void;
	streamingPath?: string;
}

/**
 * File browser component showing available documentation files.
 * Displays "Documentation" header with file count and file list.
 */
export function DocFileBrowser({
	files,
	selected,
	onSelect,
	streamingPath,
}: DocFileBrowserProps) {
	// Filter to only show .md files, pin README first
	const docFiles = files
		.filter(
			(f) =>
				f.path.endsWith(".md") ||
				f.path.toLowerCase().includes("readme"),
		)
		.sort((a, b) => {
			const aName = a.path.split("/").pop()?.toLowerCase() || "";
			const bName = b.path.split("/").pop()?.toLowerCase() || "";
			const aIsReadme = aName.startsWith("readme");
			const bIsReadme = bName.startsWith("readme");
			if (aIsReadme && !bIsReadme) return -1;
			if (!aIsReadme && bIsReadme) return 1;
			return aName.localeCompare(bName);
		});

	const fileCount = docFiles.length;
	const fileLabel = fileCount === 1 ? "1 file" : `${fileCount} files`;

	// Track previously-seen file paths for new-file animation
	const seenPaths = useRef<Set<string>>(new Set(docFiles.map((f) => f.path)));
	const [newPaths, setNewPaths] = useState<Set<string>>(new Set());
	const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Stable key so effect only runs when actual paths change
	const pathsKey = docFiles.map((f) => f.path).join("\n");

	useEffect(() => {
		const fresh = new Set<string>();
		for (const f of docFiles) {
			if (!seenPaths.current.has(f.path)) {
				fresh.add(f.path);
				seenPaths.current.add(f.path);
			}
		}
		if (fresh.size > 0) {
			setNewPaths(fresh);
			if (clearTimer.current) clearTimeout(clearTimer.current);
			clearTimer.current = setTimeout(() => setNewPaths(new Set()), 2000);
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathsKey]);

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
					const isNew = newPaths.has(file.path);
					const isStreaming = file.path === streamingPath;

					return (
						<button
							type="button"
							key={file.path}
							onClick={() => onSelect(file.path)}
							className={cn(
								"w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-all duration-300",
								isSelected
									? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
								isNew && !isSelected && "animate-pulse bg-blue-50 dark:bg-blue-900/20",
							)}
						>
							<FileText className="h-4 w-4 flex-shrink-0" />
							<span className="truncate">{fileName}</span>
							{isStreaming && (
								<span className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
							)}
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
		{/* Guide section */}
			<WikiGuide />
		</div>
	);
}

/** Collapsible guide explaining the wiki pages */
function WikiGuide() {
	const [open, setOpen] = useState(false);

	return (
		<div className="border-t">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
			>
				<Info className="h-3 w-3 flex-shrink-0" />
				<span>How it works</span>
				{open ? (
					<ChevronDown className="h-3 w-3 ml-auto" />
				) : (
					<ChevronUp className="h-3 w-3 ml-auto" />
				)}
			</button>

			{open && (
				<div className="px-4 pb-3 space-y-2.5">
					<p className="text-[11px] text-muted-foreground leading-relaxed">
						Wiki pages are <strong>auto-generated</strong> after each code change and stay in sync with your app.
					</p>

					<div className="space-y-1">
						{WIKI_GUIDE.map((item) => (
							<div key={item.file} className="flex gap-1.5 text-[11px]">
								<span className="text-orange-500 font-medium flex-shrink-0">{item.file.replace(".md", "")}</span>
								<span className="text-muted-foreground">{item.desc}</span>
							</div>
						))}
					</div>

					<p className="text-[11px] text-muted-foreground leading-relaxed border-t pt-2">
						Click any file to read it. Use the <strong>Table of Contents</strong> on the right to jump between sections.
					</p>
				</div>
			)}
		</div>
	);
}
