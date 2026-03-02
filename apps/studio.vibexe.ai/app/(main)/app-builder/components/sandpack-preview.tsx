"use client";

/**
 * SandpackPreview Component
 *
 * Live preview of generated React code using Sandpack.
 * Uses SandpackFileSync for incremental updates so the preview stays alive during streaming.
 *
 * Deploy to: /opt/vibexe/apps/studio.vibexe.ai/app/(main)/app-builder/components/sandpack-preview.tsx
 */

import {
	SandpackConsole,
	SandpackPreview as SandpackPreviewPane,
	SandpackProvider,
	useSandpack,
	useSandpackNavigation,
} from "@codesandbox/sandpack-react";
import {
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	ExternalLink,
	Gamepad2,
	Grid3X3,
	Monitor,
	MousePointer2,
	Move,
	RefreshCw,
	RotateCcw,
	RotateCw,
	Scaling,
	Smartphone,
	Tablet,
	Undo2,
	X,
} from "lucide-react";
import { MobilePublishPanel } from "./mobile-publish-panel";
import { PHONE_FRAME, PhoneFrame } from "./phone-frame";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";
import { useVisualEdit } from "../lib/visual-edit-context";
import { useGameEditor, type GizmoMode } from "../lib/game-editor-context";
import { GameEditorPanel } from "./game-editor-panel";
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

export type PreviewMode = "browser" | "mobile-frame";

interface SandpackPreviewProps {
	appId: string;
	files: AppFile[];
	isGenerating?: boolean;
	onFileUpdate?: (fileId: string, content: string) => void;
	onViewChange?: (view: RightPanelView) => void;
	onFileSelect?: (fileId: string) => void;
	previewMode?: PreviewMode;
	projectType?: string;
}

/**
 * Refresh button that triggers Sandpack refresh
 */
function RefreshButton() {
	const { refresh } = useSandpackNavigation();

	return (
		<button
			type="button"
			onClick={() => refresh()}
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
	previewMode = "browser",
	projectType = "app",
}: SandpackPreviewProps) {
	const isMobileFrame = previewMode === "mobile-frame";
	const [device, setDevice] = useState<DeviceSize>(isMobileFrame ? "mobile" : "desktop");
	const [showConsole, setShowConsole] = useState(false);
	const visualEdit = useVisualEdit();
	const gameEditor = useGameEditor();
	const iframeContainerRef = useRef<HTMLDivElement>(null);
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const [iframeBounds, setIframeBounds] = useState<DOMRect | null>(null);
	const [codeViewer, setCodeViewer] = useState<{
		filePath: string;
		content: string;
		lineNumber: number;
	} | null>(null);

	// Detect game mode
	const isGameMode = projectType === "game" || projectType === "game-mobile";

	// Landscape/portrait rotation toggle for mobile-frame mode
	const [isLandscape, setIsLandscape] = useState(false);
	const toggleRotation = useCallback(() => setIsLandscape((v) => !v), []);

	// Phone frame scaling — same physical device always, CSS rotate for landscape
	const mobileContainerRef = useRef<HTMLDivElement>(null);
	const [phoneScale, setPhoneScale] = useState(0.75);
	// The phone frame is always portrait native dimensions
	const frameNativeW = PHONE_FRAME.bezelW + 6;
	const frameNativeH = PHONE_FRAME.bezelH + 12;

	useEffect(() => {
		if (!isMobileFrame) return;
		const container = mobileContainerRef.current;
		if (!container) return;

		const update = () => {
			const cw = container.clientWidth;
			const ch = container.clientHeight;
			if (cw > 0 && ch > 0) {
				const availW = cw - 48;
				const availH = ch - 16;
				if (isLandscape) {
					// Landscape: visual width = frameNativeH, visual height = frameNativeW (swapped)
					setPhoneScale(Math.min(1, availW / frameNativeH, availH / frameNativeW));
				} else {
					// Portrait: visual matches native dimensions
					setPhoneScale(Math.min(1, availW / frameNativeW, availH / frameNativeH));
				}
			}
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(container);
		return () => observer.disconnect();
	}, [isMobileFrame, isLandscape, frameNativeW, frameNativeH]);

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
				gameEditor.setIframeRef(iframeRef as React.RefObject<HTMLIFrameElement | null>);
			}
		};
		findIframe();
		// Observe DOM changes to catch Sandpack iframe insertion
		const observer = new MutationObserver(findIframe);
		observer.observe(container, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, [visualEdit.setIframeRef, gameEditor.setIframeRef]);

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
			// Game editor messages
			else if (data.type === "game-editor-bridge-loaded") {
				console.log("[GameEditor] Bridge loaded in iframe, editor enabled:", gameEditor.enabled);
				// If editor is already enabled (user clicked before bridge loaded), re-send enable
				if (gameEditor.enabled) {
					const iframe = iframeRef.current;
					if (iframe?.contentWindow) {
						console.log("[GameEditor] Re-sending game-editor-enable to bridge");
						iframe.contentWindow.postMessage({ type: "game-editor-enable" }, "*");
					}
				}
			} else if (data.type === "game-editor-scene-tree") {
				gameEditor.updateSceneTree(data.tree);
			} else if (data.type === "game-editor-object-selected") {
				gameEditor.updateSelectedObject({
					uuid: data.uuid,
					name: data.name,
					type: data.objType || data.type,
					position: data.position,
					rotation: data.rotation,
					scale: data.scale,
					visible: data.visible,
					castShadow: data.castShadow,
					userData: data.userData,
					_materialColor: data._materialColor,
				});
			} else if (data.type === "game-editor-object-deselected") {
				gameEditor.updateSelectedObject(null);
			} else if (data.type === "game-editor-gizmo-mode") {
				gameEditor.setGizmoMode(data.mode as GizmoMode);
			} else if (data.type === "game-editor-snap-changed") {
				gameEditor.setSnapEnabled(!!data.snap);
			} else if (data.type === "game-editor-object-duplicated") {
				gameEditor.requestSceneTree();
			}
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, [visualEdit, gameEditor]);

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

	// Forward keyboard shortcuts to bridge when game editor is active
	useEffect(() => {
		if (!gameEditor.enabled) return;
		const handler = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
			if (tag === "input" || tag === "textarea" || tag === "select") return;
			const iframe = iframeRef.current;
			if (!iframe?.contentWindow) return;
			// Forward relevant keys
			const key = e.key.toLowerCase();
			const forwarded = ["f", "g", "w", "e", "r", "escape", "delete", "backspace"].includes(key)
				|| ((e.ctrlKey || e.metaKey) && (key === "z" || key === "d"));
			if (forwarded) {
				iframe.contentWindow.postMessage({
					type: "game-editor-viewport-keydown",
					key: e.key,
					ctrlKey: e.ctrlKey,
					metaKey: e.metaKey,
				}, "*");
				e.preventDefault();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [gameEditor.enabled]);

	// Forward mouse events from parent page to Sandpack iframe via postMessage
	// This is needed because native mouse events don't reliably propagate into cross-origin iframes
	useEffect(() => {
		if (!gameEditor.enabled) return;
		let lastClickTime = 0;
		let dragging = false;

		const getIframeCoords = (e: MouseEvent) => {
			const iframe = iframeRef.current;
			if (!iframe) return null;
			const rect = iframe.getBoundingClientRect();
			return { iframe, rect, x: e.clientX - rect.left, y: e.clientY - rect.top };
		};

		const handleMouseDown = (e: MouseEvent) => {
			if (e.button !== 0) return;
			const info = getIframeCoords(e);
			if (!info) return;
			const { iframe, rect } = info;
			// Only forward clicks that land on the iframe area
			if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
			// Don't forward if clicking on the game editor panel (overlaid on right side)
			const target = e.target as HTMLElement;
			if (target.closest("[data-game-editor-panel]")) return;

			const now = Date.now();
			const isDoubleClick = (now - lastClickTime) < 300;
			lastClickTime = now;
			dragging = true;

			iframe.contentWindow?.postMessage({
				type: "game-editor-viewport-click",
				clientX: info.x,
				clientY: info.y,
				isDoubleClick,
			}, "*");
		};

		const handleMouseMove = (e: MouseEvent) => {
			if (!dragging) return;
			const info = getIframeCoords(e);
			if (!info) return;
			info.iframe.contentWindow?.postMessage({
				type: "game-editor-viewport-mousemove",
				clientX: info.x,
				clientY: info.y,
			}, "*");
		};

		const handleMouseUp = (e: MouseEvent) => {
			if (!dragging) return;
			dragging = false;
			const info = getIframeCoords(e);
			if (!info) return;
			info.iframe.contentWindow?.postMessage({
				type: "game-editor-viewport-mouseup",
				clientX: info.x,
				clientY: info.y,
			}, "*");
		};

		window.addEventListener("mousedown", handleMouseDown, true);
		window.addEventListener("mousemove", handleMouseMove, true);
		window.addEventListener("mouseup", handleMouseUp, true);
		return () => {
			window.removeEventListener("mousedown", handleMouseDown, true);
			window.removeEventListener("mousemove", handleMouseMove, true);
			window.removeEventListener("mouseup", handleMouseUp, true);
		};
	}, [gameEditor.enabled]);

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
	// Phaser CDN loaded when game projects use it (Sandpack's bundler can't handle the 4MB package)
	const externalResources = useMemo(() => {
		const resources = ["https://cdn.tailwindcss.com"];
		if (dependencies.phaser) {
			resources.push("https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js");
		}
		if (dependencies.three) {
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js");
		}
		// Bridge MUST load AFTER Three.js CDN — game editor bridge checks window.THREE on init
		if (typeof window !== "undefined") {
			resources.push(`${window.location.origin}/api/app-builder/bridge?v=7`);
		}
		return resources;
	}, [dependencies, isGameMode]);

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
					{isMobileFrame ? (
						/* Mobile-frame mode: mobile indicator + rotate button */
						<div className="flex items-center gap-1.5">
							<div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl bg-white/[0.08] text-white/90 border border-white/[0.12]">
								<Smartphone className="w-3.5 h-3.5" />
								<span className="hidden sm:inline">Mobile</span>
							</div>
							<button
								type="button"
								onClick={toggleRotation}
								className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl transition-all duration-200 ${
									isLandscape
										? "bg-white/[0.08] text-white/90 border border-white/[0.12]"
										: "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
								}`}
								title={isLandscape ? "Portrait (9:16)" : "Landscape (16:9)"}
							>
								<RotateCw className="w-3.5 h-3.5" />
								<span className="hidden sm:inline">
									{isLandscape ? "Portrait" : "Landscape"}
								</span>
							</button>
						</div>
					) : (
						(Object.keys(DEVICE_SIZES) as DeviceSize[]).map((size) => {
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
						})
					)}
				</div>

				{/* Visual Edit / Scene Editor toggle + Preview link + Actions */}
				<div className="flex items-center gap-2">
					{isGameMode && dependencies.three ? (
						<>
							<button
								type="button"
								onClick={gameEditor.toggleEditor}
								className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl transition-all duration-200 ${
									gameEditor.enabled
										? "bg-emerald-500/[0.15] text-emerald-300 border border-emerald-500/[0.25]"
										: "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
								}`}
								title={gameEditor.enabled ? "Exit Scene Editor" : "Scene Editor"}
							>
								<Gamepad2 className="w-3.5 h-3.5" />
								<span className="hidden sm:inline">Scene Editor</span>
							</button>
							{gameEditor.enabled && (
								<div className="flex items-center gap-0.5 border-l border-white/[0.08] pl-2">
									{([
										{ mode: "translate" as const, icon: Move, label: "Move (W)", key: "W" },
										{ mode: "rotate" as const, icon: RotateCcw, label: "Rotate (E)", key: "E" },
										{ mode: "scale" as const, icon: Scaling, label: "Scale (R)", key: "R" },
									]).map(({ mode, icon: Icon, label, key }) => (
										<button
											key={mode}
											type="button"
											onClick={() => gameEditor.setGizmoMode(mode)}
											className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg transition-all duration-150 ${
												gameEditor.gizmoMode === mode
													? "bg-emerald-500/[0.15] text-emerald-300"
													: "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
											}`}
											title={label}
										>
											<Icon className="w-3.5 h-3.5" />
											<span className="hidden lg:inline">{key}</span>
										</button>
									))}
									<button
										type="button"
										onClick={gameEditor.toggleSnap}
										className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg transition-all duration-150 ${
											gameEditor.snapEnabled
												? "bg-amber-500/[0.15] text-amber-300"
												: "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
										}`}
										title="Grid Snap (G)"
									>
										<Grid3X3 className="w-3.5 h-3.5" />
									</button>
									<button
										type="button"
										onClick={gameEditor.undoAction}
										className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg text-white/35 hover:bg-white/[0.04] hover:text-white/60 transition-all duration-150"
										title="Undo (Ctrl+Z)"
									>
										<Undo2 className="w-3.5 h-3.5" />
									</button>
								</div>
							)}
						</>
					) : (
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
					)}
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
				{isMobileFrame ? (
					/* Mobile frame mode: phone frame (left) + publish panel (right) */
					<div className="flex items-center justify-center gap-6 w-full h-full">
						<div ref={mobileContainerRef} className="flex-1 min-w-0 flex items-center justify-center h-full">
						{/* Scaled phone wrapper — sized to visual footprint (swapped for landscape) */}
						<div className={`flex-shrink-0 relative flex items-center justify-center ${isLandscape ? "overflow-visible" : "overflow-hidden"}`} style={{ width: Math.round((isLandscape ? frameNativeH : frameNativeW) * phoneScale), height: Math.round((isLandscape ? frameNativeW : frameNativeH) * phoneScale) }}>
							<div style={{ width: frameNativeW, height: frameNativeH, transform: `scale(${phoneScale})${isLandscape ? " rotate(-90deg)" : ""}`, transformOrigin: "center center" }}>
						<PhoneFrame>
							<div
								ref={iframeContainerRef}
								className="relative w-full h-full"
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
										{showConsole && (
											<div className="h-32 flex-shrink-0 border-t border-border bg-background">
												<SandpackConsole
													showHeader={false}
													style={{ height: "100%" }}
												/>
											</div>
										)}
										<div className="absolute top-2 right-2">
											<RefreshButton />
										</div>
									</div>
								</SandpackProvider>

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

								{codeViewer && (
									<CodeViewerOverlay
										filePath={codeViewer.filePath}
										content={codeViewer.content}
										lineNumber={codeViewer.lineNumber}
										onClose={() => setCodeViewer(null)}
									/>
								)}
							</div>
						</PhoneFrame>
							</div>
						</div>
						</div>

						<div className="flex-shrink-0 self-center">
							<MobilePublishPanel appId={appId} />
						</div>
					</div>
				) : (
					/* Standard browser mode */
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

						{/* Game Editor Panel (overlaid on right side) */}
						{gameEditor.enabled && isGameMode && (
							<GameEditorPanel />
						)}
					</div>
				)}
			</div>
		</div>
	);
}
