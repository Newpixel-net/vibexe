"use client";

/**
 * GameRuntimeIframe — Lightweight iframe replacement for Sandpack in game mode.
 *
 * Instead of running CodeSandbox's in-browser bundler (sandpack), this component:
 * 1. Loads a lightweight same-origin HTML page (/api/app-builder/game-runtime)
 * 2. Compiles game code server-side via /api/app-builder/compile (esbuild)
 * 3. Injects the compiled bundle into the iframe via postMessage
 *
 * Eliminates ~15-20 FPS overhead from in-browser bundling, CJS shims, and cross-origin restrictions.
 * Target: 34 FPS → 55-60 FPS.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { AppFile } from "../adapters/file-adapter";
import type { GameSettings } from "../lib/game-editor-context";

interface GameRuntimeIframeProps {
	appId: string;
	files: AppFile[];
	gameSettings: GameSettings;
	enabledModuleIds: string[];
	iframeRef: RefObject<HTMLIFrameElement | null>;
	onBundleLoaded?: () => void;
	/** Parent can call refreshRef.current() to force recompile (equivalent to Sandpack refresh) */
	refreshRef?: MutableRefObject<(() => void) | null>;
	/** When true, skip automatic recompile on file changes (scene editor active) */
	suppressRecompile?: boolean;
	/** Override the runtime URL (default: 3D runtime). Use for 2D games. */
	runtimeUrl?: string;
	/** When true, hide iframe (display:none) to free GPU during AI generation */
	isGenerating?: boolean;
}

export function GameRuntimeIframe({
	appId,
	files,
	gameSettings,
	enabledModuleIds,
	iframeRef,
	onBundleLoaded,
	refreshRef,
	suppressRecompile,
	runtimeUrl,
	isGenerating,
}: GameRuntimeIframeProps) {
	const [compileError, setCompileError] = useState<string | null>(null);
	const [isCompiling, setIsCompiling] = useState(false);
	const runtimeReady = useRef(false);
	const lastHash = useRef<string>("");
	const compileTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingBundle = useRef<{ bundle: string; bootstrap: string } | null>(null);
	const hasTriggeredCompile = useRef(false);
	const compileInProgress = useRef(false);
	const needsRecompile = useRef(false);
	const lastContentHash = useRef<string>("");

	// Store gameSettings in a ref so compileAndInject doesn't depend on it
	// (gameSettings creates a new object reference on every update, which would
	// cause compileAndInject identity to change and trigger recompile loops)
	const gameSettingsRef = useRef(gameSettings);
	gameSettingsRef.current = gameSettings;

	// Store files in a ref so compileAndInject has a stable identity.
	// The file-change useEffect watches `files` directly and calls compileAndInject.
	const filesRef = useRef(files);
	filesRef.current = files;

	// Store suppressRecompile in a ref so the file-change useEffect doesn't
	// re-trigger when only the mode (Scene↔Game) changes with no file edits.
	// This prevents the #1 source of freezes: a full 20-file recompile on every toggle.
	const suppressRecompileRef = useRef(suppressRecompile);
	suppressRecompileRef.current = suppressRecompile;

	// Ref for compileAndInject so the generation-end effect doesn't depend on it
	const compileAndInjectRef = useRef<() => void>(() => {});

	// Compile game code server-side
	const compileAndInject = useCallback(async () => {
		const currentFiles = filesRef.current;
		if (!currentFiles.length) return;

		// Quick content hash to skip redundant compile API calls on page load
		// (React re-renders change the files array reference without changing content)
		const contentKey = currentFiles
			.filter((f) => f.content != null)
			.map((f) => f.path + ":" + f.content!.length)
			.join("|");
		if (contentKey === lastContentHash.current && lastHash.current) {
			return; // Files unchanged and we already have a bundle — skip
		}
		lastContentHash.current = contentKey;

		// Prevent overlapping compiles (Scene→Game toggle fires multiple triggers)
		if (compileInProgress.current) {
			console.log("[GameRuntime] Compile already in progress, queuing recompile");
			needsRecompile.current = true;
			return;
		}
		compileInProgress.current = true;

		setIsCompiling(true);
		setCompileError(null);

		try {
			const compileFiles = currentFiles
				.filter((f) => f.content != null)
				.map((f) => ({
					path: f.path.startsWith("/") ? f.path : `/${f.path}`,
					content: f.content!,
				}));

			// Find settings file (may be at root or in src/ prefix)
			const settingsFile = currentFiles.find(
				(f) => f.path.endsWith("__game-settings.json"),
			);
			const settings = settingsFile?.content
				? JSON.parse(settingsFile.content)
				: gameSettingsRef.current || {};

			// Merge animation clip overrides from parent (stored separately via API, not in settings file)
			const parentOverrides = gameSettingsRef.current?.animClipOverrides;
			if (parentOverrides && typeof parentOverrides === "object" && Object.keys(parentOverrides).length > 0) {
				settings.animClipOverrides = parentOverrides;
			}

			console.log(`[GameRuntime] Compiling ${compileFiles.length} files...`);

			const resp = await fetch("/api/app-builder/compile", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					files: compileFiles,
					settings,
					enabledModuleIds,
					appId,
					apiOrigin: window.location.origin,
				}),
			});

			if (!resp.ok) {
				const errorText = await resp.text();
				console.error("[GameRuntime] Compile request failed:", resp.status, errorText);
				setCompileError(`Compile failed (${resp.status}): ${errorText}`);
				setIsCompiling(false);
				return;
			}

			const result = await resp.json();

			if (result.errors?.length && !result.bundle) {
				console.error("[GameRuntime] Compile errors:", result.errors);
				setCompileError(result.errors.join("\n"));
				setIsCompiling(false);
				return;
			}

			if (result.hash === lastHash.current) {
				// No changes — skip injection
				setIsCompiling(false);
				return;
			}
			lastHash.current = result.hash;

			// Inject into iframe
			const iframe = iframeRef.current;
			if (iframe?.contentWindow && runtimeReady.current) {
				console.log("[GameRuntime] Injecting bundle into iframe...");
				injectBundle(iframe.contentWindow, result.bootstrap, result.bundle);
			} else {
				console.log("[GameRuntime] Runtime not ready yet, saving bundle for later injection");
				// Save for when runtime becomes ready
				pendingBundle.current = { bundle: result.bundle, bootstrap: result.bootstrap };
			}

			if (result.errors?.length) {
				console.warn("[GameRuntime] Compilation warnings:", result.errors);
			}

			console.log(`[GameRuntime] Compiled in ${result.compiledMs}ms`);
		} catch (err) {
			setCompileError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsCompiling(false);
			compileInProgress.current = false;
			// If a recompile was requested while we were compiling, do it now
			if (needsRecompile.current) {
				needsRecompile.current = false;
				// Don't reset lastHash — let the hash check prevent redundant injections
				// if the code hasn't actually changed between compiles
				console.log("[GameRuntime] Running queued recompile");
				setTimeout(() => compileAndInject(), 100);
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps -- filesRef used intentionally for stable identity
	}, [enabledModuleIds, appId, iframeRef]);

	// Expose refresh function to parent (force recompile, clear hash to bypass cache)
	useEffect(() => {
		if (!refreshRef) return;
		refreshRef.current = () => {
			lastHash.current = ""; // Clear hash to force re-injection
			lastContentHash.current = ""; // Clear content hash to force recompile
			compileAndInject();
		};
		return () => { refreshRef.current = null; };
	}, [compileAndInject, refreshRef]);

	function injectBundle(win: Window, bootstrap: string, bundle: string) {
		win.postMessage({ type: "vibexe-inject-bootstrap", code: bootstrap }, "*");
		// Small delay to let bootstrap execute before bundle
		setTimeout(() => {
			win.postMessage({ type: "vibexe-inject-bundle", code: bundle }, "*");
		}, 50);
	}

	// Listen for runtime-ready and bundle-loaded messages
	useEffect(() => {
		function onMessage(ev: MessageEvent) {
			if (!ev.data?.type) return;

			if (ev.data.type === "vibexe-runtime-ready") {
				runtimeReady.current = true;
				// If we have a pending bundle, inject it now
				if (pendingBundle.current) {
					const iframe = iframeRef.current;
					if (iframe?.contentWindow) {
						injectBundle(
							iframe.contentWindow,
							pendingBundle.current.bootstrap,
							pendingBundle.current.bundle,
						);
						pendingBundle.current = null;
					}
				} else if (!hasTriggeredCompile.current) {
					// First load — compile now
					hasTriggeredCompile.current = true;
					compileAndInject();
				}
			}

			if (ev.data.type === "vibexe-runtime-bundle-loaded") {
				onBundleLoaded?.();
			}
		}

		window.addEventListener("message", onMessage);

		// Fallback: if runtime-ready was already sent before listener attached,
		// check via iframe contentWindow and force compile after a timeout
		const fallbackTimer = setTimeout(() => {
			if (!runtimeReady.current) {
				const iframe = iframeRef.current;
				const iframeWin = iframe?.contentWindow as Window & { __vibexe_libs_ready__?: boolean } | null;
				if (iframeWin?.__vibexe_libs_ready__) {
					console.log("[GameRuntime] Fallback: runtime was ready but message was missed");
					runtimeReady.current = true;
					hasTriggeredCompile.current = true;
					// Inject pending bundle if one exists (from compile that finished while runtime wasn't ready)
					if (pendingBundle.current && iframe?.contentWindow) {
						console.log("[GameRuntime] Fallback: injecting pending bundle");
						injectBundle(iframe.contentWindow, pendingBundle.current.bootstrap, pendingBundle.current.bundle);
						pendingBundle.current = null;
					} else {
						compileAndInject();
					}
				}
			}
		}, 3000);

		return () => {
			window.removeEventListener("message", onMessage);
			clearTimeout(fallbackTimer);
		};
	}, [compileAndInject, iframeRef, onBundleLoaded]);

	// Keep ref in sync so generation-end effect can call it without a dependency
	compileAndInjectRef.current = compileAndInject;

	// Single recompile when AI generation ends — replaces all suppressed intermediate compiles
	const prevIsGenerating = useRef(isGenerating);
	useEffect(() => {
		if (prevIsGenerating.current && !isGenerating) {
			console.log("[GameRuntime] Generation ended, triggering single recompile");
			lastHash.current = "";
			lastContentHash.current = "";
			const timer = setTimeout(() => compileAndInjectRef.current(), 300);
			return () => clearTimeout(timer);
		}
		prevIsGenerating.current = isGenerating;
	}, [isGenerating]);

	// Recompile when files change (debounced 500ms)
	// suppressRecompile is read from a ref — mode toggle (Scene↔Game) no longer
	// triggers this effect, only actual file content changes do.
	useEffect(() => {
		if (!runtimeReady.current) return;
		if (suppressRecompileRef.current) return;

		if (compileTimeout.current) {
			clearTimeout(compileTimeout.current);
		}

		compileTimeout.current = setTimeout(() => {
			compileAndInject();
		}, 500);

		return () => {
			if (compileTimeout.current) {
				clearTimeout(compileTimeout.current);
			}
		};
	}, [files, compileAndInject]);

	// Forward keyboard events to game iframe — always active unless user is typing in a text field.
	// Previous approach (gameActive state + click detection) failed because clicks inside
	// the iframe never bubble to the parent wrapper div, so forwarding never activated.
	useEffect(() => {
		const forward = (e: KeyboardEvent) => {
			try {
				const win = iframeRef.current?.contentWindow;
				if (!win) return;
				// Don't forward when user is typing in chat, search, or any text input
				const el = document.activeElement;
				if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)) return;
				win.dispatchEvent(new KeyboardEvent(e.type, {
					key: e.key, code: e.code, keyCode: e.keyCode,
					shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey,
					bubbles: true, cancelable: true,
				}));
				// Prevent parent page scrolling on game keys
				if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
			} catch(err) {}
		};
		window.addEventListener('keydown', forward);
		window.addEventListener('keyup', forward);
		return () => {
			window.removeEventListener('keydown', forward);
			window.removeEventListener('keyup', forward);
		};
	}, [iframeRef]);

	return (
		<div className="relative w-full h-full">
			<iframe
				ref={iframeRef}
				src={runtimeUrl || "/api/app-builder/game-runtime?bv=191"}
				className="w-full h-full border-0"
				style={isGenerating ? { display: "none" } : undefined}
				title="Game Preview"
				allow="autoplay; fullscreen; webgpu"
			/>

			{/* Compile status overlay */}
			{isCompiling && (
				<div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white/70 text-[10px] rounded-md pointer-events-none">
					Compiling...
				</div>
			)}

			{/* Error overlay */}
			{compileError && (
				<div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
					<div className="max-w-md bg-red-950/90 border border-red-500/30 rounded-lg p-4">
						<div className="text-red-300 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">
							{compileError}
						</div>
						<button
							type="button"
							onClick={() => {
								setCompileError(null);
								compileAndInject();
							}}
							className="mt-3 px-3 py-1 text-xs bg-red-500/20 text-red-300 rounded hover:bg-red-500/30"
						>
							Retry
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
