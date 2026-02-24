"use client";

/**
 * CodeEditor Component
 *
 * Monaco Editor wrapper with dynamic import for SSR safety.
 * Supports read-only mode, Cmd/Ctrl+S save shortcut, and dark mode detection.
 *
 * Deploy to: /opt/vibexe/apps/studio.vibexe.ai/app/(main)/app-builder/components/code-editor.tsx
 */

import type { Monaco, OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamic import Monaco Editor with SSR disabled to prevent "navigator is not defined" errors
const MonacoEditor = dynamic(
	() => import("@monaco-editor/react").then((mod) => mod.Editor),
	{
		ssr: false,
		loading: () => (
			<div className="h-full w-full p-4">
				<Skeleton className="h-4 w-3/4 mb-2" />
				<Skeleton className="h-4 w-1/2 mb-2" />
				<Skeleton className="h-4 w-5/6 mb-2" />
				<Skeleton className="h-4 w-2/3 mb-2" />
				<Skeleton className="h-4 w-4/5 mb-2" />
				<Skeleton className="h-4 w-1/3 mb-2" />
				<Skeleton className="h-4 w-3/4 mb-2" />
				<Skeleton className="h-4 w-1/2" />
			</div>
		),
	},
);

interface CodeEditorProps {
	/** The code content to display */
	value: string;
	/** Monaco language identifier (e.g., "typescript", "javascript") */
	language: string;
	/** Whether the editor is read-only (default: true) */
	readOnly?: boolean;
	/** Callback when content changes */
	onChange?: (value: string | undefined) => void;
	/** Callback when Cmd/Ctrl+S is pressed */
	onSave?: () => void;
}

/**
 * Detect if dark mode is active by checking for .dark class on documentElement
 */
function useIsDarkMode(): boolean {
	const [isDark, setIsDark] = useState(false);

	useEffect(() => {
		// Check initial state
		const checkDarkMode = () => {
			setIsDark(document.documentElement.classList.contains("dark"));
		};

		checkDarkMode();

		// Watch for class changes on documentElement
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.attributeName === "class") {
					checkDarkMode();
				}
			}
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	return isDark;
}

/**
 * Get Monaco theme name based on dark mode state
 */
function getTheme(isDark: boolean): string {
	return isDark ? "vs-dark" : "vs";
}

export function CodeEditor({
	value,
	language,
	readOnly = true,
	onChange,
	onSave,
}: CodeEditorProps) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const monacoRef = useRef<Monaco | null>(null);
	const isDarkMode = useIsDarkMode();

	const handleEditorMount: OnMount = useCallback(
		(editor, monaco) => {
			editorRef.current = editor;
			monacoRef.current = monaco;

			// Set initial theme
			monaco.editor.setTheme(getTheme(isDarkMode));

			// Register Cmd/Ctrl+S keybinding for save
			editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
				if (!readOnly && onSave) {
					onSave();
				}
			});

			// Focus the editor
			editor.focus();
		},
		[readOnly, onSave, isDarkMode],
	);

	// Update theme when dark mode changes
	useEffect(() => {
		if (monacoRef.current) {
			monacoRef.current.editor.setTheme(getTheme(isDarkMode));
		}
	}, [isDarkMode]);

	return (
		<MonacoEditor
			height="100%"
			language={language}
			value={value}
			theme={getTheme(isDarkMode)}
			onChange={onChange}
			onMount={handleEditorMount}
			options={{
				readOnly,
				minimap: { enabled: false },
				fontSize: 14,
				fontFamily:
					"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
				lineNumbers: "on",
				scrollBeyondLastLine: false,
				wordWrap: "on",
				automaticLayout: true,
				padding: { top: 12, bottom: 12 },
				readOnlyMessage: readOnly
					? { value: "Toggle edit mode to make changes" }
					: undefined,
				// Improve appearance
				renderLineHighlight: "line",
				cursorBlinking: "smooth",
				smoothScrolling: true,
				// Performance
				folding: true,
				foldingStrategy: "indentation",
				// Disable features not needed for this use case
				contextmenu: true,
				quickSuggestions: !readOnly,
				suggestOnTriggerCharacters: !readOnly,
				acceptSuggestionOnEnter: readOnly ? "off" : "on",
				tabCompletion: readOnly ? "off" : "on",
			}}
		/>
	);
}
