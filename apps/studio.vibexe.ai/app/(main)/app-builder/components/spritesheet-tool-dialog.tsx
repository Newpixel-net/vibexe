"use client";

/**
 * Spritesheet Tool Dialog — 3D to 2D spritesheet generator.
 *
 * Provides a full UI for:
 * - Loading 3D models (URL, file upload, or media-stock browser)
 * - Previewing models in an embedded Three.js canvas with orbit controls
 * - Configuring capture settings (frame size, count, axis, animations, multi-angle)
 * - Live flipbook preview before full generation
 * - Generating and uploading PIXI.Spritesheet-compatible atlases
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogHeader,
} from "@vibexe-internal/ui/dialog";
import {
	Box,
	Camera,
	Check,
	ChevronDown,
	Film,
	Grid3X3,
	Link2,
	Loader2,
	Play,
	RotateCcw,
	Upload,
	X,
} from "lucide-react";
import {
	getCaptureInstance,
	type CapturedFrame,
	type LoadedModel,
} from "../lib/spritesheet-capture";
import { packFrames, packMultiAngle } from "../lib/spritesheet-packer";
import { uploadSpritesheet, type StoredSpritesheet } from "../lib/spritesheet-storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelSourceTab = "url" | "upload" | "stock";
type Phase = "idle" | "loading" | "previewing" | "capturing" | "packing" | "uploading" | "done" | "error";

interface Props {
	appId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onGenerated?: (result: StoredSpritesheet) => void;
}

// Simple list of media-stock 3D packs for the browser
const STOCK_PACKS = [
	{ id: "kaykit-platformer", name: "KayKit Platformer", path: "Assets/gltf", ext: ".gltf" },
	{ id: "meshy-characters", name: "Meshy Characters", path: "", ext: ".glb" },
	{ id: "platformer-project", name: "Platformer Project", path: "", ext: ".glb" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpritesheetToolDialog({ appId, open, onOpenChange, onGenerated }: Props) {
	// Model source
	const [sourceTab, setSourceTab] = useState<ModelSourceTab>("url");
	const [modelUrl, setModelUrl] = useState("");
	const [fileName, setFileName] = useState("");

	// Settings
	const [frameSize, setFrameSize] = useState(128);
	const [frameCount, setFrameCount] = useState(24);
	const [rotationAxis, setRotationAxis] = useState<"x" | "y" | "z">("y");
	const [bgTransparent, setBgTransparent] = useState(true);
	const [multiAngle, setMultiAngle] = useState(false);
	const [angleCount, setAngleCount] = useState(8);
	const [selectedAnims, setSelectedAnims] = useState<Set<string>>(new Set());
	const [spriteName, setSpriteName] = useState("sprite");

	// State
	const [phase, setPhase] = useState<Phase>("idle");
	const [progress, setProgress] = useState(0);
	const [errorMsg, setErrorMsg] = useState("");
	const [loadedModel, setLoadedModel] = useState<LoadedModel | null>(null);
	const [animNames, setAnimNames] = useState<string[]>([]);
	const [previewFrames, setPreviewFrames] = useState<CapturedFrame[]>([]);
	const [result, setResult] = useState<StoredSpritesheet | null>(null);

	// Refs
	const previewCanvasRef = useRef<HTMLCanvasElement>(null);
	const flipbookCanvasRef = useRef<HTMLCanvasElement>(null);
	const flipbookIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const abortRef = useRef(false);

	// ---------------------------------------------------------------------------
	// Model loading
	// ---------------------------------------------------------------------------

	const loadModel = useCallback(async (url: string) => {
		if (!url) return;
		setPhase("loading");
		setErrorMsg("");
		setLoadedModel(null);
		setAnimNames([]);
		setPreviewFrames([]);
		setResult(null);

		try {
			const capture = getCaptureInstance();
			await capture.init(frameSize, frameSize);
			const loaded = await capture.loadModel(url);
			setLoadedModel(loaded);

			// Get animation names
			const names = capture.getAnimationNames(loaded);
			setAnimNames(names);
			setSelectedAnims(new Set(names)); // select all by default

			// Derive name from URL
			const urlName = url.split("/").pop()?.replace(/\.(glb|gltf)$/i, "") || "sprite";
			setSpriteName(urlName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase());

			// Render a single preview frame to the 3D preview canvas
			if (previewCanvasRef.current) {
				const canvas = previewCanvasRef.current;
				canvas.width = frameSize;
				canvas.height = frameSize;
				const srcCanvas = capture.getCanvas();
				if (srcCanvas) {
					const ctx = canvas.getContext("2d");
					if (ctx) ctx.drawImage(srcCanvas, 0, 0, frameSize, frameSize);
				}
			}

			setPhase("idle");
		} catch (err: any) {
			setPhase("error");
			setErrorMsg(err?.message || "Failed to load model");
		}
	}, [frameSize]);

	// Handle file upload
	const handleFileUpload = useCallback(async (file: File) => {
		if (!file.name.match(/\.(glb|gltf)$/i)) {
			setErrorMsg("Please upload a .glb or .gltf file");
			return;
		}
		setFileName(file.name);

		// Upload to app storage first
		const form = new FormData();
		form.append("file", file);
		form.append("path", `spritesheets/_uploads/${file.name}`);

		try {
			const res = await fetch(`/api/apps/${appId}/storage`, {
				method: "POST",
				body: form,
			});
			if (!res.ok) throw new Error("Upload failed");
			const data = await res.json();
			setModelUrl(data.url);
			await loadModel(data.url);
		} catch (err: any) {
			setErrorMsg(err?.message || "Upload failed");
		}
	}, [appId, loadModel]);

	// Handle media stock selection
	const handleStockSelect = useCallback((packId: string, modelPath: string) => {
		const url = `/api/app-builder/media-stock-3d/${packId}/${encodeURI(modelPath)}`;
		setModelUrl(url);
		loadModel(url);
	}, [loadModel]);

	// ---------------------------------------------------------------------------
	// Flipbook preview
	// ---------------------------------------------------------------------------

	const runPreview = useCallback(async () => {
		if (!loadedModel) return;
		setPhase("previewing");
		abortRef.current = false;

		try {
			const capture = getCaptureInstance();
			await capture.init(frameSize, frameSize);

			let frames: CapturedFrame[];
			if (animNames.length > 0 && selectedAnims.size > 0) {
				const firstAnim = [...selectedAnims][0];
				frames = await capture.captureAnimation(loadedModel, {
					frames: 8,
					clipName: firstAnim,
					prefix: "preview",
				});
			} else {
				frames = await capture.captureRotation(loadedModel, {
					frames: 8,
					axis: rotationAxis,
					prefix: "preview",
				});
			}

			setPreviewFrames(frames);
			startFlipbook(frames);
			setPhase("idle");
		} catch (err: any) {
			setPhase("error");
			setErrorMsg(err?.message || "Preview failed");
		}
	}, [loadedModel, frameSize, rotationAxis, animNames, selectedAnims]);

	const startFlipbook = useCallback((frames: CapturedFrame[]) => {
		if (flipbookIntervalRef.current) clearInterval(flipbookIntervalRef.current);
		if (frames.length === 0) return;

		let idx = 0;
		const canvas = flipbookCanvasRef.current;
		if (!canvas) return;
		canvas.width = frames[0].width;
		canvas.height = frames[0].height;

		flipbookIntervalRef.current = setInterval(async () => {
			const frame = frames[idx % frames.length];
			const img = new Image();
			const url = URL.createObjectURL(frame.blob);
			img.onload = () => {
				const ctx = canvas.getContext("2d");
				if (ctx) {
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.drawImage(img, 0, 0);
				}
				URL.revokeObjectURL(url);
			};
			img.src = url;
			idx++;
		}, 100);
	}, []);

	// Cleanup flipbook on unmount
	useEffect(() => {
		return () => {
			if (flipbookIntervalRef.current) clearInterval(flipbookIntervalRef.current);
		};
	}, []);

	// ---------------------------------------------------------------------------
	// Full generation
	// ---------------------------------------------------------------------------

	const generate = useCallback(async () => {
		if (!loadedModel) return;
		setPhase("capturing");
		setProgress(0);
		abortRef.current = false;

		try {
			const capture = getCaptureInstance();
			await capture.init(frameSize, frameSize);

			let allFrames: CapturedFrame[];

			if (multiAngle) {
				// Multi-angle capture
				const angleMap = await capture.captureMultiAngle(loadedModel, {
					angles: angleCount,
					animFrames: frameCount,
					clips: selectedAnims.size > 0 ? [...selectedAnims] : undefined,
				}, (pct) => setProgress(pct * 0.6)); // 60% for capture

				setPhase("packing");
				const packed = await packMultiAngle(angleMap, {
					imageName: "sheet.png",
				});

				setPhase("uploading");
				setProgress(0.8);
				const stored = await uploadSpritesheet(
					appId,
					spriteName,
					packed.atlasBlob,
					packed.metadata,
				);

				setResult(stored);
			} else {
				// Single angle capture
				allFrames = [];

				if (animNames.length > 0 && selectedAnims.size > 0) {
					// Capture selected animations
					const anims = [...selectedAnims];
					for (let i = 0; i < anims.length; i++) {
						const clipFrames = await capture.captureAnimation(loadedModel, {
							frames: frameCount,
							clipName: anims[i],
							prefix: anims[i],
						}, (pct) => {
							const base = i / anims.length;
							const slice = 1 / anims.length;
							setProgress((base + pct * slice) * 0.6);
						});
						allFrames.push(...clipFrames);
					}
				} else {
					// Capture rotation
					allFrames = await capture.captureRotation(loadedModel, {
						frames: frameCount,
						axis: rotationAxis,
						prefix: "rotate",
					}, (pct) => setProgress(pct * 0.6));
				}

				setPhase("packing");
				setProgress(0.7);
				const packed = await packFrames(allFrames, {
					imageName: "sheet.png",
				});

				setPhase("uploading");
				setProgress(0.8);
				const stored = await uploadSpritesheet(
					appId,
					spriteName,
					packed.atlasBlob,
					packed.metadata,
				);

				setResult(stored);
			}

			setProgress(1);
			setPhase("done");
			if (onGenerated && result) onGenerated(result);
		} catch (err: any) {
			setPhase("error");
			setErrorMsg(err?.message || "Generation failed");
		}
	}, [loadedModel, frameSize, frameCount, rotationAxis, multiAngle, angleCount, selectedAnims, animNames, appId, spriteName, onGenerated, result]);

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	const isWorking = phase === "loading" || phase === "previewing" || phase === "capturing" || phase === "packing" || phase === "uploading";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[860px] w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden bg-[#0d0d1a] border-white/10">
				<DialogHeader className="px-5 py-3 border-b border-white/[0.06]">
					<DialogTitle className="flex items-center gap-2 text-base font-medium text-white/90">
						<Grid3X3 className="size-4 text-blue-400" />
						3D → 2D Spritesheet Generator
					</DialogTitle>
					<DialogDescription className="sr-only">
						Load a 3D model and generate a PIXI.Spritesheet atlas for use in 2D games.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col md:flex-row overflow-y-auto" style={{ maxHeight: "calc(90vh - 56px)" }}>
					{/* Left column: Preview canvases */}
					<div className="w-full md:w-[280px] flex-shrink-0 border-b md:border-b-0 md:border-r border-white/[0.06] flex flex-col">
						{/* 3D Model Preview */}
						<div className="flex-1 min-h-[200px] flex items-center justify-center bg-[#080812] p-4">
							<canvas
								ref={previewCanvasRef}
								className="rounded-lg bg-black/30 border border-white/[0.06] max-w-full"
								style={{ width: 200, height: 200, imageRendering: "pixelated" }}
							/>
						</div>

						{/* Flipbook Preview */}
						<div className="h-[120px] border-t border-white/[0.06] flex flex-col items-center justify-center bg-[#080812] p-2">
							<span className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
								Flipbook Preview
							</span>
							{previewFrames.length > 0 ? (
								<canvas
									ref={flipbookCanvasRef}
									className="rounded bg-black/30 border border-white/[0.06]"
									style={{ width: 80, height: 80, imageRendering: "pixelated" }}
								/>
							) : (
								<div className="text-xs text-white/20">
									Click &quot;Preview&quot; to see animation
								</div>
							)}
						</div>
					</div>

					{/* Right column: Controls */}
					<div className="flex-1 flex flex-col overflow-y-auto min-w-0">
						{/* Model Source Tabs */}
						<div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
							<div className="flex gap-1 mb-3">
								{(["url", "upload", "stock"] as const).map((tab) => (
									<button
										key={tab}
										onClick={() => setSourceTab(tab)}
										className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
											sourceTab === tab
												? "bg-blue-500/20 text-blue-400"
												: "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
										}`}
									>
										{tab === "url" && <><Link2 className="size-3 inline mr-1" />URL</>}
										{tab === "upload" && <><Upload className="size-3 inline mr-1" />Upload</>}
										{tab === "stock" && <><Box className="size-3 inline mr-1" />Media Stock</>}
									</button>
								))}
							</div>

							{/* URL input */}
							{sourceTab === "url" && (
								<div className="flex gap-2">
									<input
										type="text"
										value={modelUrl}
										onChange={(e) => setModelUrl(e.target.value)}
										placeholder="https://...model.glb"
										className="flex-1 px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
									/>
									<button
										type="button"
										onClick={() => loadModel(modelUrl)}
										disabled={!modelUrl || isWorking}
										className="px-4 py-1.5 rounded-md text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
									>
										Load
									</button>
								</div>
							)}

							{/* File upload */}
							{sourceTab === "upload" && (
								<label className="flex items-center justify-center h-16 rounded-lg border-2 border-dashed border-white/10 hover:border-blue-500/30 cursor-pointer transition-colors">
									<input
										type="file"
										accept=".glb,.gltf"
										className="hidden"
										onChange={(e) => {
											const file = e.target.files?.[0];
											if (file) handleFileUpload(file);
										}}
									/>
									<span className="text-xs text-white/30">
										{fileName || "Drop .glb/.gltf file or click to browse"}
									</span>
								</label>
							)}

							{/* Media stock browser */}
							{sourceTab === "stock" && (
								<div className="max-h-[120px] overflow-y-auto space-y-1">
									{STOCK_PACKS.map((pack) => (
										<button
											key={pack.id}
											onClick={() => handleStockSelect(pack.id, `${pack.path ? pack.path + "/" : ""}sample${pack.ext}`)}
											className="w-full text-left px-3 py-2 rounded-md text-xs text-white/60 hover:bg-white/[0.04] hover:text-white/80 transition-colors"
										>
											{pack.name}
										</button>
									))}
								</div>
							)}
						</div>

						{/* Settings */}
						<div className="px-4 py-3 space-y-3 flex-1">
							{/* Sprite name */}
							<div>
								<label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">Name</label>
								<input
									type="text"
									value={spriteName}
									onChange={(e) => setSpriteName(e.target.value)}
									className="w-full px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 focus:outline-none focus:border-blue-500/50"
								/>
							</div>

							{/* Frame Size */}
							<div>
								<label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">Frame Size</label>
								<div className="flex gap-1">
									{[64, 128, 256, 512].map((s) => (
										<button
											key={s}
											onClick={() => setFrameSize(s)}
											className={`px-3 py-1 rounded text-xs transition-colors ${
												frameSize === s
													? "bg-blue-500/20 text-blue-400"
													: "text-white/40 hover:text-white/60 bg-white/[0.03]"
											}`}
										>
											{s}px
										</button>
									))}
								</div>
							</div>

							{/* Frame Count */}
							<div>
								<label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">Frame Count</label>
								<div className="flex gap-1">
									{[8, 16, 24, 30].map((c) => (
										<button
											key={c}
											onClick={() => setFrameCount(c)}
											className={`px-3 py-1 rounded text-xs transition-colors ${
												frameCount === c
													? "bg-blue-500/20 text-blue-400"
													: "text-white/40 hover:text-white/60 bg-white/[0.03]"
											}`}
										>
											{c}
										</button>
									))}
								</div>
							</div>

							{/* Rotation Axis */}
							{animNames.length === 0 && (
								<div>
									<label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">Rotation Axis</label>
									<div className="flex gap-1">
										{(["x", "y", "z"] as const).map((a) => (
											<button
												key={a}
												onClick={() => setRotationAxis(a)}
												className={`px-4 py-1 rounded text-xs font-mono transition-colors ${
													rotationAxis === a
														? "bg-blue-500/20 text-blue-400"
														: "text-white/40 hover:text-white/60 bg-white/[0.03]"
												}`}
											>
												{a.toUpperCase()}
											</button>
										))}
									</div>
								</div>
							)}

							{/* Background */}
							<div>
								<label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">Background</label>
								<div className="flex gap-1">
									<button
										onClick={() => setBgTransparent(true)}
										className={`px-3 py-1 rounded text-xs transition-colors ${
											bgTransparent
												? "bg-blue-500/20 text-blue-400"
												: "text-white/40 hover:text-white/60 bg-white/[0.03]"
										}`}
									>
										Transparent
									</button>
									<button
										onClick={() => setBgTransparent(false)}
										className={`px-3 py-1 rounded text-xs transition-colors ${
											!bgTransparent
												? "bg-blue-500/20 text-blue-400"
												: "text-white/40 hover:text-white/60 bg-white/[0.03]"
										}`}
									>
										Solid
									</button>
								</div>
							</div>

							{/* Animations (if model has them) */}
							{animNames.length > 0 && (
								<div>
									<label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">
										Animations ({selectedAnims.size}/{animNames.length})
									</label>
									<div className="flex flex-wrap gap-1">
										{animNames.map((name) => (
											<button
												key={name}
												onClick={() => {
													setSelectedAnims((prev) => {
														const next = new Set(prev);
														if (next.has(name)) next.delete(name);
														else next.add(name);
														return next;
													});
												}}
												className={`px-2 py-1 rounded text-xs transition-colors ${
													selectedAnims.has(name)
														? "bg-emerald-500/20 text-emerald-400"
														: "text-white/30 bg-white/[0.03]"
												}`}
											>
												{selectedAnims.has(name) ? "✓ " : ""}{name}
											</button>
										))}
									</div>
								</div>
							)}

							{/* Multi-Angle */}
							<div>
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={multiAngle}
										onChange={(e) => setMultiAngle(e.target.checked)}
										className="rounded border-white/20"
									/>
									<span className="text-xs text-white/50">Multi-Angle Capture</span>
								</label>
								{multiAngle && (
									<div className="flex gap-1 mt-1 ml-5">
										{[4, 8].map((a) => (
											<button
												key={a}
												onClick={() => setAngleCount(a)}
												className={`px-3 py-1 rounded text-xs transition-colors ${
													angleCount === a
														? "bg-blue-500/20 text-blue-400"
														: "text-white/40 hover:text-white/60 bg-white/[0.03]"
												}`}
											>
												{a} angles
											</button>
										))}
									</div>
								)}
							</div>
						</div>

						{/* Action buttons + status */}
						<div className="px-4 py-3 border-t border-white/[0.06] space-y-2">
							{/* Progress bar */}
							{isWorking && (
								<div className="space-y-1">
									<div className="flex items-center justify-between text-[10px] text-white/40">
										<span className="capitalize">{phase}...</span>
										<span>{Math.round(progress * 100)}%</span>
									</div>
									<div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
										<div
											className="h-full rounded-full bg-blue-500 transition-all duration-300"
											style={{ width: `${progress * 100}%` }}
										/>
									</div>
								</div>
							)}

							{/* Error */}
							{phase === "error" && (
								<div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">
									{errorMsg}
								</div>
							)}

							{/* Done */}
							{phase === "done" && result && (
								<div className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded flex items-center gap-2">
									<Check className="size-3" />
									Spritesheet saved: {result.name}
								</div>
							)}

							{/* Buttons */}
							<div className="flex gap-2">
								<button
									type="button"
									onClick={runPreview}
									disabled={!loadedModel || isWorking}
									className="flex items-center gap-1 px-4 py-2 rounded-md text-xs font-medium text-white/60 hover:text-white/80 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
								>
									<Play className="size-3" />
									Preview
								</button>
								<button
									type="button"
									onClick={generate}
									disabled={!loadedModel || isWorking}
									className="flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-md text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
								>
									{isWorking ? (
										<Loader2 className="size-3 animate-spin" />
									) : (
										<Camera className="size-3" />
									)}
									{phase === "done" ? "Regenerate" : "Generate Spritesheet"}
								</button>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
