/**
 * Spritesheet Capture Engine — Renders 3D models into 2D sprite frame sequences.
 *
 * Uses an offscreen Three.js WebGLRenderer to capture:
 * - Rotation sequences (turntable capture around any axis)
 * - Skeletal animation frames (idle, walk, attack, etc.)
 * - Multi-angle captures (4/8 directions × animation frames)
 *
 * Reuses the same singleton + dynamic import pattern as asset-thumbnail-renderer.ts.
 * Three.js is only loaded when the first capture is requested.
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
}

export interface RotationCaptureConfig {
	frames: number; // number of frames (default 30)
	axis: "x" | "y" | "z"; // rotation axis (default 'y')
	prefix?: string; // frame name prefix (default 'rotate')
}

export interface AnimationCaptureConfig {
	frames: number; // frames to sample from the animation (default 16)
	clipName?: string; // animation clip name (uses first if omitted)
	prefix?: string; // frame name prefix (default uses clip name)
}

export interface MultiAngleCaptureConfig {
	angles: number; // 4 or 8 camera angles
	animFrames: number; // frames per animation per angle
	clips?: string[]; // which animations to capture (all if omitted)
}

const ANGLE_NAMES_8 = [
	"front",
	"front-right",
	"right",
	"back-right",
	"back",
	"back-left",
	"left",
	"front-left",
];
const ANGLE_NAMES_4 = ["front", "right", "back", "left"];

// Singleton
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

	async init(width = 128, height = 128): Promise<void> {
		this.frameWidth = width;
		this.frameHeight = height;

		if (this.initialized && this.renderer) {
			// Resize if dimensions changed
			this.renderer.setSize(width, height);
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
			return;
		}
		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			try {
				// @ts-ignore — three is an optional dependency, dynamically loaded
				const THREE = await import("three");
				// @ts-ignore
				const { GLTFLoader } = await import(
					"three/examples/jsm/loaders/GLTFLoader.js"
				);
				// @ts-ignore — SkeletonUtils needed for proper skinned mesh cloning
				const { SkeletonUtils } = await import(
					"three/examples/jsm/utils/SkeletonUtils.js"
				);

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
				this.renderer.setClearColor(0x000000, 0); // transparent

				// Scene with lighting
				this.scene = new THREE.Scene();
				const ambient = new THREE.AmbientLight(0xffffff, 0.7);
				this.scene.add(ambient);
				const dir = new THREE.DirectionalLight(0xffffff, 0.9);
				dir.position.set(2, 3, 2);
				this.scene.add(dir);
				// Fill light from opposite side
				const fill = new THREE.DirectionalLight(0xffffff, 0.3);
				fill.position.set(-2, 1, -1);
				this.scene.add(fill);

				// Camera
				this.camera = new THREE.PerspectiveCamera(
					45,
					width / height,
					0.1,
					100,
				);
				this.camera.position.set(0, 0.4, 2.5);
				this.camera.lookAt(0, 0, 0);

				this.initialized = true;
			} catch (err) {
				console.warn("[SpritesheetCapture] Three.js not available:", err);
				this.initPromise = null;
			}
		})();

		return this.initPromise;
	}

	/** Load a 3D model from URL. Returns model, animation clips, and mixer. */
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

					// Use SkeletonUtils.clone for animated models (preserves skeleton bindings)
					const model = animations.length > 0 && this.SkeletonUtils
						? this.SkeletonUtils.clone(gltf.scene)
						: gltf.scene.clone();

					// Auto-fit model to camera view
					this.autoFit(model);

					// Create animation mixer if model has animations
					let mixer: any = null;
					if (animations.length > 0) {
						mixer = new THREE.AnimationMixer(model);
					}

					// Cache the original GLTF for re-cloning
					if (!this.modelCache.has(url)) {
						this.modelCache.set(url, gltf);
					}

					resolve({ model, animations, mixer });
				},
				undefined,
				(err: any) => reject(err),
			);
		});
	}

	/** Auto-fit model to fill the camera frame with padding */
	private autoFit(model: any): void {
		const THREE = this.THREE;
		const box = new THREE.Box3().setFromObject(model);
		const size = box.getSize(new THREE.Vector3());
		const maxDim = Math.max(size.x, size.y, size.z);
		if (maxDim === 0) return;

		// Scale first — 1.8 units fills ~85% of the camera viewport at z=2.5
		const targetSize = 1.8;
		const scale = targetSize / maxDim;
		model.scale.multiplyScalar(scale);

		// Recompute bounds AFTER scaling, then center at origin
		model.updateMatrixWorld(true);
		const newBox = new THREE.Box3().setFromObject(model);
		const newCenter = newBox.getCenter(new THREE.Vector3());
		model.position.sub(newCenter);
	}

	/** Capture a single frame as a PNG blob */
	private async captureFrame(): Promise<Blob> {
		this.renderer.render(this.scene, this.camera);
		return new Promise<Blob>((resolve, reject) => {
			this.renderer.domElement.toBlob(
				(blob: Blob | null) => {
					if (blob) resolve(blob);
					else reject(new Error("toBlob returned null"));
				},
				"image/png",
				1,
			);
		});
	}

	/** Render a single preview frame (adds model to scene, renders, returns canvas) */
	renderPreview(loaded: LoadedModel): HTMLCanvasElement | null {
		if (!this.initialized || !this.renderer) return null;
		this.setModel(loaded.model);
		this.renderer.render(this.scene, this.camera);
		return this.renderer.domElement;
	}

	/** Add model to scene, removing any previous model (keeps lights) */
	private setModel(model: any): void {
		// Remove non-light children (lights are first 3 children)
		while (this.scene.children.length > 3) {
			this.scene.remove(this.scene.children[this.scene.children.length - 1]);
		}
		this.scene.add(model);
	}

	/**
	 * Capture a rotation sequence — turntable rotation around an axis.
	 * Returns array of CapturedFrame (PNG blobs).
	 */
	async captureRotation(
		loaded: LoadedModel,
		config: Partial<RotationCaptureConfig> = {},
		onProgress?: (pct: number) => void,
	): Promise<CapturedFrame[]> {
		const frames = config.frames || 30;
		const axis = config.axis || "y";
		const prefix = config.prefix || "rotate";

		this.setModel(loaded.model);
		const originalRotation = loaded.model.rotation.clone();
		const result: CapturedFrame[] = [];

		for (let i = 0; i < frames; i++) {
			// Set rotation for this frame
			const angle = (Math.PI * 2 * i) / frames;
			loaded.model.rotation.copy(originalRotation);
			if (axis === "x") loaded.model.rotation.x += angle;
			else if (axis === "y") loaded.model.rotation.y += angle;
			else loaded.model.rotation.z += angle;

			const blob = await this.captureFrame();
			const name = `${prefix}_${String(i).padStart(4, "0")}`;
			result.push({
				name,
				blob,
				width: this.frameWidth,
				height: this.frameHeight,
			});

			if (onProgress) onProgress((i + 1) / frames);
		}

		// Restore rotation
		loaded.model.rotation.copy(originalRotation);
		this.scene.remove(loaded.model);

		return result;
	}

	/**
	 * Capture animation frames from a skeletal animation clip.
	 * Creates a fresh mixer per capture to avoid state corruption.
	 * Samples evenly across the clip duration.
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
			throw new Error(
				`Animation clip not found: ${config.clipName || "(first)"}`,
			);
		}

		const prefix = config.prefix || clip.name || "anim";

		this.setModel(loaded.model);

		// Create a FRESH mixer for this capture to avoid stale state
		// Stop any existing mixer actions first
		if (loaded.mixer) {
			loaded.mixer.stopAllAction();
			loaded.mixer.setTime(0);
		}
		const mixer = new THREE.AnimationMixer(loaded.model);
		const action = mixer.clipAction(clip);
		action.play();

		const result: CapturedFrame[] = [];

		for (let i = 0; i < frames; i++) {
			// Set absolute time — setTime resets all actions to 0 then advances
			const t = (clip.duration * i) / frames;
			mixer.setTime(t);
			// Force full transform hierarchy update (critical for skinned meshes)
			loaded.model.updateMatrixWorld(true);

			const blob = await this.captureFrame();
			const name = `${prefix}_${String(i).padStart(4, "0")}`;
			result.push({
				name,
				blob,
				width: this.frameWidth,
				height: this.frameHeight,
			});

			if (onProgress) onProgress((i + 1) / frames);
		}

		// Cleanup: stop action, reset mixer, remove model from scene
		action.stop();
		mixer.stopAllAction();
		mixer.setTime(0);
		mixer.update(0);
		this.scene.remove(loaded.model);

		return result;
	}

	/**
	 * Capture from multiple camera angles (4 or 8 directions).
	 * For each angle: captures all selected animations (or rotation if no animations).
	 * Returns a Map of angleName → CapturedFrame[].
	 */
	async captureMultiAngle(
		loaded: LoadedModel,
		config: Partial<MultiAngleCaptureConfig> = {},
		onProgress?: (pct: number) => void,
	): Promise<Map<string, CapturedFrame[]>> {
		const numAngles = config.angles || 8;
		const animFrames = config.animFrames || 8;
		const angleNames = numAngles === 4 ? ANGLE_NAMES_4 : ANGLE_NAMES_8;
		const angleStep = (Math.PI * 2) / numAngles;

		// Determine which clips to capture
		const hasAnims = loaded.mixer && loaded.animations.length > 0;
		const clipNames = config.clips
			? config.clips
			: hasAnims
				? loaded.animations.map((c: any) => c.name || "anim")
				: [];

		const totalSteps =
			numAngles * (clipNames.length > 0 ? clipNames.length * animFrames : animFrames);
		let step = 0;

		const result = new Map<string, CapturedFrame[]>();

		// Save original camera position
		const origCamPos = this.camera.position.clone();
		const camRadius = origCamPos.length();
		const camY = origCamPos.y;

		for (let a = 0; a < numAngles; a++) {
			const angleName = angleNames[a];
			const angle = angleStep * a;

			// Position camera around the model
			this.camera.position.set(
				Math.sin(angle) * camRadius,
				camY,
				Math.cos(angle) * camRadius,
			);
			this.camera.lookAt(0, 0, 0);

			if (clipNames.length > 0) {
				// Capture each animation at this angle
				for (const clipName of clipNames) {
					const frames = await this.captureAnimation(loaded, {
						frames: animFrames,
						clipName,
						prefix: `${clipName}_${angleName}`,
					});
					const key = `${clipName}_${angleName}`;
					result.set(key, frames);
					step += animFrames;
					if (onProgress) onProgress(step / totalSteps);
				}
			} else {
				// No animations — capture rotation at this angle
				const frames = await this.captureRotation(loaded, {
					frames: animFrames,
					prefix: `rotate_${angleName}`,
				});
				result.set(angleName, frames);
				step += animFrames;
				if (onProgress) onProgress(step / totalSteps);
			}
		}

		// Restore camera
		this.camera.position.copy(origCamPos);
		this.camera.lookAt(0, 0, 0);

		return result;
	}

	/** Get the list of animation clip names from a loaded model */
	getAnimationNames(loaded: LoadedModel): string[] {
		return loaded.animations.map(
			(c: any, i: number) => c.name || `animation_${i}`,
		);
	}

	/** Get the Three.js module (for external use like OrbitControls in preview) */
	getThree(): any {
		return this.THREE;
	}

	/** Get the renderer's canvas element (for preview display) */
	getCanvas(): HTMLCanvasElement | null {
		return this.renderer?.domElement || null;
	}

	/** Set the capture camera position (called before generate to match user's preview angle) */
	setCameraPosition(x: number, y: number, z: number): void {
		if (this.camera) this.camera.position.set(x, y, z);
	}

	/** Set the capture camera look-at target */
	setCameraTarget(x: number, y: number, z: number): void {
		if (this.camera) this.camera.lookAt(x, y, z);
	}

	/** Get the camera object (for reading position) */
	getCamera(): any {
		return this.camera;
	}

	/** Dynamically import OrbitControls for interactive preview */
	async getOrbitControlsClass(): Promise<any> {
		await this.init(this.frameWidth, this.frameHeight);
		// @ts-ignore
		const { OrbitControls } = await import(
			"three/examples/jsm/controls/OrbitControls.js"
		);
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

/** Get or create the singleton capture instance */
export function getCaptureInstance(): SpritesheetCapture {
	if (!_instance) {
		_instance = new SpritesheetCapture();
	}
	return _instance;
}
