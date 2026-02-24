"use client";

/**
 * Read Me Panel
 *
 * Container component for the Read me tab providing a 3-column layout:
 * - Left: DocFileBrowser for documentation file selection
 * - Center: MarkdownViewer for content rendering
 * - Right: TableOfContents for navigation
 */

import { FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocFileBrowser } from "./doc-file-browser";
import { type Heading, MarkdownViewer } from "./markdown-viewer";
import { TableOfContents, useScrollSpy } from "./table-of-contents";

export interface ReadmePanelProps {
	files: { id: string; path: string; content: string | null }[];
	isGenerating?: boolean;
	streamingDoc?: { path: string; content: string } | null;
}

/**
 * Main Read me panel with 3-column documentation viewer.
 * Integrates file browser, markdown viewer, and table of contents.
 */
export function ReadmePanel({ files, isGenerating, streamingDoc }: ReadmePanelProps) {
	// Filter to only documentation files (.md, readme)
	// Sort: docs/ files first, then root .md files
	const docFiles = useMemo(() => {
		const mdFiles = files.filter(
			(f) =>
				f.path.endsWith(".md") ||
				f.path.toLowerCase().includes("readme"),
		);
		return mdFiles.sort((a, b) => {
			const aIsWiki = a.path.startsWith("docs/") ? 0 : 1;
			const bIsWiki = b.path.startsWith("docs/") ? 0 : 1;
			if (aIsWiki !== bIsWiki) return aIsWiki - bIsWiki;
			return a.path.localeCompare(b.path);
		});
	}, [files]);

	// Merge streaming doc as synthetic entry when real file doesn't exist yet
	const effectiveDocFiles = useMemo(() => {
		if (!streamingDoc) return docFiles;
		const exists = docFiles.some((f) => f.path === streamingDoc.path);
		if (exists) return docFiles;
		const synthetic = { id: `streaming-${streamingDoc.path}`, path: streamingDoc.path, content: streamingDoc.content };
		return [...docFiles, synthetic].sort((a, b) => {
			const aIsWiki = a.path.startsWith("docs/") ? 0 : 1;
			const bIsWiki = b.path.startsWith("docs/") ? 0 : 1;
			if (aIsWiki !== bIsWiki) return aIsWiki - bIsWiki;
			return a.path.localeCompare(b.path);
		});
	}, [docFiles, streamingDoc]);

	// Find default file: prefer docs/README.md > README.md > Blueprint.md > first doc
	const defaultFile = useMemo(() => {
		const docsReadme = effectiveDocFiles.find((f) => f.path === "docs/README.md");
		if (docsReadme) return docsReadme.path;
		const readme = effectiveDocFiles.find(
			(f) =>
				f.path.toLowerCase() === "readme.md" ||
				f.path.toLowerCase().endsWith("/readme.md"),
		);
		if (readme) return readme.path;
		const blueprint = effectiveDocFiles.find((f) => f.path === "Blueprint.md");
		if (blueprint) return blueprint.path;
		return effectiveDocFiles[0]?.path || "";
	}, [effectiveDocFiles]);

	// Selected file state
	const [selectedPath, setSelectedPath] = useState<string>(defaultFile);
	const userHasSelected = useRef(false);
	const prevDocCount = useRef(docFiles.length);

	// Update selected path when docFiles change and current selection is invalid
	useEffect(() => {
		if (selectedPath && !effectiveDocFiles.find((f) => f.path === selectedPath)) {
			setSelectedPath(defaultFile);
		}
	}, [effectiveDocFiles, selectedPath, defaultFile]);

	// Auto-select newest wiki file when new docs appear (unless user manually selected)
	useEffect(() => {
		if (effectiveDocFiles.length > prevDocCount.current && !userHasSelected.current) {
			const newWiki = effectiveDocFiles.find(
				(f) => f.path.startsWith("docs/") && f.path !== selectedPath,
			);
			if (newWiki) {
				setSelectedPath(newWiki.path);
			}
		}
		prevDocCount.current = effectiveDocFiles.length;
	}, [effectiveDocFiles, selectedPath]);

	// Auto-select streaming doc path when it first appears (unless user manually selected)
	useEffect(() => {
		if (streamingDoc && !userHasSelected.current) {
			setSelectedPath(streamingDoc.path);
		}
	}, [streamingDoc]);

	// Headings extracted from markdown
	const [headings, setHeadings] = useState<Heading[]>([]);

	// Ref to the scrollable content container
	const contentRef = useRef<HTMLDivElement>(null);

	// Get heading IDs for scroll spy
	const headingIds = useMemo(() => headings.map((h) => h.id), [headings]);

	// Active heading from scroll spy
	const activeId = useScrollSpy(contentRef, headingIds);

	// Get content for selected file — prefer streaming content when available
	const selectedContent = useMemo(() => {
		if (streamingDoc && selectedPath === streamingDoc.path) {
			return streamingDoc.content;
		}
		const file = effectiveDocFiles.find((f) => f.path === selectedPath);
		return file?.content || "";
	}, [effectiveDocFiles, selectedPath, streamingDoc]);

	// Handle file selection
	const handleFileSelect = useCallback((path: string) => {
		userHasSelected.current = true;
		setSelectedPath(path);
		setHeadings([]); // Reset headings when file changes
	}, []);

	// Handle heading extraction from markdown viewer
	const handleHeadingsExtracted = useCallback(
		(extractedHeadings: Heading[]) => {
			setHeadings(extractedHeadings);
		},
		[],
	);

	// Handle TOC heading click - scroll to heading
	const handleHeadingClick = useCallback((id: string) => {
		if (!contentRef.current) return;

		const element = contentRef.current.querySelector(`#${CSS.escape(id)}`);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}, []);

	// If no documentation files, show empty state
	if (effectiveDocFiles.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				<div className="text-center">
					<FileText className={`h-12 w-12 mx-auto mb-4 opacity-50 ${isGenerating ? "animate-pulse" : ""}`} />
					<p className="text-lg font-medium">
						{isGenerating ? "Generating documentation..." : "No documentation yet"}
					</p>
					<p className="text-sm mt-1">
						{isGenerating
							? "Wiki pages will appear shortly..."
							: "Documentation will appear here after code generation."}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full">
			{/* Left sidebar - File Browser (w-48) */}
			<div className="w-48 flex-shrink-0 overflow-hidden">
				<DocFileBrowser
					files={effectiveDocFiles}
					selected={selectedPath}
					onSelect={handleFileSelect}
					streamingPath={streamingDoc?.path}
				/>
			</div>

			{/* Center - Markdown Content */}
			<div ref={contentRef} className="flex-1 overflow-y-auto">
				<MarkdownViewer
					content={selectedContent}
					onHeadingsExtracted={handleHeadingsExtracted}
				/>
			</div>

			{/* Right sidebar - Table of Contents (w-56) */}
			<div className="w-56 flex-shrink-0 overflow-hidden">
				<TableOfContents
					headings={headings}
					activeId={activeId}
					onHeadingClick={handleHeadingClick}
				/>
			</div>
		</div>
	);
}
