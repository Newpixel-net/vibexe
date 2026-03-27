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
	FolderOpen,
	Grid3X3,
	Link2,
	Loader2,
	Pencil,
	Play,
	Square,
	Trash2,
	Upload,
} from "lucide-react";
import {
	getCaptureInstance,
	type CapturedFrame,
	type LoadedModel,
} from "../lib/spritesheet-capture";
import { packFrames } from "../lib/spritesheet-packer";
import {
	uploadSpritesheet,
	listSpritesheets,
	deleteSpritesheet,
	listProjectsWithSheets,
	importSpritesheets,
	type StoredSpritesheet,
	type ProjectWithSheets,
} from "../lib/spritesheet-storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelSourceTab = "url" | "upload" | "stock";
type DialogTab = "generate" | "library";
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
			{ name: "Meshy Merged (Animated)", path: "meshy-characters/Meshy_AI_Meshy_Merged_Animations.glb" },
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
	const [animRenames, setAnimRenames] = useState<Record<string, string>>({});
	const [editingAnim, setEditingAnim] = useState<string | null>(null);

	// View controls
	const [activeView, setActiveView] = useState<string>("front");
	const [modelZUp, setModelZUp] = useState(false);
	const [modelFrontDir, setModelFrontDir] = useState<{ x: number; y: number; z: number } | null>(null);

	// Animation preview
	const [previewingAnim, setPreviewingAnim] = useState<string | null>(null);
	// Cache-busting counter for result images
	const [generationId, setGenerationId] = useState(0);
	// Capture zoom: 1.0 = auto fit, <1 = zoom in (larger character)
	const [captureZoom, setCaptureZoom] = useState(0.85);

	// Dialog tab: generate vs library
	const [dialogTab, setDialogTab] = useState<DialogTab>("generate");
	// Library state
	const [librarySheets, setLibrarySheets] = useState<StoredSpritesheet[]>([]);
	const [libraryLoading, setLibraryLoading] = useState(false);
	const [deletingSheets, setDeletingSheets] = useState<Set<string>>(new Set());
	const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
	// Import from other projects state
	const [showImport, setShowImport] = useState(false);
	const [importProjects, setImportProjects] = useState<ProjectWithSheets[]>([]);
	const [importLoading, setImportLoading] = useState(false);
	const [importingSheets, setImportingSheets] = useState<Set<string>>(new Set());
	const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
	const [expandedImportProjects, setExpandedImportProjects] = useState<Set<string>>(new Set());

	// Refs — interactive 3D preview
	const previewContainerRef = useRef<HTMLDivElement>(null);
	const previewRendererRef = useRef<any>(null);
	const orbitControlsRef = useRef<any>(null);
	const previewAnimFrameRef = useRef<number>(0);
	const previewCameraRef = useRef<any>(null);
	const previewMixerRef = useRef<any>(null);
	const previewAnimsRef = useRef<any[]>([]);
	const previewModelRef = useRef<any>(null);
	const animNamesRef = useRef<string[]>([]);
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

	// View presets — auto-detected from model's facing direction.
	// "Left"/"Right" labels = character's facing direction on screen, not camera position.
	const VIEW_PRESETS = (() => {
		const up: number[] = modelZUp ? [0, 0, 1] : [0, 1, 0];
		const defaultFront: number[] = modelZUp ? [0, -1, 0] : [0, 0, -1];

		const f = modelFrontDir ? [modelFrontDir.x, modelFrontDir.y, modelFrontDir.z] : defaultFront;
		// cross(front, up) = character's right side
		const r = [
			f[1] * up[2] - f[2] * up[1],
			f[2] * up[0] - f[0] * up[2],
			f[0] * up[1] - f[1] * up[0],
		];
		const len = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]) || 1;
		r[0] /= len; r[1] /= len; r[2] /= len;

		return [
			{ id: "front", label: "Front", dir: f },
			{ id: "back", label: "Back", dir: [-f[0], -f[1], -f[2]] },
			{ id: "right", label: "Right", dir: [-r[0], -r[1], -r[2]] },
			{ id: "left", label: "Left", dir: [r[0], r[1], r[2]] },
			{ id: "top", label: "Top", dir: up },
		];
	})();

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

	// Play a specific animation in the 3D preview
	const playPreviewAnim = useCallback((clipName: string) => {
		const mixer = previewMixerRef.current;
		const anims = previewAnimsRef.current;
		if (!mixer || !anims.length) return;

		// Toggle: if same clip playing, stop it
		if (previewingAnim === clipName) {
			mixer.stopAllAction();
			setPreviewingAnim(null);
			return;
		}

		// Find by name, fall back to index match
		let clip = anims.find((c: any) => c.name === clipName);
		if (!clip) {
			const idx = animNamesRef.current.indexOf(clipName);
			if (idx >= 0 && idx < anims.length) clip = anims[idx];
		}
		if (!clip) return;

		mixer.stopAllAction();
		mixer.clipAction(clip).reset().play();
		setPreviewingAnim(clipName);
	}, [previewingAnim]);

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

	const initPreviewRenderer = useCallback(async (loaded: LoadedModel, frontDir?: { x: number; y: number; z: number }) => {
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

		// Detect model orientation and compute proper camera framing
		const bbox = new THREE.Box3().setFromObject(loaded.model);
		const bsize = bbox.getSize(new THREE.Vector3());
		const bcenter = bbox.getCenter(new THREE.Vector3());
		const isZUp = bsize.z > bsize.y;

		const fovDeg = 35;
		const fovRad = fovDeg * Math.PI / 180;
		const aspect = w / h;

		// Fit the model's HEIGHT in the frame — characters are tall and the panel is portrait.
		// Width overflow is fine (arms may extend past edges); user can orbit/zoom to adjust.
		const modelHeight = isZUp ? bsize.z : bsize.y;
		const halfVFov = fovRad / 2;
		const distForHeight = (modelHeight / 2) / Math.tan(halfVFov);
		// 2.0x padding = model fills ~50% of frame height (guarantees head-to-toe visible)
		const camDist = Math.max(distForHeight * 2.0, 2);

		// Camera — use detected front direction, or fall back to axis default
		const camera = new THREE.PerspectiveCamera(fovDeg, aspect, 0.1, 100);
		const upVec = new THREE.Vector3(0, isZUp ? 0 : 1, isZUp ? 1 : 0);
		const defaultDir = isZUp ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, -1);
		const camDir = frontDir ? new THREE.Vector3(frontDir.x, frontDir.y, frontDir.z) : defaultDir;

		// Shift orbit target slightly above bbox center so model appears
		// centered visually (head/shoulders have more visual weight than feet).
		const heightOffset = modelHeight * 0.15; // push target up → model shifts down in frame
		const target = bcenter.clone();
		if (isZUp) target.z += heightOffset; else target.y += heightOffset;

		camera.position.set(
			target.x + camDir.x * camDist,
			target.y + camDir.y * camDist,
			target.z + camDir.z * camDist,
		);
		camera.up.copy(upVec);
		camera.lookAt(target.x, target.y, target.z);

		// OrbitControls — user can drag to rotate, scroll to zoom
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		controls.target.copy(target);
		controls.update();

		// Use loaded.model directly — it's already a SkeletonUtils.clone from loadModel.
		// Double-cloning breaks skeleton↔bone binding (skeleton refs ≠ scene graph bones).
		const previewModel = loaded.model;
		scene.add(previewModel);
		previewModelRef.current = previewModel;

		// Play first animation if available
		let mixer: any = null;
		if (loaded.animations.length > 0) {
			mixer = new THREE.AnimationMixer(previewModel);
			const action = mixer.clipAction(loaded.animations[0]);
			action.play();
		}
		previewMixerRef.current = mixer;
		previewAnimsRef.current = loaded.animations;

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

		// Render loop — read mixer from ref so playPreviewAnim changes are picked up
		const clock = new THREE.Clock();
		const gizmoUpdate = updateGizmo;
		const mixerRef = previewMixerRef;
		function animate() {
			previewAnimFrameRef.current = requestAnimationFrame(animate);
			const delta = clock.getDelta();
			if (mixerRef.current) mixerRef.current.update(delta);
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
		setAnimRenames({});
		setEditingAnim(null);
		setModelFrontDir(null);
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

			// Auto-detect which direction the model faces
			const frontDir = await capture.detectModelFront(loaded);
			setModelFrontDir(frontDir);

			const names = capture.getAnimationNames(loaded);
			setAnimNames(names);
			animNamesRef.current = names;
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

			// Start interactive preview — use detected front for initial camera
			await initPreviewRenderer(loaded, frontDir);

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
		setGenerationId(prev => prev + 1);

		try {
			const capture = getCaptureInstance();
			await capture.init(frameSize, frameSize);

			// Sync preview camera direction and zoom factor
			if (previewCameraRef.current && orbitControlsRef.current) {
				const THREE = capture.getThree();
				const dir = new THREE.Vector3()
					.subVectors(previewCameraRef.current.position, orbitControlsRef.current.target)
					.normalize();
				capture.setCameraDirection({ x: dir.x, y: dir.y, z: dir.z });
			}
			capture.setZoomFactor(captureZoom);

			const newResults: StoredSpritesheet[] = [];

			if (animNames.length > 0 && selectedAnims.size > 0) {
				const anims = [...selectedAnims];

				// Pre-scan ALL selected animations to compute a single shared frustum.
				// This ensures the character is the SAME size in every spritesheet —
				// critical for game use where sprites must be interchangeable.
				setPhase("capturing");
				await capture.precomputeSharedFrustum(loadedModel, anims, frameCount, (pct) => {
					setProgress(pct * 0.2); // Pre-scan = first 20%
				});

				for (let i = 0; i < anims.length; i++) {
					if (abortRef.current) break;
					const originalName = anims[i];
					const outputName = animRenames[originalName] || originalName;

					// Re-init before each animation to guarantee correct frame size
					await capture.init(frameSize, frameSize);
					setPhase("capturing");
					const frames = await capture.captureAnimation(loadedModel, {
						frames: frameCount,
						clipName: originalName,
						prefix: outputName,
					}, (pct) => {
						const base = i / anims.length;
						const slice = 1 / anims.length;
						setProgress(0.2 + (base + pct * slice) * 0.6); // 20-80% range
					});

					// Pack into its own atlas
					setPhase("packing");
					const packed = await packFrames(frames, { imageName: "sheet.png" });

					// Upload — use the renamed output name for storage path
					setPhase("uploading");
					const stored = await uploadSpritesheet(appId, spriteName, outputName, packed.atlasBlob, packed.metadata);
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

			capture.clearSharedFrustum();
			setResults(newResults);
			setProgress(1);
			setPhase("done");
			if (onGenerated && newResults.length > 0) onGenerated(newResults[0]);
		} catch (err: any) {
			getCaptureInstance().clearSharedFrustum();
			setPhase("error");
			setErrorMsg(err?.message || "Generation failed");
		}
	}, [loadedModel, frameSize, frameCount, rotationAxis, selectedAnims, animRenames, animNames, appId, spriteName, onGenerated, captureZoom]);

	// ---------------------------------------------------------------------------
	// Library
	// ---------------------------------------------------------------------------

	const loadLibrary = useCallback(async () => {
		setLibraryLoading(true);
		try {
			const sheets = await listSpritesheets(appId);
			setLibrarySheets(sheets);
			// Auto-expand all model groups
			const models = new Set(sheets.map((s) => s.modelName || s.name.split("_")[0]));
			setExpandedModels(models);
		} catch {
			setLibrarySheets([]);
		} finally {
			setLibraryLoading(false);
		}
	}, [appId]);

	// Load library when tab switches to it
	useEffect(() => {
		if (dialogTab === "library" && open) loadLibrary();
	}, [dialogTab, open, loadLibrary]);

	const handleDeleteSheet = useCallback(async (sheet: StoredSpritesheet) => {
		const model = sheet.modelName || sheet.name.split("_")[0];
		const anim = sheet.animName || sheet.name.split("_").slice(1).join("_");
		setDeletingSheets((prev) => new Set(prev).add(sheet.name));
		try {
			await deleteSpritesheet(appId, model, anim);
			setLibrarySheets((prev) => prev.filter((s) => s.name !== sheet.name));
		} finally {
			setDeletingSheets((prev) => {
				const next = new Set(prev);
				next.delete(sheet.name);
				return next;
			});
		}
	}, [appId]);

	const handleDeleteModel = useCallback(async (modelName: string, sheets: StoredSpritesheet[]) => {
		// Mark all sheets in this group as deleting
		const names = sheets.map((s) => s.name);
		setDeletingSheets((prev) => {
			const next = new Set(prev);
			names.forEach((n) => next.add(n));
			return next;
		});
		try {
			await Promise.all(
				sheets.map((s) => {
					const anim = s.animName || s.name.split("_").slice(1).join("_");
					return deleteSpritesheet(appId, modelName, anim);
				}),
			);
			setLibrarySheets((prev) => prev.filter((s) => !names.includes(s.name)));
		} finally {
			setDeletingSheets((prev) => {
				const next = new Set(prev);
				names.forEach((n) => next.delete(n));
				return next;
			});
		}
	}, [appId]);

	// Import from other projects
	const loadImportProjects = useCallback(async () => {
		setImportLoading(true);
		try {
			const projects = await listProjectsWithSheets(appId);
			setImportProjects(projects);
			// Auto-expand first project
			if (projects.length > 0) setExpandedImportProjects(new Set([projects[0].appId]));
		} catch {
			setImportProjects([]);
		} finally {
			setImportLoading(false);
		}
	}, [appId]);

	const handleImportSelected = useCallback(async () => {
		if (importSelected.size === 0) return;
		// Group by source project
		const byProject = new Map<string, Array<{ modelName: string; animName: string }>>();
		for (const key of importSelected) {
			const [srcAppId, model, anim] = key.split("|");
			if (!byProject.has(srcAppId)) byProject.set(srcAppId, []);
			byProject.get(srcAppId)!.push({ modelName: model, animName: anim });
		}
		setImportingSheets(new Set(importSelected));
		var totalImported = 0;
		for (const [srcAppId, sheets] of byProject) {
			try {
				const result = await importSpritesheets(srcAppId, appId, sheets);
				totalImported += result.imported;
			} catch { /* ignore */ }
		}
		setImportingSheets(new Set());
		setImportSelected(new Set());
		if (totalImported > 0) {
			setShowImport(false);
			loadLibrary(); // Refresh library to show imported sheets
		}
	}, [importSelected, appId, loadLibrary]);

	const toggleImportSheet = useCallback((key: string) => {
		setImportSelected((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const selectAllFromProject = useCallback((project: ProjectWithSheets) => {
		setImportSelected((prev) => {
			const next = new Set(prev);
			var allSelected = true;
			for (const s of project.sheets) {
				const key = `${project.appId}|${s.modelName || ""}|${s.animName || ""}`;
				if (!next.has(key)) allSelected = false;
			}
			for (const s of project.sheets) {
				const key = `${project.appId}|${s.modelName || ""}|${s.animName || ""}`;
				if (allSelected) next.delete(key);
				else next.add(key);
			}
			return next;
		});
	}, []);

	// Group library sheets by model name
	const libraryGroups = (() => {
		const groups = new Map<string, StoredSpritesheet[]>();
		for (const sheet of librarySheets) {
			const model = sheet.modelName || sheet.name.split("_")[0];
			if (!groups.has(model)) groups.set(model, []);
			groups.get(model)!.push(sheet);
		}
		return groups;
	})();

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	const isWorking = phase === "loading" || phase === "capturing" || phase === "packing" || phase === "uploading";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!w-[900px] max-w-[96vw] max-h-[92vh] p-0 gap-0 overflow-hidden !bg-[#0d0d1a] border border-white/10 [&>button]:hidden" style={{ backgroundColor: "#0d0d1a" }}>
				{/* Solid background layer to override glass transparency */}
				<div className="absolute inset-0 bg-[#0d0d1a] rounded-[12px] z-[1]" />
				<div className="relative z-[2] flex flex-col h-full">
				<DialogHeader className="px-5 py-3 border-b border-white/[0.06]">
					<div className="flex items-center justify-between">
						<DialogTitle className="flex items-center gap-2 text-base font-medium text-white/90">
							<Grid3X3 className="size-4 text-blue-400" />
							3D → 2D Spritesheet Generator
						</DialogTitle>
						<div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5">
							<button
								onClick={() => setDialogTab("generate")}
								className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
									dialogTab === "generate"
										? "bg-blue-500/20 text-blue-400"
										: "text-white/40 hover:text-white/60"
								}`}
							>
								<Camera className="size-3 inline mr-1" />
								Generate
							</button>
							<button
								onClick={() => setDialogTab("library")}
								className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
									dialogTab === "library"
										? "bg-blue-500/20 text-blue-400"
										: "text-white/40 hover:text-white/60"
								}`}
							>
								<FolderOpen className="size-3 inline mr-1" />
								Library
								{librarySheets.length > 0 && (
									<span className="ml-1 text-[10px] opacity-60">({librarySheets.length})</span>
								)}
							</button>
						</div>
					</div>
					<DialogDescription className="sr-only">
						Load a 3D model, orbit to choose your camera angle, and generate per-animation spritesheets.
					</DialogDescription>
				</DialogHeader>

				{dialogTab === "library" ? (
					/* ============================================================
					   LIBRARY TAB — browse & manage stored spritesheets
					   ============================================================ */
					<div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "calc(92vh - 56px)" }}>
						{/* Import from Projects panel */}
						{showImport && (
							<div className="mb-4 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3 space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium text-cyan-300">Import from Other Projects</span>
									<div className="flex items-center gap-2">
										{importSelected.size > 0 && (
											<button
												onClick={handleImportSelected}
												disabled={importingSheets.size > 0}
												className="text-[11px] bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 px-3 py-1 rounded transition-colors disabled:opacity-50"
											>
												{importingSheets.size > 0 ? (
													<><Loader2 className="size-3 animate-spin inline mr-1" />Importing...</>
												) : (
													<>Import {importSelected.size} selected</>
												)}
											</button>
										)}
										<button
											onClick={() => { setShowImport(false); setImportSelected(new Set()); }}
											className="text-[10px] text-white/30 hover:text-white/60 px-2 py-0.5 rounded transition-colors"
										>
											Close
										</button>
									</div>
								</div>
								{importLoading ? (
									<div className="flex items-center justify-center h-24 text-white/30">
										<Loader2 className="size-4 animate-spin mr-2" />
										Loading projects...
									</div>
								) : importProjects.length === 0 ? (
									<div className="text-center text-white/20 text-xs py-6">
										No other projects with spritesheets found
									</div>
								) : (
									<div className="space-y-2 max-h-[40vh] overflow-y-auto">
										{importProjects.map((project) => (
											<div key={project.appId} className="rounded border border-white/[0.06] overflow-hidden">
												<button
													onClick={() => setExpandedImportProjects((prev) => {
														const next = new Set(prev);
														if (next.has(project.appId)) next.delete(project.appId);
														else next.add(project.appId);
														return next;
													})}
													className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
												>
													<div className="flex items-center gap-2 text-left">
														<span className={`text-[10px] text-white/30 transition-transform ${expandedImportProjects.has(project.appId) ? "rotate-90" : ""}`}>&#9654;</span>
														<span className="text-xs text-white/70 truncate max-w-[300px]">{project.name}</span>
														<span className="text-[10px] text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded shrink-0">
															{project.sheetCount} sprite{project.sheetCount > 1 ? "s" : ""}
														</span>
													</div>
													<button
														onClick={(e) => { e.stopPropagation(); selectAllFromProject(project); }}
														className="text-[10px] text-cyan-400/60 hover:text-cyan-400 px-2 py-0.5 rounded transition-colors"
													>
														Select All
													</button>
												</button>
												{expandedImportProjects.has(project.appId) && (
													<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 p-2">
														{project.sheets.map((sheet) => {
															const key = `${project.appId}|${sheet.modelName || ""}|${sheet.animName || ""}`;
															const isSelected = importSelected.has(key);
															const isImporting = importingSheets.has(key);
															return (
																<button
																	key={key}
																	onClick={() => toggleImportSheet(key)}
																	disabled={isImporting}
																	className={`relative flex flex-col rounded border overflow-hidden transition-all ${
																		isSelected
																			? "border-cyan-400/60 bg-cyan-500/10"
																			: "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
																	} ${isImporting ? "opacity-40" : ""}`}
																>
																	<div className="aspect-[2/1] bg-[#080812] flex items-center justify-center overflow-hidden">
																		<img
																			src={sheet.atlasUrl}
																			alt={sheet.name}
																			className="max-w-full max-h-full object-contain"
																			style={{ imageRendering: "pixelated" }}
																		/>
																	</div>
																	<div className="px-1.5 py-1 text-[10px] text-white/50 truncate">
																		{sheet.animName || sheet.name}
																	</div>
																	{isSelected && (
																		<div className="absolute top-1 right-1 bg-cyan-500 rounded-full p-0.5">
																			<Check className="size-2.5 text-white" />
																		</div>
																	)}
																</button>
															);
														})}
													</div>
												)}
											</div>
										))}
									</div>
								)}
							</div>
						)}

						{libraryLoading ? (
							<div className="flex items-center justify-center h-48 text-white/30">
								<Loader2 className="size-5 animate-spin mr-2" />
								Loading library...
							</div>
						) : librarySheets.length === 0 && !showImport ? (
							<div className="flex flex-col items-center justify-center h-48 text-white/30 gap-2">
								<FolderOpen className="size-8 opacity-30" />
								<span className="text-sm">No spritesheets yet</span>
								<span className="text-xs text-white/20">Generate some sprites or import from other projects</span>
								<button
									onClick={() => { setShowImport(true); loadImportProjects(); }}
									className="mt-2 text-xs text-cyan-400/70 hover:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/15 px-3 py-1.5 rounded transition-colors"
								>
									Import from Other Projects
								</button>
							</div>
						) : (
							<div className="space-y-3">
								{/* Summary bar */}
								<div className="flex items-center justify-between text-xs text-white/30 pb-2 border-b border-white/[0.06]">
									<span>{librarySheets.length} spritesheet{librarySheets.length > 1 ? "s" : ""} across {libraryGroups.size} model{libraryGroups.size > 1 ? "s" : ""}</span>
									<div className="flex items-center gap-3">
										<button
											onClick={() => { setShowImport(!showImport); if (!showImport) loadImportProjects(); }}
											className="text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
										>
											{showImport ? "Hide Import" : "Import from Projects"}
										</button>
										<button
											onClick={loadLibrary}
											className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
										>
											Refresh
										</button>
									</div>
								</div>

								{/* Model groups */}
								{[...libraryGroups.entries()].map(([modelName, sheets]) => (
									<div key={modelName} className="rounded-lg border border-white/[0.06] overflow-hidden">
										{/* Group header */}
										<button
											onClick={() => setExpandedModels((prev) => {
												const next = new Set(prev);
												if (next.has(modelName)) next.delete(modelName);
												else next.add(modelName);
												return next;
											})}
											className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
										>
											<div className="flex items-center gap-2">
												<span className={`text-[10px] text-white/30 transition-transform ${expandedModels.has(modelName) ? "rotate-90" : ""}`}>▶</span>
												<span className="text-sm font-medium text-white/70">{modelName}</span>
												<span className="text-[10px] text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded">
													{sheets.length} sprite{sheets.length > 1 ? "s" : ""}
												</span>
											</div>
											<button
												onClick={(e) => {
													e.stopPropagation();
													handleDeleteModel(modelName, sheets);
												}}
												className="text-[10px] text-red-400/50 hover:text-red-400 hover:bg-red-500/10 px-2 py-0.5 rounded transition-colors"
												title={`Delete all ${modelName} spritesheets`}
											>
												<Trash2 className="size-3 inline mr-0.5" />
												Delete All
											</button>
										</button>

										{/* Expanded: sprite cards grid */}
										{expandedModels.has(modelName) && (
											<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
												{sheets.map((sheet) => {
													const isDeleting = deletingSheets.has(sheet.name);
													const displayAnim = sheet.animName || sheet.name.split("_").slice(1).join("_") || "default";
													return (
														<div
															key={sheet.name}
															className={`group relative flex flex-col rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-opacity ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
														>
															{/* Atlas thumbnail */}
															<div className="relative aspect-[2/1] bg-[#080812] flex items-center justify-center overflow-hidden">
																<img
																	src={sheet.atlasUrl}
																	alt={sheet.name}
																	className="max-w-full max-h-full object-contain"
																	style={{ imageRendering: "pixelated" }}
																/>
																{/* Delete button overlay */}
																<button
																	onClick={() => handleDeleteSheet(sheet)}
																	className="absolute top-1 right-1 p-1 rounded bg-black/60 text-red-400/60 hover:text-red-400 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all"
																	title="Delete this spritesheet"
																>
																	<Trash2 className="size-3" />
																</button>
															</div>
															{/* Label */}
															<div className="px-2 py-1.5">
																<div className="text-[11px] text-white/60 font-medium truncate">{displayAnim}</div>
															</div>
														</div>
													);
												})}
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				) : (
				<div className="flex flex-col md:flex-row overflow-x-hidden overflow-y-auto" style={{ maxHeight: "calc(92vh - 56px)" }}>
					{/* Left column: Interactive 3D Preview / Results */}
					<div className="hidden md:flex md:w-[380px] flex-shrink-0 border-r border-white/[0.06] flex-col">
						{phase === "done" && results.length > 0 ? (
							<div className="flex-1 flex flex-col bg-[#080812] p-3 gap-2 overflow-y-auto">
								<span className="text-[10px] uppercase tracking-wider text-white/30 text-center">
									Generated Sheets ({results.length})
								</span>
								{results.map((r) => (
									<div key={r.name} className="flex flex-col items-center gap-1">
										<img
											src={`${r.atlasUrl}${r.atlasUrl.includes('?') ? '&' : '?'}_cb=${generationId}`}
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
									{[128, 256, 512, 1024].map((s) => (
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
								<div className="flex flex-wrap gap-1">
									{[4, 8, 12, 16, 24, 32].map((c) => (
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

							{/* Capture Zoom — controls character size in output */}
							{loadedModel && (
								<div>
									<label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">
										Character Scale — {Math.round((1 / captureZoom) * 100)}%
									</label>
									<input
										type="range"
										min="0.4"
										max="1.5"
										step="0.05"
										value={captureZoom}
										onChange={(e) => setCaptureZoom(parseFloat(e.target.value))}
										className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/[0.06] accent-blue-500"
									/>
									<div className="flex justify-between text-[9px] text-white/20 mt-0.5">
										<span>Large</span>
										<span>Auto</span>
										<span>Small</span>
									</div>
								</div>
							)}

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
										<span className="normal-case tracking-normal ml-1 text-white/20">— click ✏️ to rename</span>
									</label>
									<div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto">
										{animNames.map((name) => {
											const displayName = animRenames[name] || name;
											const isEditing = editingAnim === name;

											if (isEditing) {
												return (
													<form
														key={name}
														className="flex items-center gap-1"
														onSubmit={(e) => {
															e.preventDefault();
															setEditingAnim(null);
														}}
													>
														<input
															autoFocus
															defaultValue={displayName}
															className="w-24 px-2 py-1 rounded text-xs bg-blue-500/10 border border-blue-500/40 text-white/90 focus:outline-none"
															onBlur={(e) => {
																const val = e.target.value.trim();
																if (val && val !== name) {
																	setAnimRenames((prev) => ({ ...prev, [name]: val }));
																} else if (!val || val === name) {
																	setAnimRenames((prev) => {
																		const next = { ...prev };
																		delete next[name];
																		return next;
																	});
																}
																setEditingAnim(null);
															}}
															onKeyDown={(e) => {
																if (e.key === "Escape") setEditingAnim(null);
															}}
														/>
													</form>
												);
											}

											return (
												<div key={name} className="flex items-center gap-0.5">
													{/* Play/Stop preview button */}
													<button
														onClick={(e) => {
															e.stopPropagation();
															playPreviewAnim(name);
														}}
														title={previewingAnim === name ? `Stop ${displayName}` : `Preview ${displayName}`}
														className={`p-1 rounded transition-colors ${
															previewingAnim === name
																? "text-blue-400 bg-blue-500/20"
																: "text-white/20 hover:text-white/50 hover:bg-white/[0.04]"
														}`}
													>
														{previewingAnim === name
															? <Square className="size-3 fill-current" />
															: <Play className="size-3 fill-current" />
														}
													</button>
													{/* Select / rename button */}
													<button
														onClick={() => {
															setSelectedAnims((prev) => {
																const next = new Set(prev);
																if (next.has(name)) next.delete(name);
																else next.add(name);
																return next;
															});
														}}
														onDoubleClick={(e) => {
															e.preventDefault();
															setEditingAnim(name);
														}}
														className={`group flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
															selectedAnims.has(name)
																? "bg-emerald-500/20 text-emerald-400"
																: "text-white/30 bg-white/[0.03]"
														}`}
													>
														{selectedAnims.has(name) ? "✓ " : ""}
														{displayName}
														{animRenames[name] && (
															<span className="text-[9px] text-white/15">({name})</span>
														)}
														<span
															role="button"
															onClick={(e) => {
																e.stopPropagation();
																setEditingAnim(name);
															}}
															className="inline-flex cursor-pointer"
														>
															<Pencil className="size-2.5 opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity flex-shrink-0" />
														</span>
													</button>
												</div>
											);
										})}
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
				)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
