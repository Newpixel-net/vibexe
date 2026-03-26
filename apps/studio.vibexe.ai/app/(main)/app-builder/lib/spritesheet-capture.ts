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
	// Shared frustum — when set, ALL animations use the same camera framing for consistent size
	private _sharedFrustum: { left: number; right: number; top: number; bottom: number } | null = null;

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

					// Use gltf.scene directly — SkeletonUtils.clone breaks skeleton↔bone
					// binding (SkinnedMesh.skeleton.bones ≠ scene graph bones), making
					// animations invisible. Capture code uses reloadModelFresh() for its
					// own copies, so using the original scene here is safe.
					const model = gltf.scene;

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
	/** Fit camera to model — used by rotation capture and preview only.
	 *  Animation capture uses its own two-pass fitting in captureAnimation(). */
	private fitCameraToModel(model: any, padding = 1.15): void {
		const THREE = this.THREE;
		model.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(model);
		const size = box.getSize(new THREE.Vector3());
		const center = box.getCenter(new THREE.Vector3());
		const heightAxis = this._heightAxis;
		const modelHeight = heightAxis === "z" ? size.z : size.y;
		const halfExtent = Math.max((modelHeight * padding) / 2, 0.5);

		this.camera.left = -halfExtent;
		this.camera.right = halfExtent;
		this.camera.top = halfExtent;
		this.camera.bottom = -halfExtent;
		this.camera.updateProjectionMatrix();

		const distance = 5;
		const upVec = new THREE.Vector3(0, heightAxis === "z" ? 0 : 1, heightAxis === "z" ? 1 : 0);
		let camPos: any;
		if (this._cameraDirection) {
			const dir = this._cameraDirection;
			camPos = new THREE.Vector3(center.x + dir.x * distance, center.y + dir.y * distance, center.z + dir.z * distance);
		} else if (heightAxis === "z") {
			camPos = new THREE.Vector3(center.x, center.y - distance, center.z);
		} else {
			camPos = new THREE.Vector3(center.x, center.y, center.z - distance);
		}
		this.camera.position.copy(camPos);
		this.camera.up.copy(upVec);
		this.camera.lookAt(center.x, center.y, center.z);
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

		// RELOAD the model from scratch for bind-pose measurement
		const captureLoaded = await this.reloadModelFresh(loaded);
		const captureModel = captureLoaded.model;

		const freshClip = captureLoaded.animations.find((c: any) => c.name === clipName)
			|| captureLoaded.animations[0];

		const clipDuration = freshClip.duration;
		const step = 1 / 60;

		// Helper: reset skeleton to bind pose, then advance to target time
		const advanceToTime = (model: any, animClip: any, targetTime: number) => {
			// Reset all skinned meshes to bind pose before each advance
			model.traverse((child: any) => {
				if (child.isSkinnedMesh && child.skeleton) {
					child.skeleton.pose();
				}
			});
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
		// PASS 1: Set up camera frustum.
		// If a shared frustum was precomputed (via precomputeSharedFrustum),
		// use it directly — this ensures consistent character size across all
		// animations. Otherwise, do a per-animation pixel scan.
		// =====================================================================
		const heightAxis = this._heightAxis;
		const distance = 5;
		const upVec = new THREE.Vector3(0, heightAxis === "z" ? 0 : 1, heightAxis === "z" ? 1 : 0);

		// Position camera
		let camPos: any;
		if (this._cameraDirection) {
			const dir = this._cameraDirection;
			camPos = new THREE.Vector3(dir.x * distance, dir.y * distance, dir.z * distance);
		} else if (heightAxis === "z") {
			camPos = new THREE.Vector3(0, -distance, 0);
		} else {
			camPos = new THREE.Vector3(0, 0, -distance);
		}
		this.camera.position.copy(camPos);
		this.camera.up.copy(upVec);
		this.camera.lookAt(0, 0, 0);

		if (this._sharedFrustum) {
			// Use precomputed shared frustum — consistent size across all animations
			this.camera.left = this._sharedFrustum.left;
			this.camera.right = this._sharedFrustum.right;
			this.camera.bottom = this._sharedFrustum.bottom;
			this.camera.top = this._sharedFrustum.top;
			this.camera.updateProjectionMatrix();
			if (onProgress) onProgress(0.4);
		} else {
			// Per-animation pixel scan (fallback when no shared frustum)
			captureModel.updateMatrixWorld(true);
			const bindBox = new THREE.Box3().setFromObject(captureModel);
			const bindSize = bindBox.getSize(new THREE.Vector3());
			const bindMax = Math.max(bindSize.x, bindSize.y, bindSize.z);
			const scanSize = Math.max(bindMax * 5, 10);

			this.camera.left = -scanSize;
			this.camera.right = scanSize;
			this.camera.top = scanSize;
			this.camera.bottom = -scanSize;
			this.camera.updateProjectionMatrix();

			const w = this.frameWidth, h = this.frameHeight;
			let minPxX = w, maxPxX = 0, minPxY = h, maxPxY = 0;
			const gl = this.renderer.getContext();
			const pixels = new Uint8Array(w * h * 4);

			for (let i = 0; i < frames; i++) {
				const targetTime = (clipDuration * i) / frames;
				const scanLoaded = await this.reloadModelFresh(loaded);
				const scanClip = scanLoaded.animations.find((c: any) => c.name === clipName)
					|| scanLoaded.animations[0];
				this.setModel(scanLoaded.model);
				const { mixer, action } = advanceToTime(scanLoaded.model, scanClip, targetTime);

				await new Promise<void>(r => requestAnimationFrame(() => r()));
				this.renderer.render(this.scene, this.camera);
				gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

				for (let py = 0; py < h; py++) {
					for (let px = 0; px < w; px++) {
						if (pixels[(py * w + px) * 4 + 3] > 0) {
							if (px < minPxX) minPxX = px;
							if (px > maxPxX) maxPxX = px;
							if (py < minPxY) minPxY = py;
							if (py > maxPxY) maxPxY = py;
						}
					}
				}

				action.stop(); mixer.stopAllAction();
				this.scene.remove(scanLoaded.model);
				if (onProgress) onProgress(((i + 1) / frames) * 0.4);
			}

			if (maxPxX >= minPxX && maxPxY >= minPxY) {
				const pxToWorld = (scanSize * 2) / w;
				const contentLeft = -scanSize + minPxX * pxToWorld;
				const contentRight = -scanSize + (maxPxX + 1) * pxToWorld;
				const contentBottom = -scanSize + minPxY * pxToWorld;
				const contentTop = -scanSize + (maxPxY + 1) * pxToWorld;

				const cX = (contentLeft + contentRight) / 2;
				const cY = (contentBottom + contentTop) / 2;
				const eX = (contentRight - contentLeft) / 2;
				const eY = (contentTop - contentBottom) / 2;
				const pad = 1.03;
				const halfW = Math.max(eX, 0.1) * pad;
				const halfH = Math.max(eY, 0.1) * pad;

				this.camera.left = cX - halfW;
				this.camera.right = cX + halfW;
				this.camera.bottom = cY - halfH;
				this.camera.top = cY + halfH;
				this.camera.updateProjectionMatrix();
			}
		}

		// =====================================================================
		// PASS 2: Render each frame — reload model fresh per frame to prevent
		// root motion accumulation (same approach as scan pass).
		// =====================================================================
		const result: CapturedFrame[] = [];

		for (let i = 0; i < frames; i++) {
			const targetTime = (clipDuration * i) / frames;
			// Fresh model per frame prevents root motion accumulation
			const renderLoaded = await this.reloadModelFresh(loaded);
			const renderClip = renderLoaded.animations.find((c: any) => c.name === clipName)
				|| renderLoaded.animations[0];
			this.setModel(renderLoaded.model);
			const { mixer, action } = advanceToTime(renderLoaded.model, renderClip, targetTime);

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
			this.scene.remove(renderLoaded.model);
			if (onProgress) onProgress(0.4 + ((i + 1) / frames) * 0.6); // render = last 60%
		}

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

	/** Detect which direction the model faces by rendering from 4 cardinal
	 *  directions and comparing silhouette widths.
	 *  Returns the camera direction vector for the "front" view (from model to camera). */
	async detectModelFront(loaded: LoadedModel): Promise<{ x: number; y: number; z: number }> {
		// Use higher resolution (256px) so facial features (eyes, nose, mouth) are
		// actually resolvable. At 128px the face is a uniform blob and back armor wins.
		const detectSize = 256;
		const savedW = this.frameWidth;
		const savedH = this.frameHeight;
		await this.init(detectSize, detectSize);
		const THREE = this.THREE;
		const heightAxis = this._heightAxis;

		// 4 candidate camera directions perpendicular to height axis
		const dirs = heightAxis === "z"
			? [[0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0]]
			: [[0, 0, -1], [0, 0, 1], [1, 0, 0], [-1, 0, 0]];

		const model = loaded.model;
		model.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(model);
		const center = box.getCenter(new THREE.Vector3());
		const size = box.getSize(new THREE.Vector3());
		const half = Math.max(size.x, size.y, size.z) * 1.5;

		this.camera.left = -half;
		this.camera.right = half;
		this.camera.top = half;
		this.camera.bottom = -half;
		this.camera.updateProjectionMatrix();

		const up = new THREE.Vector3(0, heightAxis === "z" ? 0 : 1, heightAxis === "z" ? 1 : 0);
		this.setModel(model);

		// Add a temporary detection light that follows the camera so every view
		// is equally lit. Without this, the fixed key light at (1,2,-3) makes the
		// -Z face brighter, biasing unique color counts toward the back.
		const detectionLight = new THREE.DirectionalLight(0xffffff, 1.0);
		this.scene.add(detectionLight);

		const w = this.frameWidth, h = this.frameHeight;
		const gl = this.renderer.getContext();
		const px = new Uint8Array(w * h * 4);
		const measured: { dir: number[]; width: number; uniqueColors: number }[] = [];

		for (const dir of dirs) {
			this.camera.position.set(center.x + dir[0] * 5, center.y + dir[1] * 5, center.z + dir[2] * 5);
			this.camera.up.copy(up);
			this.camera.lookAt(center.x, center.y, center.z);
			// Move detection light to match camera — ensures equal lighting from every angle
			detectionLight.position.set(dir[0] * 5, dir[1] * 5 + 2, dir[2] * 5);
			this.renderer.render(this.scene, this.camera);
			gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

			// Pass 1: find actual content bounds (model may be small in the frame)
			let minX = w, maxX = 0, minY = h, maxY = 0;
			for (let py = 0; py < h; py++) {
				for (let p = 0; p < w; p++) {
					const idx = (py * w + p) * 4;
					if (px[idx + 3] > 10) {
						if (p < minX) minX = p;
						if (p > maxX) maxX = p;
						if (py < minY) minY = py;
						if (py > maxY) maxY = py;
					}
				}
			}

			// Pass 2: count unique colors in top 15% of CONTENT (the actual head region)
			const contentHeight = maxY - minY;
			const headStart = Math.floor(maxY - contentHeight * 0.15); // top 15% of content
			const colorSet = new Set<number>();
			for (let py = headStart; py <= maxY; py++) {
				for (let p = minX; p <= maxX; p++) {
					const idx = (py * w + p) * 4;
					if (px[idx + 3] > 10) {
						// Quantize to 5-bit per channel to reduce noise
						const r = px[idx] >> 3;
						const g = px[idx + 1] >> 3;
						const b = px[idx + 2] >> 3;
						colorSet.add((r << 10) | (g << 5) | b);
					}
				}
			}
			measured.push({
				dir,
				width: maxX > minX ? maxX - minX + 1 : 0,
				uniqueColors: colorSet.size,
			});
		}

		this.scene.remove(model);
		this.scene.remove(detectionLight);

		// Restore original frame size for subsequent captures
		await this.init(savedW, savedH);

		// Widest silhouette pair = front/back (shoulder width > body depth)
		measured.sort((a, b) => b.width - a.width);
		const top2 = measured.slice(0, 2);

		// Debug: log measurements so we can see what's happening
		console.log("[detectModelFront]", top2.map(m =>
			`dir=[${m.dir}] width=${m.width} colors=${m.uniqueColors}`).join(" | "));

		// Among the front/back pair, more unique colors in the head = front (face detail).
		// But if scores are within 20%, it's ambiguous — use tiebreaker direction.
		// Tiebreaker: +Z for Y-up, +Y for Z-up (camera sees model's front for most models).
		const colorDiff = Math.abs(top2[0].uniqueColors - top2[1].uniqueColors);
		const maxColors = Math.max(top2[0].uniqueColors, top2[1].uniqueColors);

		let front;
		if (maxColors === 0 || colorDiff / maxColors < 0.2) {
			// Ambiguous — use tiebreaker
			const tieDir = heightAxis === "z" ? [0, 1, 0] : [0, 0, 1];
			const match = (d: number[]) => d[0] === tieDir[0] && d[1] === tieDir[1] && d[2] === tieDir[2];
			front = top2.find(m => match(m.dir)) || top2[0];
		} else {
			front = top2[0].uniqueColors >= top2[1].uniqueColors ? top2[0] : top2[1];
		}
		console.log("[detectModelFront] picked dir=[" + front.dir + "] colors=" + front.uniqueColors);
		return { x: front.dir[0], y: front.dir[1], z: front.dir[2] };
	}

	/** Pre-scan ALL animations to compute a single shared frustum.
	 *  This ensures consistent character size across all generated spritesheets. */
	async precomputeSharedFrustum(
		loaded: LoadedModel,
		clipNames: string[],
		framesPerClip: number,
		onProgress?: (pct: number) => void,
	): Promise<void> {
		this._sharedFrustum = null; // Reset
		await this.init(this.frameWidth, this.frameHeight);
		const THREE = this.THREE;
		const heightAxis = this._heightAxis;

		// Set up generous scan frustum
		const captureModel = (await this.reloadModelFresh(loaded)).model;
		captureModel.updateMatrixWorld(true);
		const bindBox = new THREE.Box3().setFromObject(captureModel);
		const bindSize = bindBox.getSize(new THREE.Vector3());
		const bindMax = Math.max(bindSize.x, bindSize.y, bindSize.z);
		const scanSize = Math.max(bindMax * 5, 10);

		this.camera.left = -scanSize;
		this.camera.right = scanSize;
		this.camera.top = scanSize;
		this.camera.bottom = -scanSize;
		this.camera.updateProjectionMatrix();

		const distance = 5;
		const upVec = new THREE.Vector3(0, heightAxis === "z" ? 0 : 1, heightAxis === "z" ? 1 : 0);
		let camPos: any;
		if (this._cameraDirection) {
			const dir = this._cameraDirection;
			camPos = new THREE.Vector3(dir.x * distance, dir.y * distance, dir.z * distance);
		} else if (heightAxis === "z") {
			camPos = new THREE.Vector3(0, -distance, 0);
		} else {
			camPos = new THREE.Vector3(0, 0, -distance);
		}
		this.camera.position.copy(camPos);
		this.camera.up.copy(upVec);
		this.camera.lookAt(0, 0, 0);

		const w = this.frameWidth, h = this.frameHeight;
		let minPxX = w, maxPxX = 0, minPxY = h, maxPxY = 0;
		const gl = this.renderer.getContext();
		const pixels = new Uint8Array(w * h * 4);
		const step = 1 / 60;
		const totalFrames = clipNames.length * framesPerClip;
		let frameIdx = 0;

		for (const clipName of clipNames) {
			const freshLoaded = await this.reloadModelFresh(loaded);
			const clip = freshLoaded.animations.find((c: any) => c.name === clipName) || freshLoaded.animations[0];
			if (!clip) continue;
			console.log(`[sharedFrustum] scanning clip="${clipName}" matched="${clip.name}" dur=${clip.duration.toFixed(2)} avail=[${freshLoaded.animations.map((a: any) => a.name).join(',')}]`);
			const clipDuration = clip.duration;

			for (let i = 0; i < framesPerClip; i++) {
				const targetTime = (clipDuration * i) / framesPerClip;
				const scanLoaded = await this.reloadModelFresh(loaded);
				const scanClip = scanLoaded.animations.find((c: any) => c.name === clipName) || scanLoaded.animations[0];
				this.setModel(scanLoaded.model);

				// Advance animation
				scanLoaded.model.traverse((child: any) => {
					if (child.isSkinnedMesh && child.skeleton) child.skeleton.pose();
				});
				const m = new THREE.AnimationMixer(scanLoaded.model);
				const a = m.clipAction(scanClip);
				a.play();
				let t = 0;
				while (t < targetTime) { const dt = Math.min(step, targetTime - t); m.update(dt); t += dt; }
				if (targetTime === 0) m.update(0.001);
				scanLoaded.model.updateMatrixWorld(true);

				await new Promise<void>(r => requestAnimationFrame(() => r()));
				this.renderer.render(this.scene, this.camera);
				gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

				for (let py = 0; py < h; py++) {
					for (let px = 0; px < w; px++) {
						if (pixels[(py * w + px) * 4 + 3] > 0) {
							if (px < minPxX) minPxX = px;
							if (px > maxPxX) maxPxX = px;
							if (py < minPxY) minPxY = py;
							if (py > maxPxY) maxPxY = py;
						}
					}
				}

				a.stop(); m.stopAllAction();
				this.scene.remove(scanLoaded.model);
				frameIdx++;
				if (onProgress) onProgress(frameIdx / totalFrames);
			}
		}

		// Convert pixel bounds to frustum
		if (maxPxX >= minPxX && maxPxY >= minPxY) {
			const pxToWorld = (scanSize * 2) / w;
			const contentLeft = -scanSize + minPxX * pxToWorld;
			const contentRight = -scanSize + (maxPxX + 1) * pxToWorld;
			const contentBottom = -scanSize + minPxY * pxToWorld;
			const contentTop = -scanSize + (maxPxY + 1) * pxToWorld;

			const cX = (contentLeft + contentRight) / 2;
			const cY = (contentBottom + contentTop) / 2;
			const eX = (contentRight - contentLeft) / 2;
			const eY = (contentTop - contentBottom) / 2;
			// Tight padding (3%) and preserve aspect ratio — no forced square
			const pad = 1.03;
			const halfW = Math.max(eX, 0.1) * pad;
			const halfH = Math.max(eY, 0.1) * pad;

			console.log(`[sharedFrustum] scanSize=${scanSize.toFixed(2)} pxBounds=[${minPxX},${minPxY}]-[${maxPxX},${maxPxY}] of ${w}x${h} contentWorld=[${contentLeft.toFixed(2)},${contentBottom.toFixed(2)}]-[${contentRight.toFixed(2)},${contentTop.toFixed(2)}] halfW=${halfW.toFixed(3)} halfH=${halfH.toFixed(3)}`);

			this._sharedFrustum = {
				left: cX - halfW,
				right: cX + halfW,
				bottom: cY - halfH,
				top: cY + halfH,
			};
		} else {
			console.warn(`[sharedFrustum] NO content found! pixel bounds were minPx=[${minPxX},${minPxY}] maxPx=[${maxPxX},${maxPxY}]`);
		}
	}

	/** Clear the shared frustum so each animation computes its own. */
	clearSharedFrustum(): void {
		this._sharedFrustum = null;
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
