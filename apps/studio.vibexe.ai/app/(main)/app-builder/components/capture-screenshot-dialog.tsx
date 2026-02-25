"use client";

/**
 * CaptureScreenshotDialog
 *
 * Self-contained dialog that loads an app's files into a hidden Sandpack preview,
 * captures a screenshot via the bridge script, and saves it as the app's thumbnail.
 * Used from the app card 3-dot menu on the /app-builder list page.
 */

import {
	SandpackPreview as SandpackPreviewPane,
	SandpackProvider,
} from "@codesandbox/sandpack-react";
import { Camera, Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";
import {
	convertToSandpackFiles,
	extractDependencies,
} from "../adapters/sandpack-adapter";

type CapturePhase =
	| "loading-files"
	| "compiling"
	| "capturing"
	| "uploading"
	| "done"
	| "error";

const PHASE_LABELS: Record<CapturePhase, string> = {
	"loading-files": "Loading app files...",
	compiling: "Compiling preview...",
	capturing: "Capturing screenshot...",
	uploading: "Saving screenshot...",
	done: "Screenshot captured!",
	error: "Capture failed",
};

interface CaptureScreenshotDialogProps {
	appId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCaptured: () => void;
}

export function CaptureScreenshotDialog({
	appId,
	open,
	onOpenChange,
	onCaptured,
}: CaptureScreenshotDialogProps) {
	const [phase, setPhase] = useState<CapturePhase>("loading-files");
	const [files, setFiles] = useState<AppFile[] | null>(null);
	const [errorMsg, setErrorMsg] = useState("");
	const abortRef = useRef(false);
	const captureTriggeredRef = useRef(false);

	// Reset state on open
	useEffect(() => {
		if (open) {
			setPhase("loading-files");
			setFiles(null);
			setErrorMsg("");
			abortRef.current = false;
			captureTriggeredRef.current = false;
		}
	}, [open]);

	// Step 1: Fetch files when dialog opens
	useEffect(() => {
		if (!open) return;
		let cancelled = false;

		(async () => {
			try {
				const res = await fetch(`/api/app-builder/apps/${appId}/files`);
				if (!res.ok) throw new Error("Failed to fetch files");
				const data = await res.json();
				if (cancelled || abortRef.current) return;
				if (!data.files || data.files.length === 0) {
					setErrorMsg("No files found in this app");
					setPhase("error");
					return;
				}
				setFiles(data.files);
				setPhase("compiling");
			} catch (e) {
				if (cancelled || abortRef.current) return;
				setErrorMsg(e instanceof Error ? e.message : "Failed to load files");
				setPhase("error");
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [open, appId]);

	// Step 2: Poll for iframe content to be rendered, then wait 1.5s extra for animations
	useEffect(() => {
		if (phase !== "compiling" || !files) return;
		captureTriggeredRef.current = false;

		let cancelled = false;
		let pollTimer: ReturnType<typeof setInterval>;
		let readyTimer: ReturnType<typeof setTimeout>;

		const checkReady = () => {
			if (cancelled || abortRef.current) return;
			try {
				const iframe = document.querySelector(
					".capture-dialog-sandpack iframe.sp-preview-iframe",
				) as HTMLIFrameElement | null;
				if (!iframe?.contentWindow?.document?.body) return;
				const body = iframe.contentWindow.document.body;
				const root = body.querySelector("#root");
				// Check if React has mounted content (root has children beyond empty)
				if (root && root.children.length > 0 && root.innerHTML.length > 100) {
					clearInterval(pollTimer);
					// Wait 1.5s more for CSS/animations to settle
					readyTimer = setTimeout(() => {
						if (!cancelled && !abortRef.current) {
							triggerCapture();
						}
					}, 1500);
				}
			} catch {
				// Cross-origin access may fail, fall back to timer
			}
		};

		// Start polling every 500ms, with a hard fallback at 8s
		pollTimer = setInterval(checkReady, 500);
		const fallback = setTimeout(() => {
			if (!cancelled && !abortRef.current && !captureTriggeredRef.current) {
				clearInterval(pollTimer);
				triggerCapture();
			}
		}, 8000);

		return () => {
			cancelled = true;
			clearInterval(pollTimer);
			clearTimeout(readyTimer);
			clearTimeout(fallback);
		};
	}, [phase, files]);

	const triggerCapture = useCallback(() => {
		if (captureTriggeredRef.current) return;
		captureTriggeredRef.current = true;

		const iframe = document.querySelector(
			".capture-dialog-sandpack iframe.sp-preview-iframe",
		) as HTMLIFrameElement | null;

		if (!iframe?.contentWindow) {
			setErrorMsg("Preview iframe not available");
			setPhase("error");
			return;
		}

		setPhase("capturing");

		const handler = async (e: MessageEvent) => {
			if (e.data?.type === "vibexe-capture-result") {
				window.removeEventListener("message", handler);
				if (abortRef.current) return;
				await uploadCapture(e.data.dataUrl);
			} else if (e.data?.type === "vibexe-capture-error") {
				window.removeEventListener("message", handler);
				if (abortRef.current) return;
				setErrorMsg(e.data.error || "Capture failed");
				setPhase("error");
			}
		};

		window.addEventListener("message", handler);
		iframe.contentWindow.postMessage({ type: "vibexe-capture" }, "*");

		// Safety timeout
		setTimeout(() => {
			window.removeEventListener("message", handler);
			if (phase === "capturing" && !abortRef.current) {
				setErrorMsg("Capture timed out");
				setPhase("error");
			}
		}, 15000);
	}, [appId]);

	// Step 3: Upload captured images
	const uploadCapture = useCallback(
		async (dataUrl: string) => {
			if (abortRef.current) return;
			setPhase("uploading");

			try {
				// Create thumbnail (800x450 crop from top)
				const thumbnailBlob = await resizeToThumbnail(dataUrl);

				// Upload fullpage
				const fpBlob = await (await fetch(dataUrl)).blob();
				const fpForm = new FormData();
				fpForm.append(
					"file",
					new File([fpBlob], "_app-screenshot-fullpage.png", {
						type: "image/png",
					}),
				);
				fpForm.append("path", "_app-screenshot-fullpage.png");
				const fpRes = await fetch(`/api/apps/${appId}/storage`, {
					method: "POST",
					body: fpForm,
				});
				if (!fpRes.ok) throw new Error("Fullpage upload failed");
				const fpData = await fpRes.json();
				const fullpageUrl =
					fpData.url ||
					`/api/apps/${appId}/storage/_app-screenshot-fullpage.png`;

				// Upload thumbnail
				const thumbForm = new FormData();
				thumbForm.append(
					"file",
					new File([thumbnailBlob], "_app-screenshot-thumb.png", {
						type: "image/png",
					}),
				);
				thumbForm.append("path", "_app-screenshot-thumb.png");
				const thumbRes = await fetch(`/api/apps/${appId}/storage`, {
					method: "POST",
					body: thumbForm,
				});
				if (!thumbRes.ok) throw new Error("Thumbnail upload failed");
				const thumbData = await thumbRes.json();
				const thumbnailUrl =
					thumbData.url ||
					`/api/apps/${appId}/storage/_app-screenshot-thumb.png`;

				// Save URLs to app
				await fetch(`/api/apps/${appId}/screenshot`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ thumbnailUrl, fullpageUrl }),
				});

				if (abortRef.current) return;
				setPhase("done");

				// Auto-close after success
				setTimeout(() => {
					if (!abortRef.current) {
						onOpenChange(false);
						onCaptured();
					}
				}, 1000);
			} catch (e) {
				if (abortRef.current) return;
				setErrorMsg(e instanceof Error ? e.message : "Upload failed");
				setPhase("error");
			}
		},
		[appId, onOpenChange, onCaptured],
	);

	const handleClose = useCallback(() => {
		abortRef.current = true;
		onOpenChange(false);
	}, [onOpenChange]);

	if (!open) return null;

	const apiOrigin =
		typeof window !== "undefined" ? window.location.origin : "";
	const sandpackFiles = files
		? convertToSandpackFiles(files, undefined, apiOrigin, appId)
		: null;
	const dependencies = files ? extractDependencies(files) : {};
	const externalResources = [
		"https://cdn.tailwindcss.com",
		...(typeof window !== "undefined"
			? [`${window.location.origin}/api/app-builder/bridge`]
			: []),
	];

	return (
		<div className="fixed inset-0 z-[10000] flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={handleClose}
				onKeyDown={() => {}}
			/>

			{/* Dialog */}
			<div className="relative z-10 w-[420px] bg-[#12122a] border border-white/15 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
					<div className="flex items-center gap-2.5">
						<Camera className="size-4 text-blue-400" />
						<h3 className="text-sm font-semibold text-white/90">
							Capture Screenshot
						</h3>
					</div>
					<button
						type="button"
						onClick={handleClose}
						className="p-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
					>
						<X className="size-4" />
					</button>
				</div>

				{/* Body */}
				<div className="px-5 py-6">
					{/* Phase indicator */}
					<div className="flex flex-col items-center gap-4">
						{phase === "done" ? (
							<div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
								<Check className="size-6 text-emerald-400" />
							</div>
						) : phase === "error" ? (
							<div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
								<X className="size-6 text-red-400" />
							</div>
						) : (
							<div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
								<Loader2 className="size-6 text-blue-400 animate-spin" />
							</div>
						)}

						<p
							className={`text-sm font-medium ${phase === "done" ? "text-emerald-400" : phase === "error" ? "text-red-400" : "text-white/70"}`}
						>
							{PHASE_LABELS[phase]}
						</p>

						{errorMsg && phase === "error" && (
							<p className="text-xs text-red-400/60 text-center max-w-[280px]">
								{errorMsg}
							</p>
						)}

						{/* Progress dots */}
						{phase !== "done" && phase !== "error" && (
							<div className="flex items-center gap-2 mt-1">
								{(
									[
										"loading-files",
										"compiling",
										"capturing",
										"uploading",
									] as CapturePhase[]
								).map((p) => {
									const phases: CapturePhase[] = [
										"loading-files",
										"compiling",
										"capturing",
										"uploading",
									];
									const currentIdx = phases.indexOf(phase);
									const dotIdx = phases.indexOf(p);
									const isActive = dotIdx === currentIdx;
									const isDone = dotIdx < currentIdx;
									return (
										<div
											key={p}
											className={`h-1.5 rounded-full transition-all duration-300 ${
												isActive
													? "w-6 bg-blue-400"
													: isDone
														? "w-1.5 bg-blue-400/60"
														: "w-1.5 bg-white/15"
											}`}
										/>
									);
								})}
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				{(phase === "error" || phase === "done") && (
					<div className="px-5 py-3 border-t border-white/[0.06] flex justify-end">
						<button
							type="button"
							onClick={handleClose}
							className="px-4 py-1.5 rounded-lg text-sm text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
						>
							{phase === "done" ? "Close" : "Dismiss"}
						</button>
					</div>
				)}
			</div>

			{/* Hidden Sandpack — renders offscreen to generate the preview */}
			{sandpackFiles && (
				<div
					className="capture-dialog-sandpack fixed"
					style={{
						left: "-9999px",
						top: 0,
						width: "1280px",
						height: "720px",
						opacity: 0,
						pointerEvents: "none",
					}}
				>
					<SandpackProvider
						template="react"
						files={sandpackFiles}
						customSetup={{ dependencies }}
						options={{
							autorun: true,
							autoReload: false,
							externalResources,
						}}
					>
						<SandpackPreviewPane
							style={{ width: "1280px", height: "720px" }}
							showOpenInCodeSandbox={false}
							showRefreshButton={false}
						/>
					</SandpackProvider>
				</div>
			)}
		</div>
	);
}

/** Resize a data URL to an 800x450 thumbnail, cropping from top at 16:9 */
function resizeToThumbnail(dataUrl: string): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = 800;
			canvas.height = 450;
			const ctx = canvas.getContext("2d");
			if (!ctx) return reject(new Error("No canvas context"));
			const srcW = img.naturalWidth;
			const srcH = Math.min(
				Math.round(img.naturalWidth / (800 / 450)),
				img.naturalHeight,
			);
			ctx.drawImage(img, 0, 0, srcW, srcH, 0, 0, 800, 450);
			canvas.toBlob(
				(blob) =>
					blob ? resolve(blob) : reject(new Error("toBlob failed")),
				"image/png",
			);
		};
		img.onerror = () => reject(new Error("Failed to load image"));
		img.src = dataUrl;
	});
}
