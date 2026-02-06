"use client";

/**
 * SandpackPreview Component
 *
 * Live preview of generated React code using Sandpack.
 * Uses incremental file updates (no remount) so the preview stays alive
 * while files are being generated.
 *
 * Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/components/sandpack-preview.tsx
 */

import {
	SandpackConsole,
	SandpackPreview as SandpackPreviewPane,
	SandpackProvider,
	useSandpack,
} from "@codesandbox/sandpack-react";
import {
	ChevronDown,
	ChevronUp,
	Monitor,
	RefreshCw,
	Smartphone,
	Tablet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";
import {
	type SandpackFiles,
	convertToSandpackFiles,
	extractDependencies,
} from "../adapters/sandpack-adapter";

type DeviceSize = "desktop" | "tablet" | "mobile";

const DEVICE_SIZES: Record<DeviceSize, { width: number; label: string }> = {
	desktop: { width: 1280, label: "Desktop" },
	tablet: { width: 768, label: "Tablet" },
	mobile: { width: 375, label: "Mobile" },
};

interface SandpackPreviewProps {
	appId: string;
	files: AppFile[];
}

/**
 * Refresh button that triggers Sandpack refresh
 */
function RefreshButton() {
	const { sandpack } = useSandpack();

	return (
		<button
			type="button"
			onClick={() => sandpack.runSandpack()}
			className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm"
			title="Refresh preview"
		>
			<RefreshCw className="w-4 h-4" />
		</button>
	);
}

/**
 * Inner component that incrementally updates Sandpack files without remounting.
 * Lives inside SandpackProvider to access useSandpack() hook.
 *
 * Simple approach: diff previous vs current files, call updateFile for each
 * change, then trigger recompilation. Debounced with 500ms to batch rapid changes.
 */
function SandpackFileUpdater({ files }: { files: SandpackFiles }) {
	const { sandpack } = useSandpack();
	const prevFilesRef = useRef<SandpackFiles | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Store latest updates in a ref so the timer callback always has fresh data
	const latestUpdatesRef = useRef<Array<[string, string]>>([]);

	useEffect(() => {
		// Skip the very first render - SandpackProvider already has initial files
		if (prevFilesRef.current === null) {
			prevFilesRef.current = files;
			return;
		}

		const prev = prevFilesRef.current;

		// Find new or changed files
		for (const [path, file] of Object.entries(files)) {
			const code = typeof file === "string" ? file : file.code;
			const prevFile = prev[path];
			const prevCode = prevFile
				? typeof prevFile === "string"
					? prevFile
					: prevFile.code
				: undefined;

			if (prevCode !== code) {
				// Merge into latest updates (overwrite if same path)
				const existing = latestUpdatesRef.current.findIndex(
					([p]) => p === path,
				);
				if (existing >= 0) {
					latestUpdatesRef.current[existing] = [path, code];
				} else {
					latestUpdatesRef.current.push([path, code]);
				}
			}
		}

		prevFilesRef.current = files;

		if (latestUpdatesRef.current.length === 0) {
			return;
		}

		// Only set a timer if one isn't already pending
		// This lets the first trigger start the timer, subsequent changes
		// just update the ref data (which the timer callback will read)
		if (!debounceRef.current) {
			debounceRef.current = setTimeout(() => {
				debounceRef.current = null;
				const updates = latestUpdatesRef.current;
				latestUpdatesRef.current = [];

				if (updates.length === 0) return;

				console.log(
					"[SandpackFileUpdater] Applying",
					updates.length,
					"file updates:",
					updates.map(([p]) => p),
				);

				// Apply all file updates first
				for (const [path, code] of updates) {
					sandpack.updateFile(path, code);
				}

				// Delay runSandpack() to let file state commit before recompile
				setTimeout(() => {
					sandpack.runSandpack();
				}, 150);
			}, 500);
		}
	}, [files, sandpack]);

	// Cleanup on unmount only
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	return null; // Render nothing - just manages file sync
}

/**
 * CSS to make Sandpack fill its container
 * Sandpack uses .sp-wrapper as its main container class
 */
const sandpackFullHeightStyles = `
  .sandpack-container .sp-wrapper {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }
  .sandpack-container .sp-layout {
    height: 100% !important;
    flex: 1 !important;
  }
  .sandpack-container .sp-stack {
    height: 100% !important;
  }
  .sandpack-container .sp-preview-container {
    height: 100% !important;
  }
  .sandpack-container .sp-preview {
    height: 100% !important;
  }
  .sandpack-container .sp-preview iframe {
    height: 100% !important;
  }
`;

/**
 * Main preview component with responsive toggles and console.
 * SandpackProvider is mounted ONCE with initial files.
 * Subsequent file changes are applied incrementally via SandpackFileUpdater.
 */
export function SandpackPreview({
	appId: _appId,
	files,
}: SandpackPreviewProps) {
	const [device, setDevice] = useState<DeviceSize>("desktop");
	const [showConsole, setShowConsole] = useState(false);

	// Convert files to Sandpack format
	const sandpackFiles = useMemo(() => convertToSandpackFiles(files), [files]);
	const dependencies = useMemo(() => extractDependencies(files), [files]);

	// Capture initial files for SandpackProvider (only set once)
	const initialFilesRef = useRef(sandpackFiles);
	const initialDepsRef = useRef(dependencies);

	// Debug: log file changes
	useEffect(() => {
		console.log("[SandpackPreview] Files updated:", files.length, "files");
		console.log(
			"[SandpackPreview] Sandpack files:",
			Object.keys(sandpackFiles),
		);
	}, [files, sandpackFiles]);

	// Calculate preview width based on device
	const previewWidth = DEVICE_SIZES[device].width;

	return (
		<div className="flex-1 flex flex-col min-h-0 bg-background">
			{/* Inject Sandpack styles */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Internal CSS string constant, not user input */}
			<style dangerouslySetInnerHTML={{ __html: sandpackFullHeightStyles }} />

			{/* Toolbar */}
			<div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
				{/* Device toggles */}
				<div className="flex items-center gap-1">
					{(Object.keys(DEVICE_SIZES) as DeviceSize[]).map((size) => {
						const Icon =
							size === "desktop"
								? Monitor
								: size === "tablet"
									? Tablet
									: Smartphone;
						const isActive = device === size;
						return (
							<button
								type="button"
								key={size}
								onClick={() => setDevice(size)}
								className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded transition-colors ${
									isActive
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								}`}
								title={DEVICE_SIZES[size].label}
							>
								<Icon className="w-3.5 h-3.5" />
								<span className="hidden sm:inline">
									{DEVICE_SIZES[size].label}
								</span>
							</button>
						);
					})}
				</div>

				{/* Actions */}
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => setShowConsole(!showConsole)}
						className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
							showConsole
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						{showConsole ? (
							<ChevronDown className="w-3.5 h-3.5" />
						) : (
							<ChevronUp className="w-3.5 h-3.5" />
						)}
						Console
					</button>
				</div>
			</div>

			{/* Sandpack container - fills remaining space */}
			<div className="sandpack-container flex-1 flex flex-col min-h-0 overflow-hidden bg-muted/20 p-2">
				<div
					className="bg-background rounded-lg shadow-lg overflow-hidden flex-1 min-h-0 transition-all duration-200 mx-auto"
					style={{
						width: device === "desktop" ? "100%" : previewWidth,
						maxWidth: "100%",
					}}
				>
					<SandpackProvider
						template="react-ts"
						files={initialFilesRef.current}
						customSetup={{
							dependencies: initialDepsRef.current,
						}}
						options={{
							autorun: true,
							autoReload: true,
							recompileMode: "delayed",
							recompileDelay: 300,
							externalResources: ["https://cdn.tailwindcss.com"],
						}}
						theme="auto"
					>
						{/* Incremental file updater - syncs file changes without remount */}
						<SandpackFileUpdater files={sandpackFiles} />

						<div className="relative w-full h-full flex flex-col">
							{/* Preview pane - takes all space minus console */}
							<div className={`flex-1 min-h-0 ${showConsole ? "" : "h-full"}`}>
								<SandpackPreviewPane
									showNavigator={false}
									showRefreshButton={false}
									showOpenInCodeSandbox={false}
									style={{
										height: "100%",
										width: "100%",
									}}
								/>
							</div>

							{/* Console panel (collapsible) */}
							{showConsole && (
								<div className="h-40 flex-shrink-0 border-t border-border bg-background">
									<SandpackConsole
										showHeader={false}
										style={{
											height: "100%",
										}}
									/>
								</div>
							)}

							{/* Refresh button overlay */}
							<div className="absolute top-2 right-2">
								<RefreshButton />
							</div>
						</div>
					</SandpackProvider>
				</div>
			</div>
		</div>
	);
}
