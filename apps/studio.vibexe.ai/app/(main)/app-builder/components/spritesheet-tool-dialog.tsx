"use client";

/**
 * Spritesheet Tool Dialog — 3D to 2D spritesheet generator.
 *
 * Interactive 3D preview with OrbitControls — user orbits the model to choose
 * their camera angle, selects animations, and generates one spritesheet per animation.
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
	Grid3X3,
	Link2,
	Loader2,
	Play,
	Upload,
} from "lucide-react";
import {
	getCaptureInstance,
	type CapturedFrame,
	type LoadedModel,
} from "../lib/spritesheet-capture";
import { packFrames } from "../lib/spritesheet-packer";
import { uploadSpritesheet, type StoredSpritesheet } from "../lib/spritesheet-storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelSourceTab = "url" | "upload" | "stock";
type Phase = "idle" | "loading" | "capturing" | "packing" | "uploading" | "done" | "error";

interface Props {
	appId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onGenerated?: (result: StoredSpritesheet) => void;
}

// Curated 3D models from media-stock
interface StockModel { name: string; path: string; }
interface StockPack { id: string; label: string; models: StockModel[]; }

const STOCK_PACKS: StockPack[] = [
	{
		id: "meshy-characters", label: "Animated Characters",
		models: [
			{ name: "Warrior (Animated)", path: "meshy-characters/Warrior_figure_Animations.glb" },
		],
	},
	{
		id: "platformer-project", label: "Platformer Characters & Props",
		models: [
			{ name: "Lily", path: "platformer-project/characters/Lily.glb" },
			{ name: "Slime", path: "platformer-project/characters/Slime.glb" },
			{ name: "Glider", path: "platformer-project/objects/glider.glb" },
			{ name: "Dice", path: "platformer-project/objects/dice.glb" },
			{ name: "Flamethrower", path: "platformer-project/objects/flamethrower.glb" },
			{ name: "Log", path: "platformer-project/objects/log.glb" },
			{ name: "Disc", path: "platformer-project/objects/disc.glb" },
		],
	},
	{
		id: "kaykit-skeletons", label: "KayKit Skeletons",
		models: [
			{ name: "Skeleton Rogue", path: "kaykit-skeletons/Skeleton_Rogue.glb" },
			{ name: "Skeleton Mage", path: "kaykit-skeletons/Skeleton_Mage.glb" },
			{ name: "Skeleton Arrow", path: "kaykit-skeletons/Skeleton_Arrow.gltf" },
			{ name: "Skeleton Axe", path: "kaykit-skeletons/Skeleton_Axe.gltf" },
			{ name: "Skeleton Crossbow", path: "kaykit-skeletons/Skeleton_Crossbow.gltf" },
			{ name: "Skeleton Blade", path: "kaykit-skeletons/Skeleton_Blade.gltf" },
		],
	},
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
	const [frameCount, setFrameCount] = useState(8);
	const [rotationAxis, setRotationAxis] = useState<"x" | "y" | "z">("y");
	const [selectedAnims, setSelectedAnims] = useState<Set<string>>(new Set());
	const [spriteName, setSpriteName] = useState("sprite");

	// State
	const [phase, setPhase] = useState<Phase>("idle");
	const [progress, setProgress] = useState(0);
	const [errorMsg, setErrorMsg] = useState("");
	const [loadedModel, setLoadedModel] = useState<LoadedModel | null>(null);
	const [animNames, setAnimNames] = useState<string[]>([]);
	const [results, setResults] = useState<StoredSpritesheet[]>([]);

	// View controls
	const [activeView, setActiveView] = useState<string>("front");
	const [modelZUp, setModelZUp] = useState(false);

	// Refs — interactive 3D preview
	const previewContainerRef = useRef<HTMLDivElement>(null);
	const previewRendererRef = useRef<any>(null);
	const orbitControlsRef = useRef<any>(null);
	const previewAnimFrameRef = useRef<number>(0);
	const previewCameraRef = useRef<any>(null);
	const gizmoCanvasRef = useRef<HTMLCanvasElement>(null);
	const abortRef = useRef(false);

	// ---------------------------------------------------------------------------
	// Preview cleanup
	// ---------------------------------------------------------------------------

	const cleanupPreview = useCallback(() => {
		if (previewAnimFrameRef.current) {
			cancelAnimationFrame(previewAnimFrameRef.current);
			previewAnimFrameRef.current = 0;
		}
		if (orbitControlsRef.current) {
			orbitControlsRef.current.dispose();
			orbitControlsRef.current = null;
		}
		if (previewRendererRef.current) {
			previewRendererRef.current.dispose();
			previewRendererRef.current = null;
		}
		if (previewContainerRef.current) {
			previewContainerRef.current.innerHTML = "";
		}
		previewCameraRef.current = null;
	}, []);

	// Cleanup on unmount / dialog close
	useEffect(() => {
		if (!open) cleanupPreview();
		return () => cleanupPreview();
	}, [open, cleanupPreview]);

	// ---------------------------------------------------------------------------
	// View presets — snap camera to axis-aligned positions
	// ---------------------------------------------------------------------------

	// View presets adapt to model's up axis (Z-up vs Y-up)
	const VIEW_PRESETS = modelZUp ? [
		// Z-up model: height along Z, camera along Y for front view
		{ id: "front", label: "Front", dir: [0, -1, 0] },
		{ id: "back", label: "Back", dir: [0, 1, 0] },
		{ id: "right", label: "Right", dir: [1, 0, 0] },
		{ id: "left", label: "Left", dir: [-1, 0, 0] },
		{ id: "top", label: "Top", dir: [0, 0, 1] },
	] : [
		// Y-up model: standard orientation
		{ id: "front", label: "Front", dir: [0, 0, -1] },
		{ id: "back", label: "Back", dir: [0, 0, 1] },
		{ id: "right", label: "Right", dir: [1, 0, 0] },
		{ id: "left", label: "Left", dir: [-1, 0, 0] },
		{ id: "top", label: "Top", dir: [0, 1, 0] },
	];

	const snapToView = useCallback((presetId: string) => {
		const camera = previewCameraRef.current;
		const controls = orbitControlsRef.current;
		if (!camera || !controls) return;

		const preset = VIEW_PRESETS.find(p => p.id === presetId);
		if (!preset) return;

		const radius = camera.position.distanceTo(controls.target);
		const target = controls.target.clone();
		const endPos = target.clone().add(
			new camera.position.constructor(preset.dir[0], preset.dir[1], preset.dir[2]).multiplyScalar(radius)
		);

		// Animate camera to new position over 300ms
		const startPos = camera.position.clone();
		const startTime = performance.now();
		const duration = 300;

		controls.enabled = false;
		function animateSnap() {
			const elapsed = performance.now() - startTime;
			const t = Math.min(elapsed / duration, 1);
			const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad

			camera.position.lerpVectors(startPos, endPos, ease);
			camera.lookAt(controls.target);
			controls.update();

			if (t < 1) {
				requestAnimationFrame(animateSnap);
			} else {
				controls.enabled = true;
			}
		}
		requestAnimationFrame(animateSnap);
		setActiveView(presetId);
	}, []);

	// Draw axis gizmo on a small overlay canvas
	const updateGizmo = useCallback((camera: any) => {
		const canvas = gizmoCanvasRef.current;
		if (!canvas || !camera) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const s = 48;
		ctx.clearRect(0, 0, s, s);
		const cx = s / 2, cy = s / 2, len = 16;

		// Get camera's view rotation
		const m = camera.matrixWorldInverse.elements;

		// Project each axis through the view rotation (only rotation, ignore translation)
		const axes = [
			{ x: m[0], y: m[4], color: "#ef4444", label: "X" }, // red
			{ x: m[1], y: m[5], color: "#22c55e", label: "Y" }, // green
			{ x: m[2], y: m[6], color: "#3b82f6", label: "Z" }, // blue
		];

		// Sort by depth (draw farthest first)
		const sortedAxes = axes.map((a, i) => ({ ...a, depth: [m[8], m[9], m[10]][i] }))
			.sort((a, b) => a.depth - b.depth);

		for (const axis of sortedAxes) {
			const ex = cx + axis.x * len;
			const ey = cy - axis.y * len; // flip Y for canvas
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(ex, ey);
			ctx.strokeStyle = axis.color;
			ctx.lineWidth = 2;
			ctx.stroke();
			// Label
			ctx.fillStyle = axis.color;
			ctx.font = "bold 9px sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(axis.label, ex + (axis.x > 0 ? 6 : -6), ey + (axis.y > 0 ? -4 : 10));
		}
	}, []);

	// ---------------------------------------------------------------------------
	// Initialize live 3D preview with OrbitControls
	// ---------------------------------------------------------------------------

	const initPreviewRenderer = useCallback(async (loaded: LoadedModel) => {
		const capture = getCaptureInstance();
		const THREE = capture.getThree();
		if (!THREE || !previewContainerRef.current) return;

		let OrbitControls: any;
		try {
			OrbitControls = await capture.getOrbitControlsClass();
		} catch {
			console.warn("[SpritesheetTool] OrbitControls not available");
			return;
		}

		cleanupPreview();

		// Visible renderer for preview panel
		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		const container = previewContainerRef.current;
		const w = container.clientWidth || 280;
		const h = container.clientHeight || 280;
		renderer.setSize(w, h);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.setClearColor(0x080812, 1);
		container.innerHTML = "";
		container.appendChild(renderer.domElement);
		renderer.domElement.style.borderRadius = "8px";

		// Scene with front-facing lighting
		const scene = new THREE.Scene();
		scene.add(new THREE.AmbientLight(0xffffff, 0.8));
		const dir = new THREE.DirectionalLight(0xffffff, 0.8);
		dir.position.set(1, 2, -3);
		scene.add(dir);
		const fill = new THREE.DirectionalLight(0xffffff, 0.3);
		fill.position.set(-1, 1, 2);
		scene.add(fill);

		// Detect model orientation — check which axis is "height" (tallest)
		const bbox = new THREE.Box3().setFromObject(loaded.model);
		const bsize = bbox.getSize(new THREE.Vector3());
		const isZUp = bsize.z > bsize.y;

		// Camera — front view adapted to model's up axis
		const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
		if (isZUp) {
			camera.position.set(0, -4, 0); // Look along Y toward model, Z is up
			camera.up.set(0, 0, 1);
		} else {
			camera.position.set(0, 0, -4); // Standard Y-up model
			camera.up.set(0, 1, 0);
		}
		camera.lookAt(0, 0, 0);

		// OrbitControls — user can drag to rotate, scroll to zoom
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		controls.target.set(0, 0, 0);
		controls.update();

		// Clone model into preview scene — use SkeletonUtils for animated models
		let SkeletonUtils: any = null;
		try {
			// @ts-ignore
			const mod = await import("three/examples/jsm/utils/SkeletonUtils.js");
			SkeletonUtils = mod.SkeletonUtils;
		} catch { /* fallback to simple clone */ }
		const previewModel = (loaded.animations.length > 0 && SkeletonUtils)
			? SkeletonUtils.clone(loaded.model)
			: loaded.model.clone();
		scene.add(previewModel);

		// Play first animation if available
		let mixer: any = null;
		if (loaded.animations.length > 0) {
			mixer = new THREE.AnimationMixer(previewModel);
			const action = mixer.clipAction(loaded.animations[0]);
			action.play();
		}

		// Track manual orbit to deselect view preset
		let manualOrbitTimer: any = null;
		controls.addEventListener("start", () => {
			clearTimeout(manualOrbitTimer);
			manualOrbitTimer = setTimeout(() => setActiveView(""), 100);
		});

		// Store refs
		previewRendererRef.current = renderer;
		orbitControlsRef.current = controls;
		previewCameraRef.current = camera;

		// Render loop
		const clock = new THREE.Clock();
		const gizmoUpdate = updateGizmo;
		function animate() {
			previewAnimFrameRef.current = requestAnimationFrame(animate);
			const delta = clock.getDelta();
			if (mixer) mixer.update(delta);
			controls.update();
			renderer.render(scene, camera);
			gizmoUpdate(camera);
		}
		animate();
	}, [cleanupPreview, updateGizmo]);

	// ---------------------------------------------------------------------------
	// Model loading
	// ---------------------------------------------------------------------------

	const loadModel = useCallback(async (url: string) => {
		if (!url) return;
		setPhase("loading");
		setErrorMsg("");
		setLoadedModel(null);
		setAnimNames([]);
		setResults([]);

		try {
			const capture = getCaptureInstance();
			await capture.init(frameSize, frameSize);
			const loaded = await capture.loadModel(url);
			setLoadedModel(loaded);

			// Detect model up-axis for view presets
			const THREE = capture.getThree();
			const mbox = new THREE.Box3().setFromObject(loaded.model);
			const msz = mbox.getSize(new THREE.Vector3());
			setModelZUp(msz.z > msz.y);

			const names = capture.getAnimationNames(loaded);
			setAnimNames(names);
			// Select common platformer animations by default, or all if few
			if (names.length <= 5) {
				setSelectedAnims(new Set(names));
			} else {
				const common = new Set(["idle", "walk", "run", "jump", "fall", "die", "attack"]);
				const selected = names.filter(n => common.has(n.toLowerCase()));
				setSelectedAnims(new Set(selected.length > 0 ? selected : names.slice(0, 5)));
			}

			const urlName = url.split("/").pop()?.replace(/\.(glb|gltf)$/i, "") || "sprite";
			setSpriteName(urlName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase());

			// Start interactive preview
			await initPreviewRenderer(loaded);

			setPhase("idle");
		} catch (err: any) {
			setPhase("error");
			setErrorMsg(err?.message || "Failed to load model");
		}
	}, [frameSize, initPreviewRenderer]);

	// Handle file upload
	const handleFileUpload = useCallback(async (file: File) => {
		if (!file.name.match(/\.(glb|gltf)$/i)) {
			setErrorMsg("Please upload a .glb or .gltf file");
			return;
		}
		setFileName(file.name);
		const form = new FormData();
		form.append("file", file);
		form.append("path", `spritesheets/_uploads/${file.name}`);
		try {
			const res = await fetch(`/api/apps/${appId}/storage`, { method: "POST", body: form });
			if (!res.ok) throw new Error("Upload failed");
			const data = await res.json();
			loadModel(data.url);
		} catch (err: any) {
			setErrorMsg(err?.message || "Upload failed");
		}
	}, [appId, loadModel]);

	// Handle media stock selection
	const handleStockSelect = useCallback((modelPath: string) => {
		const url = `/api/app-builder/media-stock-3d/${encodeURI(modelPath)}`;
		setModelUrl(url);
		loadModel(url);
	}, [loadModel]);

	// ---------------------------------------------------------------------------
	// Per-animation generation
	// ---------------------------------------------------------------------------

	const generate = useCallback(async () => {
		if (!loadedModel) return;
		setPhase("capturing");
		setProgress(0);
		setResults([]);
		abortRef.current = false;

		try {
			const capture = getCaptureInstance();
			await capture.init(frameSize, frameSize);

			// Reset camera lock so first animation sets the camera, then all others reuse it
			capture.resetCameraLock();

			// Sync preview camera direction to capture engine
			if (previewCameraRef.current && orbitControlsRef.current) {
				const THREE = capture.getThree();
				const dir = new THREE.Vector3()
					.subVectors(previewCameraRef.current.position, orbitControlsRef.current.target)
					.normalize();
				capture.setCameraDirection({ x: dir.x, y: dir.y, z: dir.z });
			}

			const newResults: StoredSpritesheet[] = [];

			if (animNames.length > 0 && selectedAnims.size > 0) {
				// Per-animation capture: one sheet per animation
				const anims = [...selectedAnims];
				for (let i = 0; i < anims.length; i++) {
					if (abortRef.current) break;
					const animName = anims[i];

					// Capture frames for this animation
					setPhase("capturing");
					const frames = await capture.captureAnimation(loadedModel, {
						frames: frameCount,
						clipName: animName,
						prefix: animName,
					}, (pct) => {
						const base = i / anims.length;
						const slice = 1 / anims.length;
						setProgress((base + pct * slice) * 0.6);
					});

					// Pack into its own atlas
					setPhase("packing");
					const packed = await packFrames(frames, { imageName: "sheet.png" });

					// Upload
					setPhase("uploading");
					const stored = await uploadSpritesheet(appId, spriteName, animName, packed.atlasBlob, packed.metadata);
					newResults.push(stored);
					setProgress((i + 1) / anims.length);
				}
			} else {
				// No animations — rotation capture (single sheet)
				const frames = await capture.captureRotation(loadedModel, {
					frames: frameCount,
					axis: rotationAxis,
					prefix: "rotate",
				}, (pct) => setProgress(pct * 0.6));

				setPhase("packing");
				const packed = await packFrames(frames, { imageName: "sheet.png" });

				setPhase("uploading");
				const stored = await uploadSpritesheet(appId, spriteName, "rotate", packed.atlasBlob, packed.metadata);
				newResults.push(stored);
			}

			setResults(newResults);
			setProgress(1);
			setPhase("done");
			if (onGenerated && newResults.length > 0) onGenerated(newResults[0]);
		} catch (err: any) {
			setPhase("error");
			setErrorMsg(err?.message || "Generation failed");
		}
	}, [loadedModel, frameSize, frameCount, rotationAxis, selectedAnims, animNames, appId, spriteName, onGenerated]);

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	const isWorking = phase === "loading" || phase === "capturing" || phase === "packing" || phase === "uploading";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!w-[700px] max-w-[96vw] max-h-[90vh] p-0 gap-0 overflow-hidden bg-[#0d0d1a] border-white/10 [&>button]:hidden">
				<DialogHeader className="px-5 py-3 border-b border-white/[0.06]">
					<DialogTitle className="flex items-center gap-2 text-base font-medium text-white/90">
						<Grid3X3 className="size-4 text-blue-400" />
						3D → 2D Spritesheet Generator
					</DialogTitle>
					<DialogDescription className="sr-only">
						Load a 3D model, orbit to choose your camera angle, and generate per-animation spritesheets.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col md:flex-row overflow-x-hidden overflow-y-auto" style={{ maxHeight: "calc(90vh - 56px)" }}>
					{/* Left column: Interactive 3D Preview / Results */}
					<div className="hidden md:flex md:w-[300px] flex-shrink-0 border-r border-white/[0.06] flex-col">
						{phase === "done" && results.length > 0 ? (
							<div className="flex-1 flex flex-col bg-[#080812] p-3 gap-2 overflow-y-auto">
								<span className="text-[10px] uppercase tracking-wider text-white/30 text-center">
									Generated Sheets ({results.length})
								</span>
								{results.map((r) => (
									<div key={r.name} className="flex flex-col items-center gap-1">
										<img
											src={`${r.atlasUrl}${r.atlasUrl.includes('?') ? '&' : '?'}_cb=${phase}`}
											alt={`${r.name} atlas`}
											className="max-w-full max-h-[120px] object-contain rounded border border-white/[0.08]"
											style={{ imageRendering: "pixelated" }}
										/>
										<span className="text-[10px] text-white/30">{r.name}</span>
									</div>
								))}
							</div>
						) : (
							<div className="flex-1 flex flex-col">
								{/* Live 3D preview with camera controls */}
								<div className="relative flex-1 min-h-[280px] m-2">
									<div
										ref={previewContainerRef}
										className="absolute inset-0 bg-[#080812] rounded-lg"
									/>

									{/* View preset buttons — top-right overlay */}
									{loadedModel && (
										<div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
											{VIEW_PRESETS.map((p) => (
												<button
													key={p.id}
													onClick={() => snapToView(p.id)}
													className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
														activeView === p.id
															? "bg-blue-500/30 text-blue-400 border border-blue-500/40"
															: "bg-black/40 text-white/40 border border-white/[0.06] hover:text-white/70"
													}`}
												>
													{p.label}
												</button>
											))}
										</div>
									)}

									{/* Axis gizmo — bottom-left overlay */}
									{loadedModel && (
										<canvas
											ref={gizmoCanvasRef}
											width={48}
											height={48}
											className="absolute bottom-2 left-2 z-10 pointer-events-none"
										/>
									)}
								</div>
								{loadedModel && (
									<div className="px-3 pb-2 text-center text-[10px] text-white/20">
										Drag to rotate · Scroll to zoom · Use presets for axis views
									</div>
								)}
							</div>
						)}
					</div>

					{/* Right column: Controls */}
					<div className="flex-1 flex flex-col overflow-x-hidden min-w-0">
						<div className="flex-1 overflow-y-auto">
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
								<div className="max-h-[180px] overflow-y-auto space-y-2 py-1">
									{STOCK_PACKS.map((pack) => (
										<div key={pack.id}>
											<div className="text-[10px] uppercase tracking-wider text-white/30 px-1 mb-1">{pack.label}</div>
											<div className="space-y-0.5">
												{pack.models.map((model) => (
													<button
														key={model.path}
														onClick={() => handleStockSelect(model.path)}
														disabled={phase === "loading"}
														className="w-full text-left px-3 py-1.5 rounded-md text-xs text-white/60 hover:bg-white/[0.06] hover:text-white/90 transition-colors disabled:opacity-40"
													>
														{model.name}
													</button>
												))}
											</div>
										</div>
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
								<div className="grid grid-cols-4 gap-1">
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
								<label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">Frames per Animation</label>
								<div className="flex gap-1">
									{[4, 8, 12, 16].map((c) => (
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

							{/* Rotation Axis (only when no animations) */}
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

							{/* Animations */}
							{animNames.length > 0 && (
								<div>
									<label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">
										Animations ({selectedAnims.size}/{animNames.length})
									</label>
									<div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto">
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
						</div>
						</div>{/* end scrollable area */}

						{/* Action buttons + status — pinned at bottom */}
						<div className="px-4 py-3 border-t border-white/[0.06] space-y-2 flex-shrink-0 bg-[#0d0d1a]">
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
							{phase === "done" && results.length > 0 && (
								<div className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded flex items-center gap-2">
									<Check className="size-3" />
									{results.length} spritesheet{results.length > 1 ? "s" : ""} saved
								</div>
							)}

							{/* Buttons */}
							<div className="flex gap-2 min-w-0">
								<button
									type="button"
									onClick={generate}
									disabled={!loadedModel || isWorking || (animNames.length > 0 && selectedAnims.size === 0)}
									className="flex-1 min-w-0 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
								>
									{isWorking ? (
										<Loader2 className="size-3 animate-spin flex-shrink-0" />
									) : (
										<Camera className="size-3 flex-shrink-0" />
									)}
									<span className="truncate">
										{phase === "done" ? "Regenerate" : animNames.length > 0
											? `Generate ${selectedAnims.size} Sheet${selectedAnims.size > 1 ? "s" : ""}`
											: "Generate Spritesheet"}
									</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
