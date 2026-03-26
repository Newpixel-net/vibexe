/**
 * Spritesheet Capture Engine — Renders 3D models into 2D sprite frame sequences.
 *
 * Uses an offscreen Three.js WebGLRenderer to capture:
 * - Rotation sequences (turntable capture around any axis)
 * - Skeletal animation frames (idle, walk, attack, etc.)
 * - Multi-angle captures (4/8 directions × animation frames)
 *
 * Key design decisions based on research:
 * - Orthographic camera (no perspective distortion — standard for 2D game sprites)
 * - toDataURL() for synchronous frame capture (toBlob is async and unreliable)
 * - Camera positioned at model's bounding box center height
 * - Height-based scaling so characters fill the frame vertically
 */

export interface CapturedFrame {
	name: string;
	blob: Blob;
	width: number;
	height: number;
}

export interface LoadedModel {
	model: any; // THREE.Group
	animations: any[]; // THREE.AnimationClip[]
	mixer: any | null; // THREE.AnimationMixer | null
	url?: string; // source URL for re-cloning from cache
}

export interface RotationCaptureConfig {
	frames: number;
	axis: "x" | "y" | "z";
	prefix?: string;
}

export interface AnimationCaptureConfig {
	frames: number;
	clipName?: string;
	prefix?: string;
}

export interface MultiAngleCaptureConfig {
	angles: number;
	animFrames: number;
	clips?: string[];
}

const ANGLE_NAMES_8 = [
	"front", "front-right", "right", "back-right",
	"back", "back-left", "left", "front-left",
];
const ANGLE_NAMES_4 = ["front", "right", "back", "left"];

let _instance: SpritesheetCapture | null = null;

export class SpritesheetCapture {
	private THREE: any = null;
	private GLTFLoader: any = null;
	private SkeletonUtils: any = null;
	private renderer: any = null;
	private scene: any = null;
	private camera: any = null;
	private modelCache = new Map<string, any>();
	private initialized = false;
	private initPromise: Promise<void> | null = null;
	private frameWidth = 128;
	private frameHeight = 128;
	private _cameraDirection: { x: number; y: number; z: number } | null = null;
	private _heightAxis: "y" | "z" = "y"; // Detected once on model load
	private _lockedCameraState: { pos: any; up: any; target: any } | null = null;

	async init(width = 128, height = 128): Promise<void> {
		this.frameWidth = width;
		this.frameHeight = height;

		if (this.initialized && this.renderer) {
			this.renderer.setSize(width, height);
			return;
		}
		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			try {
				// @ts-ignore
				const THREE = await import("three");
				// @ts-ignore
				const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
				// @ts-ignore
				const { SkeletonUtils } = await import("three/examples/jsm/utils/SkeletonUtils.js");

				this.THREE = THREE;
				this.GLTFLoader = GLTFLoader;
				this.SkeletonUtils = SkeletonUtils;

				// Offscreen renderer — never attached to DOM
				this.renderer = new THREE.WebGLRenderer({
					antialias: true,
					alpha: true,
					preserveDrawingBuffer: true,
				});
				this.renderer.setSize(width, height);
				this.renderer.setPixelRatio(1);
				this.renderer.outputColorSpace = THREE.SRGBColorSpace;
				this.renderer.setClearColor(0x000000, 0);

				// Scene with front-facing lighting
				this.scene = new THREE.Scene();
				this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
				const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
				keyLight.position.set(1, 2, -3); // In front of model (model faces -Z)
				this.scene.add(keyLight);
				const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
				fillLight.position.set(-1, 1, 2);
				this.scene.add(fillLight);

				// Orthographic camera — no perspective distortion, standard for game sprites
				// Frustum will be set dynamically by fitCameraToModel()
				this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
				this.camera.position.set(0, 0, -5); // In front of model (faces -Z)
				this.camera.lookAt(0, 0, 0);

				this.initialized = true;
			} catch (err) {
				console.warn("[SpritesheetCapture] Three.js not available:", err);
				this.initPromise = null;
			}
		})();

		return this.initPromise;
	}

	/** Load a 3D model from URL */
	async loadModel(url: string): Promise<LoadedModel> {
		await this.init(this.frameWidth, this.frameHeight);
		if (!this.initialized) throw new Error("Three.js not initialized");

		const THREE = this.THREE;

		return new Promise((resolve, reject) => {
			const loader = new this.GLTFLoader();
			loader.load(
				url,
				(gltf: any) => {
					const animations = gltf.animations || [];

					// SkeletonUtils.clone preserves skeleton bindings for animated models
					const model = animations.length > 0 && this.SkeletonUtils
						? this.SkeletonUtils.clone(gltf.scene)
						: gltf.scene.clone();

					// Center model at origin and detect height axis
					this.centerModel(model);

					// Detect height axis ONCE from bind pose (before any animation)
					model.updateMatrixWorld(true);
					const loadBox = new THREE.Box3().setFromObject(model);
					const loadSize = loadBox.getSize(new THREE.Vector3());
					this._heightAxis = loadSize.z > loadSize.y ? "z" : "y";

					let mixer: any = null;
					if (animations.length > 0) {
						mixer = new THREE.AnimationMixer(model);
					}

					if (!this.modelCache.has(url)) {
						this.modelCache.set(url, gltf);
					}

					resolve({ model, animations, mixer, url });
				},
				undefined,
				(err: any) => reject(err),
			);
		});
	}

	/** Center model at origin without scaling — scaling is done by camera frustum */
	private centerModel(model: any): void {
		const THREE = this.THREE;
		model.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(model);
		const center = box.getCenter(new THREE.Vector3());
		const size = box.getSize(new THREE.Vector3());
		// Debug: expose bounding box info
		(globalThis as any).__modelBBox = {
			min: { x: box.min.x.toFixed(3), y: box.min.y.toFixed(3), z: box.min.z.toFixed(3) },
			max: { x: box.max.x.toFixed(3), y: box.max.y.toFixed(3), z: box.max.z.toFixed(3) },
			size: { x: size.x.toFixed(3), y: size.y.toFixed(3), z: size.z.toFixed(3) },
			center: { x: center.x.toFixed(3), y: center.y.toFixed(3), z: center.z.toFixed(3) },
		};
		model.position.sub(center);
	}

	/** Reload model completely from scratch — no cloning, fresh GLTF load.
	 *  This guarantees pristine skeleton bindings with zero shared state. */
	private async reloadModelFresh(loaded: LoadedModel): Promise<LoadedModel> {
		if (!loaded.url) {
			// Fallback: clone from loaded.model
			const model = this.SkeletonUtils
				? this.SkeletonUtils.clone(loaded.model)
				: loaded.model.clone();
			this.centerModel(model);
			return { model, animations: loaded.animations, mixer: null };
		}

		const THREE = this.THREE;
		return new Promise((resolve, reject) => {
			const loader = new this.GLTFLoader();
			loader.load(
				loaded.url!,
				(gltf: any) => {
					const model = gltf.scene; // Use the scene DIRECTLY — no cloning
					this.centerModel(model);
					resolve({ model, animations: gltf.animations || [], mixer: null, url: loaded.url });
				},
				undefined,
				(err: any) => reject(err),
			);
		});
	}

	/** Fit the orthographic camera to show the model filling the frame.
	 *  Camera DIRECTION is locked on first call — only frustum size adapts per animation. */
	private fitCameraToModel(model: any, padding = 1.15): void {
		const THREE = this.THREE;
		model.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(model);
		const size = box.getSize(new THREE.Vector3());
		const center = box.getCenter(new THREE.Vector3());
		const heightAxis = this._heightAxis;

		// Frustum: use the model's height along the detected axis
		const modelHeight = heightAxis === "z" ? size.z : size.y;
		const halfExtent = Math.max((modelHeight * padding) / 2, 0.5);

		this.camera.left = -halfExtent;
		this.camera.right = halfExtent;
		this.camera.top = halfExtent;
		this.camera.bottom = -halfExtent;
		this.camera.updateProjectionMatrix();

		// Camera position/direction: compute ONCE, then reuse for all animations
		if (!this._lockedCameraState) {
			const distance = 5;
			const upVec = new THREE.Vector3(0, heightAxis === "z" ? 0 : 1, heightAxis === "z" ? 1 : 0);
			let camPos: any;
			let camTarget = new THREE.Vector3(center.x, center.y, center.z);

			if (this._cameraDirection) {
				const dir = this._cameraDirection;
				camPos = new THREE.Vector3(
					center.x + dir.x * distance,
					center.y + dir.y * distance,
					center.z + dir.z * distance,
				);
			} else if (heightAxis === "z") {
				camPos = new THREE.Vector3(center.x, center.y - distance, center.z);
			} else {
				camPos = new THREE.Vector3(center.x, center.y, center.z - distance);
			}

			this._lockedCameraState = { pos: camPos.clone(), up: upVec.clone(), target: camTarget.clone() };
		}

		// Apply the locked camera state
		this.camera.position.copy(this._lockedCameraState.pos);
		this.camera.up.copy(this._lockedCameraState.up);
		this.camera.lookAt(this._lockedCameraState.target);
	}

	/** Call before a new generation batch to reset locked camera */
	resetCameraLock(): void {
		this._lockedCameraState = null;
	}

	/** Capture a single frame — SYNCHRONOUS using toDataURL */
	private captureFrameSync(): Blob {
		this.renderer.render(this.scene, this.camera);
		const dataUrl: string = this.renderer.domElement.toDataURL("image/png");
		// Convert data URL to Blob
		const byteString = atob(dataUrl.split(",")[1]);
		const ab = new ArrayBuffer(byteString.length);
		const ia = new Uint8Array(ab);
		for (let i = 0; i < byteString.length; i++) {
			ia[i] = byteString.charCodeAt(i);
		}
		return new Blob([ab], { type: "image/png" });
	}

	/** Render a single preview frame */
	renderPreview(loaded: LoadedModel): HTMLCanvasElement | null {
		if (!this.initialized || !this.renderer) return null;
		this.setModel(loaded.model);
		this.fitCameraToModel(loaded.model);
		this.renderer.render(this.scene, this.camera);
		return this.renderer.domElement;
	}

	/** Add model to scene, removing any previous model (keeps lights) */
	private setModel(model: any): void {
		while (this.scene.children.length > 3) {
			this.scene.remove(this.scene.children[this.scene.children.length - 1]);
		}
		this.scene.add(model);
	}

	/** Capture a rotation sequence */
	async captureRotation(
		loaded: LoadedModel,
		config: Partial<RotationCaptureConfig> = {},
		onProgress?: (pct: number) => void,
	): Promise<CapturedFrame[]> {
		const frames = config.frames || 30;
		const axis = config.axis || "y";
		const prefix = config.prefix || "rotate";

		this.setModel(loaded.model);
		this.fitCameraToModel(loaded.model);
		const originalRotation = loaded.model.rotation.clone();
		const result: CapturedFrame[] = [];

		for (let i = 0; i < frames; i++) {
			const angle = (Math.PI * 2 * i) / frames;
			loaded.model.rotation.copy(originalRotation);
			if (axis === "x") loaded.model.rotation.x += angle;
			else if (axis === "y") loaded.model.rotation.y += angle;
			else loaded.model.rotation.z += angle;

			const blob = this.captureFrameSync();
			result.push({
				name: `${prefix}_${String(i).padStart(4, "0")}`,
				blob,
				width: this.frameWidth,
				height: this.frameHeight,
			});

			if (onProgress) onProgress((i + 1) / frames);
			// Yield to UI every few frames
			if (i % 4 === 0) await new Promise(r => setTimeout(r, 0));
		}

		loaded.model.rotation.copy(originalRotation);
		this.scene.remove(loaded.model);
		return result;
	}

	/**
	 * Capture animation frames from a skeletal animation clip.
	 * Uses incremental mixer.update(delta) — the same pattern that works in the preview.
	 * Uses synchronous toDataURL() to prevent async timing issues.
	 */
	async captureAnimation(
		loaded: LoadedModel,
		config: Partial<AnimationCaptureConfig> = {},
		onProgress?: (pct: number) => void,
	): Promise<CapturedFrame[]> {
		if (loaded.animations.length === 0) {
			throw new Error("Model has no animations");
		}

		const THREE = this.THREE;
		const frames = config.frames || 16;
		const clip = config.clipName
			? loaded.animations.find((c: any) => c.name === config.clipName)
			: loaded.animations[0];

		if (!clip) {
			throw new Error(`Animation clip not found: ${config.clipName || "(first)"}`);
		}

		const prefix = config.prefix || clip.name || "anim";
		const clipName = config.clipName || clip.name;

		// RELOAD the model from scratch for pristine skeleton bindings
		const captureLoaded = await this.reloadModelFresh(loaded);
		const captureModel = captureLoaded.model;
		this.setModel(captureModel);

		const freshClip = captureLoaded.animations.find((c: any) => c.name === clipName)
			|| captureLoaded.animations[0];

		const clipDuration = freshClip.duration;
		const step = 1 / 60;

		// Helper: advance a fresh mixer to a target time using small steps
		const advanceToTime = (model: any, animClip: any, targetTime: number) => {
			const m = new THREE.AnimationMixer(model);
			const a = m.clipAction(animClip);
			a.play();
			let t = 0;
			while (t < targetTime) {
				const dt = Math.min(step, targetTime - t);
				m.update(dt);
				t += dt;
			}
			if (targetTime === 0) m.update(0.001);
			model.updateMatrixWorld(true);
			return { mixer: m, action: a };
		};

		// =====================================================================
		// PASS 1: Pre-scan ALL frames to find the MAXIMUM bounding box.
		// This is the professional "Fit All Frames" approach — ensures no frame
		// clips the character, even with root motion (kicks, falls, etc.).
		// =====================================================================
		const maxBox = new THREE.Box3(
			new THREE.Vector3(Infinity, Infinity, Infinity),
			new THREE.Vector3(-Infinity, -Infinity, -Infinity),
		);

		for (let i = 0; i < frames; i++) {
			const targetTime = (clipDuration * i) / frames;
			const { mixer, action } = advanceToTime(captureModel, freshClip, targetTime);
			const frameBox = new THREE.Box3().setFromObject(captureModel);
			maxBox.union(frameBox);
			action.stop();
			mixer.stopAllAction();
		}

		// Fit camera to the MAX bounding box (not a single frame's box)
		const maxSize = maxBox.getSize(new THREE.Vector3());
		const maxCenter = maxBox.getCenter(new THREE.Vector3());
		const heightAxis = this._heightAxis;
		const modelHeight = heightAxis === "z" ? maxSize.z : maxSize.y;
		const halfExtent = Math.max((modelHeight * 1.1) / 2, 0.5);

		this.camera.left = -halfExtent;
		this.camera.right = halfExtent;
		this.camera.top = halfExtent;
		this.camera.bottom = -halfExtent;
		this.camera.updateProjectionMatrix();

		// Lock camera direction (reuses locked state if already set)
		if (!this._lockedCameraState) {
			const distance = 5;
			const upVec = new THREE.Vector3(0, heightAxis === "z" ? 0 : 1, heightAxis === "z" ? 1 : 0);
			let camPos: any;
			if (this._cameraDirection) {
				const dir = this._cameraDirection;
				camPos = new THREE.Vector3(
					maxCenter.x + dir.x * distance,
					maxCenter.y + dir.y * distance,
					maxCenter.z + dir.z * distance,
				);
			} else if (heightAxis === "z") {
				camPos = new THREE.Vector3(maxCenter.x, maxCenter.y - distance, maxCenter.z);
			} else {
				camPos = new THREE.Vector3(maxCenter.x, maxCenter.y, maxCenter.z - distance);
			}
			this._lockedCameraState = { pos: camPos.clone(), up: upVec.clone(), target: maxCenter.clone() };
		}

		this.camera.position.copy(this._lockedCameraState.pos);
		this.camera.up.copy(this._lockedCameraState.up);
		this.camera.lookAt(this._lockedCameraState.target);

		// =====================================================================
		// PASS 2: Render each frame at the locked camera position
		// =====================================================================
		const result: CapturedFrame[] = [];

		for (let i = 0; i < frames; i++) {
			const targetTime = (clipDuration * i) / frames;
			const { mixer, action } = advanceToTime(captureModel, freshClip, targetTime);

			await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

			const blob = this.captureFrameSync();
			result.push({
				name: `${prefix}_${String(i).padStart(4, "0")}`,
				blob,
				width: this.frameWidth,
				height: this.frameHeight,
			});

			action.stop();
			mixer.stopAllAction();
			if (onProgress) onProgress((i + 1) / frames);
		}

		this.scene.remove(captureModel);
		return result;
	}

	/** Capture from multiple camera angles */
	async captureMultiAngle(
		loaded: LoadedModel,
		config: Partial<MultiAngleCaptureConfig> = {},
		onProgress?: (pct: number) => void,
	): Promise<Map<string, CapturedFrame[]>> {
		const numAngles = config.angles || 8;
		const animFrames = config.animFrames || 8;
		const angleNames = numAngles === 4 ? ANGLE_NAMES_4 : ANGLE_NAMES_8;
		const angleStep = (Math.PI * 2) / numAngles;

		const hasAnims = loaded.mixer && loaded.animations.length > 0;
		const clipNames = config.clips
			? config.clips
			: hasAnims
				? loaded.animations.map((c: any) => c.name || "anim")
				: [];

		const totalSteps = numAngles * (clipNames.length > 0 ? clipNames.length * animFrames : animFrames);
		let step = 0;

		const result = new Map<string, CapturedFrame[]>();
		const origCamPos = this.camera.position.clone();

		for (let a = 0; a < numAngles; a++) {
			const angleName = angleNames[a];
			const angle = angleStep * a;

			// Rotate camera around the model at its center height
			const radius = 5;
			this.camera.position.set(
				Math.sin(angle) * radius,
				origCamPos.y,
				-Math.cos(angle) * radius,
			);
			this.camera.lookAt(0, origCamPos.y, 0);
			this.camera.updateProjectionMatrix();

			if (clipNames.length > 0) {
				for (const clipName of clipNames) {
					const capturedFrames = await this.captureAnimation(loaded, {
						frames: animFrames,
						clipName,
						prefix: `${clipName}_${angleName}`,
					});
					result.set(`${clipName}_${angleName}`, capturedFrames);
					step += animFrames;
					if (onProgress) onProgress(step / totalSteps);
				}
			} else {
				const capturedFrames = await this.captureRotation(loaded, {
					frames: animFrames,
					prefix: `rotate_${angleName}`,
				});
				result.set(angleName, capturedFrames);
				step += animFrames;
				if (onProgress) onProgress(step / totalSteps);
			}
		}

		this.camera.position.copy(origCamPos);
		this.camera.lookAt(0, origCamPos.y, 0);
		return result;
	}

	getAnimationNames(loaded: LoadedModel): string[] {
		return loaded.animations.map((c: any, i: number) => c.name || `animation_${i}`);
	}

	getThree(): any {
		return this.THREE;
	}

	getCanvas(): HTMLCanvasElement | null {
		return this.renderer?.domElement || null;
	}

	/** Set viewing direction for capture (unit vector from target to camera).
	 *  Called from dialog to sync preview camera angle to capture. */
	setCameraDirection(dir: { x: number; y: number; z: number }): void {
		this._cameraDirection = dir;
	}

	setCameraPosition(x: number, y: number, z: number): void {
		if (this.camera) this.camera.position.set(x, y, z);
	}

	setCameraTarget(x: number, y: number, z: number): void {
		if (this.camera) this.camera.lookAt(x, y, z);
	}

	getCamera(): any {
		return this.camera;
	}

	async getOrbitControlsClass(): Promise<any> {
		await this.init(this.frameWidth, this.frameHeight);
		// @ts-ignore
		const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
		return OrbitControls;
	}

	dispose(): void {
		this.renderer?.dispose();
		this.modelCache.clear();
		this.initialized = false;
		this.initPromise = null;
		_instance = null;
	}
}

export function getCaptureInstance(): SpritesheetCapture {
	if (!_instance) {
		_instance = new SpritesheetCapture();
	}
	return _instance;
}
