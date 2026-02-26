"use client";

/**
 * BuilderLayout Component — Aurora Glass Design
 *
 * Full-screen layout with animated aurora gradient mesh background,
 * frosted glass panels, and 2-column layout (chat + main content).
 * LeftNavBar removed — actions merged into chat header/bottom bar.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";
import type { FileType } from "../types/vibesdk";
import { VisualEditProvider } from "../lib/visual-edit-context";
import type { PreviewMode } from "./sandpack-preview";
import { BuilderHeader } from "./builder-header";
import { ChatColumn } from "./chat-column";
import { MainContentPanel, type ViewType } from "./main-content-panel";
import { SettingsFab } from "./settings-fab";

interface BuilderLayoutProps {
	app: {
		id: string;
		name: string;
	};
	files: AppFile[];
}

export function BuilderLayout({
	app,
	files: initialFiles,
}: BuilderLayoutProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	// Capture previewMode in state so it persists even after chat-column.tsx
	// strips URL params via window.history.replaceState() (800ms after mount)
	const [previewMode] = useState<PreviewMode>(
		() => searchParams.get("type") === "mobile" ? "mobile-frame" : "browser",
	);
	const [projectType] = useState<string>(
		() => searchParams.get("type") ?? "app",
	);
	const [view, setView] = useState<ViewType>("preview");
	const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
	const [files, setFiles] = useState<AppFile[]>(initialFiles);
	const [appName, setAppName] = useState(app.name);
	const [isGenerating, setIsGenerating] = useState(false);
	const [streamingDoc, setStreamingDoc] = useState<{ path: string; content: string } | null>(null);
	const prevGenerating = useRef(false);

	const handleFileClick = useCallback((file: FileType) => {
		setSelectedFileId(file.id);
		setView("code");
	}, []);

	const handleFileUpdate = useCallback((fileId: string, content: string) => {
		setFiles((prevFiles) =>
			prevFiles.map((file) =>
				file.id === fileId ? { ...file, content } : file,
			),
		);
	}, []);

	const handleFilesChange = useCallback(async () => {
		try {
			const response = await fetch(`/api/app-builder/apps/${app.id}/files`);
			if (response.ok) {
				const data = await response.json();
				setFiles(data.files);
			}
		} catch {
			// Silently fail
		}
	}, [app.id]);

	// After generation ends, schedule delayed refreshes to catch async wiki files from syncWiki()
	// syncWiki() saves 9 pages sequentially (each with DB queries), so later pages may take 10-15s
	useEffect(() => {
		if (prevGenerating.current && !isGenerating) {
			const t1 = setTimeout(handleFilesChange, 2000);
			const t2 = setTimeout(handleFilesChange, 5000);
			const t3 = setTimeout(handleFilesChange, 10000);
			const t4 = setTimeout(handleFilesChange, 16000);
			return () => {
				clearTimeout(t1);
				clearTimeout(t2);
				clearTimeout(t3);
				clearTimeout(t4);
			};
		}
		prevGenerating.current = isGenerating;
	}, [isGenerating, handleFilesChange]);

	return (
		<VisualEditProvider>
		<div className="flex flex-col h-dvh w-screen overflow-hidden bg-[#0a0a14]">
			{/* Aurora gradient mesh — 3 animated blobs */}
			<div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
				<div
					className="aurora-blob"
					style={{
						background: "rgba(124, 58, 237, 0.15)",
						top: "10%",
						left: "15%",
						animation: "aurora-drift-1 20s ease-in-out infinite",
					}}
				/>
				<div
					className="aurora-blob"
					style={{
						background: "rgba(20, 184, 166, 0.12)",
						top: "50%",
						right: "10%",
						animation: "aurora-drift-2 25s ease-in-out infinite",
					}}
				/>
				<div
					className="aurora-blob"
					style={{
						background: "rgba(59, 130, 246, 0.10)",
						bottom: "10%",
						left: "40%",
						animation: "aurora-drift-3 30s ease-in-out infinite",
					}}
				/>
			</div>

			{/* Content — above aurora */}
			<div className="relative z-10 flex flex-col h-full">
				{/* Glass header */}
				<BuilderHeader appId={app.id} appName={appName} projectType={projectType} />

				{/* Content area — 2-column layout */}
				<div className="flex-1 flex min-h-0">
					{/* Chat Column — 520px, glass panel */}
					<div className="flex flex-col w-[520px] min-w-[400px] border-r border-white/[0.06] backdrop-blur-xl bg-white/[0.02]">
						<ChatColumn
							appId={app.id}
							appName={appName}
							files={files}
							onFilesChange={handleFilesChange}
							onFileClick={handleFileClick}
							onAppNameChange={setAppName}
							onGeneratingChange={setIsGenerating}
							onStreamingDoc={setStreamingDoc}
						/>
					</div>

					{/* Main Content Panel — fills remaining space, glass */}
					<div className="flex-1 flex flex-col min-w-0 backdrop-blur-lg bg-white/[0.015]">
						<MainContentPanel
							appId={app.id}
							files={files}
							selectedFileId={selectedFileId}
							onFileSelect={setSelectedFileId}
							onFileUpdate={handleFileUpdate}
							view={view}
							onViewChange={setView}
							isGenerating={isGenerating}
							streamingDoc={streamingDoc}
							previewMode={previewMode}
						/>
					</div>
				</div>
			</div>

			{/* Settings FAB */}
			<SettingsFab
				badgeCount={3}
				onClick={() => {
					/* TODO: Open settings panel */
				}}
			/>
		</div>
		</VisualEditProvider>
	);
}
