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
}

/**
 * Main Read me panel with 3-column documentation viewer.
 * Integrates file browser, markdown viewer, and table of contents.
 */
export function ReadmePanel({ files }: ReadmePanelProps) {
	// Filter to only documentation files (.md, readme, blueprint)
	const docFiles = useMemo(() => {
		return files.filter(
			(f) =>
				f.path.endsWith(".md") ||
				f.path.toLowerCase().includes("readme") ||
				f.path.toLowerCase().includes("blueprint"),
		);
	}, [files]);

	// Find default file (prefer README.md or Blueprint.md)
	const defaultFile = useMemo(() => {
		const readme = docFiles.find(
			(f) =>
				f.path.toLowerCase() === "readme.md" ||
				f.path.toLowerCase().endsWith("/readme.md"),
		);
		const blueprint = docFiles.find(
			(f) =>
				f.path.toLowerCase() === "blueprint.md" ||
				f.path.toLowerCase().endsWith("/blueprint.md"),
		);
		return readme?.path || blueprint?.path || docFiles[0]?.path || "";
	}, [docFiles]);

	// Selected file state
	const [selectedPath, setSelectedPath] = useState<string>(defaultFile);

	// Update selected path when docFiles change and current selection is invalid
	useEffect(() => {
		if (selectedPath && !docFiles.find((f) => f.path === selectedPath)) {
			setSelectedPath(defaultFile);
		}
	}, [docFiles, selectedPath, defaultFile]);

	// Headings extracted from markdown
	const [headings, setHeadings] = useState<Heading[]>([]);

	// Ref to the scrollable content container
	const contentRef = useRef<HTMLDivElement>(null);

	// Get heading IDs for scroll spy
	const headingIds = useMemo(() => headings.map((h) => h.id), [headings]);

	// Active heading from scroll spy
	const activeId = useScrollSpy(contentRef, headingIds);

	// Get content for selected file
	const selectedContent = useMemo(() => {
		const file = docFiles.find((f) => f.path === selectedPath);
		return file?.content || "";
	}, [docFiles, selectedPath]);

	// Handle file selection
	const handleFileSelect = useCallback((path: string) => {
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
	if (docFiles.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				<div className="text-center">
					<FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
					<p className="text-lg font-medium">No documentation yet</p>
					<p className="text-sm mt-1">
						Documentation will appear here after code generation.
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
					files={docFiles}
					selected={selectedPath}
					onSelect={handleFileSelect}
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
