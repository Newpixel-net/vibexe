"use client";

/**
 * EditorPanel Component
 *
 * Code editor with toolbar showing file path, language, edit/view toggle,
 * save button, and unsaved changes indicator.
 *
 * Deploy to: /opt/vibexe/apps/studio.vibexe.ai/app/(main)/app-builder/components/editor-panel.tsx
 */

import {
	ChevronRight,
	Eye,
	FileCode2,
	Loader2,
	Pencil,
	Save,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AppFile } from "../adapters/file-adapter";
import { CodeEditor } from "./code-editor";

/**
 * Map file extension to Monaco language identifier
 */
function getLanguageFromPath(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase();

	const languageMap: Record<string, string> = {
		// JavaScript/TypeScript
		js: "javascript",
		jsx: "javascript",
		ts: "typescript",
		tsx: "typescript",
		mjs: "javascript",
		cjs: "javascript",

		// Web
		html: "html",
		htm: "html",
		css: "css",
		scss: "scss",
		sass: "scss",
		less: "less",

		// Data
		json: "json",
		jsonc: "json",
		yaml: "yaml",
		yml: "yaml",
		xml: "xml",
		toml: "toml",

		// Markup
		md: "markdown",
		mdx: "markdown",

		// Config
		env: "plaintext",
		gitignore: "plaintext",
		dockerignore: "plaintext",

		// Other
		sql: "sql",
		graphql: "graphql",
		gql: "graphql",
		prisma: "prisma",
		sh: "shell",
		bash: "shell",
		zsh: "shell",
		ps1: "powershell",
		py: "python",
		rb: "ruby",
		go: "go",
		rs: "rust",
		java: "java",
		kt: "kotlin",
		swift: "swift",
		c: "c",
		cpp: "cpp",
		h: "cpp",
		cs: "csharp",
		php: "php",
	};

	return languageMap[ext ?? ""] ?? "plaintext";
}

/**
 * Get display name for language
 */
function getLanguageDisplayName(language: string): string {
	const displayMap: Record<string, string> = {
		javascript: "JavaScript",
		typescript: "TypeScript",
		html: "HTML",
		css: "CSS",
		scss: "SCSS",
		json: "JSON",
		yaml: "YAML",
		markdown: "Markdown",
		plaintext: "Plain Text",
		sql: "SQL",
		graphql: "GraphQL",
		python: "Python",
		ruby: "Ruby",
		go: "Go",
		rust: "Rust",
		java: "Java",
		kotlin: "Kotlin",
		swift: "Swift",
		c: "C",
		cpp: "C++",
		csharp: "C#",
		php: "PHP",
		shell: "Shell",
		powershell: "PowerShell",
	};

	return displayMap[language] ?? language;
}

interface EditorPanelProps {
	/** The app ID for API calls */
	appId: string;
	/** All files for the app */
	files: AppFile[];
	/** Currently selected file ID (null if none selected) */
	selectedFileId: string | null;
	/** Callback when file content is updated */
	onFileUpdate: (fileId: string, content: string) => void;
}

export function EditorPanel({
	appId,
	files,
	selectedFileId,
	onFileUpdate,
}: EditorPanelProps) {
	const [isEditMode, setIsEditMode] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [localContent, setLocalContent] = useState<string>("");

	// Find the selected file
	const selectedFile = useMemo(() => {
		return files.find((f) => f.id === selectedFileId) ?? null;
	}, [files, selectedFileId]);

	// Detect language from file path
	const language = useMemo(() => {
		return selectedFile ? getLanguageFromPath(selectedFile.path) : "plaintext";
	}, [selectedFile]);

	// Parse path into breadcrumb segments
	const pathSegments = useMemo(() => {
		if (!selectedFile) return [];
		return selectedFile.path.split("/");
	}, [selectedFile]);

	// Reset state when file selection changes
	useEffect(() => {
		if (selectedFile) {
			setLocalContent(selectedFile.content ?? "");
			setHasUnsavedChanges(false);
			setIsEditMode(false);
		}
	}, [selectedFile]);

	// Handle content changes
	const handleContentChange = useCallback(
		(value: string | undefined) => {
			const newContent = value ?? "";
			setLocalContent(newContent);
			setHasUnsavedChanges(newContent !== (selectedFile?.content ?? ""));
		},
		[selectedFile],
	);

	// Save file to API
	const handleSave = useCallback(async () => {
		if (!selectedFile || !hasUnsavedChanges || isSaving) return;

		setIsSaving(true);
		try {
			const response = await fetch(`/api/app-builder/apps/${appId}/files`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					fileId: selectedFile.id,
					content: localContent,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				console.error("Failed to save file:", error);
				return;
			}

			// Update parent state with new content
			onFileUpdate(selectedFile.id, localContent);
			setHasUnsavedChanges(false);
		} catch (error) {
			console.error("Failed to save file:", error);
		} finally {
			setIsSaving(false);
		}
	}, [
		appId,
		selectedFile,
		localContent,
		hasUnsavedChanges,
		isSaving,
		onFileUpdate,
	]);

	// Toggle edit mode
	const toggleEditMode = useCallback(() => {
		setIsEditMode((prev) => !prev);
	}, []);

	// Empty state when no file is selected
	if (!selectedFile) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-muted-foreground">
				<FileCode2 className="h-12 w-12 mb-4" />
				<p className="text-lg font-medium">Select a file to view</p>
				<p className="text-sm mt-1">
					Choose a file from the tree to view its content
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Toolbar */}
			<div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
				{/* File path breadcrumb */}
				<div className="flex items-center gap-1 overflow-hidden min-w-0">
					{pathSegments.map((segment, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: Path segments are derived from static file path, order never changes
						<div key={index} className="flex items-center shrink-0">
							{index > 0 && (
								<ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />
							)}
							<span
								className={
									index === pathSegments.length - 1
										? "text-sm font-medium truncate"
										: "text-sm text-muted-foreground truncate"
								}
							>
								{segment}
							</span>
						</div>
					))}
					<span className="text-xs text-muted-foreground ml-2 shrink-0">
						{getLanguageDisplayName(language)}
					</span>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2 shrink-0">
					{/* Unsaved indicator */}
					{hasUnsavedChanges && (
						<span className="text-xs text-amber-500 font-medium">Unsaved</span>
					)}

					{/* Save button (visible in edit mode) */}
					{isEditMode && (
						<Button
							variant="link"
							onClick={handleSave}
							disabled={!hasUnsavedChanges || isSaving}
							className="h-8"
						>
							{isSaving ? (
								<Loader2 className="h-4 w-4 mr-1 animate-spin" />
							) : (
								<Save className="h-4 w-4 mr-1" />
							)}
							Save
						</Button>
					)}

					{/* Edit/View toggle */}
					<Button variant="link" onClick={toggleEditMode} className="h-8">
						{isEditMode ? (
							<>
								<Eye className="h-4 w-4 mr-1" />
								View
							</>
						) : (
							<>
								<Pencil className="h-4 w-4 mr-1" />
								Edit
							</>
						)}
					</Button>
				</div>
			</div>

			{/* Editor */}
			<div className="flex-1 min-h-0">
				<CodeEditor
					value={localContent}
					language={language}
					readOnly={!isEditMode}
					onChange={handleContentChange}
					onSave={handleSave}
				/>
			</div>
		</div>
	);
}
