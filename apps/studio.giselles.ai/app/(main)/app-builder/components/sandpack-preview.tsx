"use client";

/**
 * SandpackPreview Component
 *
 * Live preview of generated React code using Sandpack.
 * Uses SandpackFileSync for incremental updates so the preview stays alive during streaming.
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
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	ExternalLink,
	Monitor,
	MousePointer2,
	RefreshCw,
	Smartphone,
	Tablet,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";
import { useVisualEdit } from "../lib/visual-edit-context";
import type { RightPanelView } from "./right-panel-tabs";
import { VisualEditToolbar } from "./visual-edit-toolbar";
import {
	type SandpackFiles,
	type SandpackLanguageConfig,
	convertToSandpackFiles,
	extractDependencies,
} from "../adapters/sandpack-adapter";
import { isRtlLanguage } from "../lib/languages";

type DeviceSize = "desktop" | "tablet" | "mobile";

const DEVICE_SIZES: Record<DeviceSize, { width: number; label: string }> = {
	desktop: { width: 1280, label: "Desktop" },
	tablet: { width: 768, label: "Tablet" },
	mobile: { width: 375, label: "Mobile" },
};

interface SandpackPreviewProps {
	appId: string;
	files: AppFile[];
	isGenerating?: boolean;
	onFileUpdate?: (fileId: string, content: string) => void;
	onViewChange?: (view: RightPanelView) => void;
	onFileSelect?: (fileId: string) => void;
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
 * Inner component that syncs file changes to Sandpack via imperative API.
 * Lives inside SandpackProvider to access useSandpack() hook.
 * Debounces rapid updates to avoid race conditions during streaming.
 */
function SandpackFileSync({ files }: { files: SandpackFiles }) {
	const { sandpack } = useSandpack();
	const prevFilesRef = useRef<SandpackFiles>(files);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const prev = prevFilesRef.current;
		const updates: Array<[string, string]> = [];
		const deletes: string[] = [];

		for (const [path, file] of Object.entries(files)) {
			const code = typeof file === "string" ? file : file.code;
			const prevFile = prev[path];
			const prevCode = prevFile
				? typeof prevFile === "string"
					? prevFile
					: prevFile.code
				: undefined;

			if (prevCode !== code) {
				updates.push([path, code]);
			}
		}

		for (const path of Object.keys(prev)) {
			if (!(path in files)) {
				deletes.push(path);
			}
		}

		prevFilesRef.current = { ...files };

		if (updates.length === 0 && deletes.length === 0) return;

		// Debounce: clear pending flush and schedule new one
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			for (const [path, code] of updates) {
				sandpack.updateFile(path, code);
			}
			for (const path of deletes) {
				sandpack.deleteFile(path);
			}
		}, 300);
	}, [files, sandpack]);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	return null;
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
 * Inline preview link in the toolbar - auto-enables share and shows a clickable URL with copy.
 */
function PreviewLink({ appId }: { appId: string }) {
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	// On mount, fetch or create share URL
	useEffect(() => {
		let cancelled = false;

		async function ensureShare() {
			try {
				// Check existing
				const getRes = await fetch(`/api/app-builder/apps/${appId}/share`);
				const getData = await getRes.json();
				if (getData.shareUrl) {
					if (!cancelled) setShareUrl(getData.shareUrl);
					return;
				}
				// Auto-enable
				const postRes = await fetch(`/api/app-builder/apps/${appId}/share`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ enabled: true }),
				});
				const postData = await postRes.json();
				if (!cancelled && postData.shareUrl) {
					setShareUrl(postData.shareUrl);
				}
			} catch {
				// Silently fail
			}
		}

		ensureShare();
		return () => { cancelled = true; };
	}, [appId]);

	const handleCopy = useCallback(async () => {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API may fail in some contexts
		}
	}, [shareUrl]);

	if (!shareUrl) return null;

	// Show shortened URL (strip https://)
	const displayUrl = shareUrl.replace(/^https?:\/\//, "");
	const truncated =
		displayUrl.length > 35
			? `${displayUrl.slice(0, 32)}...`
			: displayUrl;

	return (
		<div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50">
			<ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
			<a
				href={shareUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="text-xs text-muted-foreground hover:text-foreground truncate max-w-[200px]"
				title={shareUrl}
			>
				{truncated}
			</a>
			<button
				type="button"
				onClick={handleCopy}
				className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
				title={copied ? "Copied!" : "Copy link"}
			>
				{copied ? (
					<Check className="w-3 h-3 text-green-500" />
				) : (
					<Copy className="w-3 h-3" />
				)}
			</button>
		</div>
	);
}

/**
 * Code Viewer Overlay — shows source code with highlighted line
 * when "View in Code" is clicked from the Visual Edit toolbar.
 */
function CodeViewerOverlay({
	filePath,
	content,
	lineNumber,
	onClose,
}: {
	filePath: string;
	content: string;
	lineNumber: number;
	onClose: () => void;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const highlightRef = useRef<HTMLDivElement>(null);

	// Scroll to highlighted line after mount
	useEffect(() => {
		setTimeout(() => {
			highlightRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
		}, 50);
	}, []);

	// Close on Escape
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);

	const lines = content.split("\n");

	return (
		<div
			className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
			role="dialog"
			aria-modal="true"
			aria-label={`Source: ${filePath}`}
		>
			<div className="bg-[#0f0f1a] border border-white/[0.12] rounded-2xl w-[90%] max-w-3xl max-h-[80%] flex flex-col overflow-hidden shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
					<div className="flex items-center gap-2">
						<span className="text-xs font-mono text-violet-400">{filePath}</span>
						<span className="text-[10px] text-white/25">:{lineNumber}</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
				{/* Code area */}
				<div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-xs leading-5">
					{lines.map((line, idx) => {
						const ln = idx + 1;
						const isHighlighted = ln === lineNumber;
						return (
							<div
								key={ln}
								ref={isHighlighted ? highlightRef : undefined}
								className={`flex ${isHighlighted ? "bg-violet-500/15 border-l-2 border-violet-500" : "border-l-2 border-transparent hover:bg-white/[0.02]"}`}
							>
								<span className={`select-none w-12 text-right pr-3 flex-shrink-0 ${isHighlighted ? "text-violet-400" : "text-white/20"}`}>
									{ln}
								</span>
								<pre className="text-white/70 whitespace-pre overflow-x-auto pr-4">
									{line || " "}
								</pre>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

/**
 * Main preview component with responsive toggles and console.
 * No key on SandpackProvider - SandpackFileSync handles incremental
 * updates so the preview iframe stays alive during streaming.
 */
export function SandpackPreview({
	appId,
	files,
	isGenerating,
	onFileUpdate,
	onViewChange,
	onFileSelect,
}: SandpackPreviewProps) {
	const [device, setDevice] = useState<DeviceSize>("desktop");
	const [showConsole, setShowConsole] = useState(false);
	const visualEdit = useVisualEdit();
	const iframeContainerRef = useRef<HTMLDivElement>(null);
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const [iframeBounds, setIframeBounds] = useState<DOMRect | null>(null);
	const [codeViewer, setCodeViewer] = useState<{
		filePath: string;
		content: string;
		lineNumber: number;
	} | null>(null);

	// View in Code callback for the toolbar
	const handleViewInCode = useCallback(
		(fileId: string, filePath: string, lineNumber: number) => {
			const file = files.find((f) => f.id === fileId);
			if (file?.content) {
				setCodeViewer({ filePath, content: file.content, lineNumber });
			}
		},
		[files],
	);

	// Register iframe ref with context once mounted
	useEffect(() => {
		// Query the Sandpack iframe
		const container = iframeContainerRef.current;
		if (!container) return;
		const findIframe = () => {
			const iframe = container.querySelector("iframe");
			if (iframe && iframe !== iframeRef.current) {
				iframeRef.current = iframe;
				visualEdit.setIframeRef(iframeRef as React.RefObject<HTMLIFrameElement | null>);
			}
		};
		findIframe();
		// Observe DOM changes to catch Sandpack iframe insertion
		const observer = new MutationObserver(findIframe);
		observer.observe(container, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, [visualEdit.setIframeRef]);

	// Update iframe bounds when selection changes or window resizes
	useEffect(() => {
		if (!visualEdit.selectedElement || !iframeRef.current) {
			setIframeBounds(null);
			return;
		}
		const updateBounds = () => {
			if (iframeRef.current) {
				setIframeBounds(iframeRef.current.getBoundingClientRect());
			}
		};
		updateBounds();
		window.addEventListener("resize", updateBounds);
		window.addEventListener("scroll", updateBounds);
		return () => {
			window.removeEventListener("resize", updateBounds);
			window.removeEventListener("scroll", updateBounds);
		};
	}, [visualEdit.selectedElement]);

	// Listen for postMessage from Sandpack iframe
	useEffect(() => {
		const handler = (e: MessageEvent) => {
			const data = e.data;
			if (!data || typeof data !== "object" || !data.type) return;
			if (data.type === "visual-edit-select") {
				visualEdit.selectElement({
					tagName: data.tagName,
					className: data.className,
					textContent: data.textContent,
					innerHTML: data.innerHTML,
					boundingRect: data.boundingRect,
					selector: data.selector,
					computedStyles: data.computedStyles,
					isDynamicContent: data.isDynamicContent,
				});
				// Update iframe bounds when an element is selected
				if (iframeRef.current) {
					setIframeBounds(iframeRef.current.getBoundingClientRect());
				}
			} else if (data.type === "visual-edit-deselect") {
				visualEdit.deselectElement();
			}
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, [visualEdit]);

	// Keyboard shortcuts for visual edit
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			// Don't intercept if focus is in an input/textarea
			const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
			if (tag === "input" || tag === "textarea" || tag === "select") return;

			if (e.key === "Escape" && visualEdit.enabled) {
				if (visualEdit.selectedElement) {
					visualEdit.deselectElement();
				} else {
					visualEdit.setEnabled(false);
				}
				e.preventDefault();
			}
			if (e.key === "v" && !e.ctrlKey && !e.metaKey && !e.altKey) {
				visualEdit.toggleVisualEdit();
				e.preventDefault();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [visualEdit]);

	// Detect language from generated files (Blueprint.md or App.tsx may contain lang hints)
	const langConfig = useMemo((): SandpackLanguageConfig | undefined => {
		for (const f of files) {
			if (!f.content) continue;
			// Check for explicit lang/dir markers the AI may have included
			const langMatch = f.content.match(/(?:lang|language)[=:]\s*["']?([a-z]{2}(?:-[A-Z]{2})?)["']?/i);
			const dirMatch = f.content.match(/dir[=:]\s*["']?(rtl|ltr)["']?/i);
			if (langMatch) {
				const code = langMatch[1].toLowerCase();
				return { lang: code, dir: isRtlLanguage(code) ? "rtl" : "ltr" };
			}
			if (dirMatch && dirMatch[1].toLowerCase() === "rtl") {
				// RTL detected but no specific lang — check content for Hebrew/Arabic chars
				const allContent = files.map((x) => x.content || "").join("");
				const hebrewCount = (allContent.match(/[\u0590-\u05FF]/g) || []).length;
				const arabicCount = (allContent.match(/[\u0600-\u06FF]/g) || []).length;
				const lang = hebrewCount > arabicCount ? "he" : arabicCount > 0 ? "ar" : "he";
				return { lang, dir: "rtl" };
			}
		}
		// Scan all file content for non-Latin script to auto-detect
		const allText = files.map((f) => f.content || "").join("");
		const hebrewChars = (allText.match(/[\u0590-\u05FF]/g) || []).length;
		const arabicChars = (allText.match(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
		const cjkChars = (allText.match(/[\u4E00-\u9FFF\u3040-\u30FF]/g) || []).length;
		if (hebrewChars > 20) return { lang: "he", dir: "rtl" };
		if (arabicChars > 20) return { lang: "ar", dir: "rtl" };
		if (cjkChars > 20) return { lang: "zh", dir: "ltr" };
		return undefined; // Default English LTR
	}, [files]);

	// Convert files to Sandpack format
	// Pass the real origin so the SDK calls vibexe.online APIs (not the Sandpack iframe's origin)
	const apiOrigin = typeof window !== "undefined" ? window.location.origin : "";
	const sandpackFiles = useMemo(() => convertToSandpackFiles(files, langConfig, apiOrigin, appId), [files, langConfig, apiOrigin, appId]);
	const dependencies = useMemo(() => extractDependencies(files), [files]);

	// Visual Edit bridge loaded as external script (bypasses Sandpack's bundler)
	const externalResources = useMemo(() => {
		const resources = ["https://cdn.tailwindcss.com"];
		if (typeof window !== "undefined") {
			resources.push(`${window.location.origin}/api/app-builder/bridge`);
		}
		return resources;
	}, []);

	// Calculate preview width based on device
	const previewWidth = DEVICE_SIZES[device].width;

	return (
		<div className="flex-1 flex flex-col min-h-0 bg-transparent">
			{/* Inject Sandpack styles */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Internal CSS string constant, not user input */}
			<style dangerouslySetInnerHTML={{ __html: sandpackFullHeightStyles }} />

			{/* Glass toolbar */}
			<div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.03]">
				{/* Glass device toggles */}
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
								className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl transition-all duration-200 ${
									isActive
										? "bg-white/[0.08] text-white/90 border border-white/[0.12]"
										: "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
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

				{/* Visual Edit toggle + Preview link + Actions */}
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={visualEdit.toggleVisualEdit}
						className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl transition-all duration-200 ${
							visualEdit.enabled
								? "bg-violet-500/[0.15] text-violet-300 border border-violet-500/[0.25]"
								: "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
						}`}
						title={visualEdit.enabled ? "Disable Visual Edit (V)" : "Enable Visual Edit (V)"}
					>
						<MousePointer2 className="w-3.5 h-3.5" />
						<span className="hidden sm:inline">Visual Edit</span>
					</button>
					<PreviewLink appId={appId} />
					<button
						type="button"
						onClick={() => setShowConsole(!showConsole)}
						className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-xl transition-all duration-200 ${
							showConsole
								? "bg-white/[0.08] text-white/90 border border-white/[0.12]"
								: "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
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
					ref={iframeContainerRef}
					className="bg-background rounded-lg shadow-lg overflow-hidden flex-1 min-h-0 transition-all duration-200 mx-auto relative"
					style={{
						width: device === "desktop" ? "100%" : previewWidth,
						maxWidth: "100%",
					}}
				>
					<SandpackProvider
						template="react-ts"
						files={sandpackFiles}
						customSetup={{
							dependencies,
						}}
						options={{
							autorun: true,
							autoReload: true,
							recompileMode: "delayed",
							recompileDelay: 300,
							externalResources,
						}}
						theme="auto"
					>
						<SandpackFileSync files={sandpackFiles} />
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

							{/* Generating overlay — glass with spinner */}
							{isGenerating && (
								<div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-md bg-black/40">
									<div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/[0.06] border border-white/[0.1]">
										<div className="relative h-10 w-10">
											<div className="absolute inset-0 rounded-full border-2 border-white/[0.1]" />
											<div className="absolute inset-0 rounded-full border-2 border-t-violet-500 animate-spin" />
										</div>
										<p className="text-sm font-medium text-white/50">Generating app...</p>
									</div>
								</div>
							)}

							{/* Refresh button overlay */}
							<div className="absolute top-2 right-2">
								<RefreshButton />
							</div>
						</div>
					</SandpackProvider>

					{/* Visual Edit Toolbar (floating overlay) */}
					{visualEdit.enabled && visualEdit.selectedElement && (
						<VisualEditToolbar
							iframeBounds={iframeBounds}
							files={files}
							onFileUpdate={onFileUpdate || (() => {})}
							onViewChange={onViewChange || (() => {})}
							onFileSelect={onFileSelect || (() => {})}
							onViewInCode={handleViewInCode}
						/>
					)}

					{/* Code Viewer Overlay */}
					{codeViewer && (
						<CodeViewerOverlay
							filePath={codeViewer.filePath}
							content={codeViewer.content}
							lineNumber={codeViewer.lineNumber}
							onClose={() => setCodeViewer(null)}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
