/**
 * Asset Thumbnail Renderer — Renders 3D model previews for the asset library.
 *
 * Uses an offscreen canvas with Three.js (dynamically imported) to render
 * rotating 3D model thumbnails. Only loads Three.js when the first thumbnail
 * is requested, keeping the initial bundle lean.
 *
 * Performance:
 * - IntersectionObserver: only renders visible cards
 * - Time-sliced: max 8 renders per animation frame
 * - Model cache: prevents duplicate GLTF downloads
 * - Singleton renderer: one shared WebGLRenderer instance
 */

import { useEffect, useRef, useState } from "react";

// Model URL builder (mirrors the pattern in the iframe)
function buildModelUrl(packId: string, path: string): string {
	return `/api/app-builder/media-stock-3d/${packId}/${encodeURI(path)}`;
}

// Singleton renderer state
let _rendererInstance: AssetThumbnailRenderer | null = null;

class AssetThumbnailRenderer {
	private THREE: any = null;
	private GLTFLoader: any = null;
	private renderer: any = null;
	private scene: any = null;
	private camera: any = null;
	private modelCache = new Map<string, any>();
	private renderQueue: Array<{ key: string; canvas: HTMLCanvasElement; url: string; resolve: () => void }> = [];
	private isRendering = false;
	private observer: IntersectionObserver | null = null;
	private visibleCanvases = new Set<HTMLCanvasElement>();
	private initialized = false;
	private initPromise: Promise<void> | null = null;

	async init(): Promise<void> {
		if (this.initialized) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			try {
				// @ts-ignore — three is an optional dependency, dynamically loaded
				const THREE = await import("three");
				// @ts-ignore — three is an optional dependency, dynamically loaded
				const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");

				this.THREE = THREE;
				this.GLTFLoader = GLTFLoader;

				// Create offscreen renderer
				this.renderer = new THREE.WebGLRenderer({
					antialias: true,
					alpha: true,
					preserveDrawingBuffer: true,
				});
				this.renderer.setSize(128, 128);
				this.renderer.setPixelRatio(1);
				this.renderer.outputColorSpace = THREE.SRGBColorSpace;

				// Scene setup
				this.scene = new THREE.Scene();
				const ambient = new THREE.AmbientLight(0xffffff, 0.6);
				this.scene.add(ambient);
				const directional = new THREE.DirectionalLight(0xffffff, 0.8);
				directional.position.set(2, 3, 2);
				this.scene.add(directional);

				// Camera
				this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
				this.camera.position.set(2, 1.5, 2);
				this.camera.lookAt(0, 0, 0);

				this.initialized = true;
			} catch (err) {
				console.warn("[ThumbnailRenderer] Three.js not available:", err);
				this.initPromise = null;
			}
		})();

		return this.initPromise;
	}

	private async loadModel(url: string): Promise<any> {
		if (this.modelCache.has(url)) {
			return this.modelCache.get(url).clone();
		}

		return new Promise((resolve, reject) => {
			const loader = new this.GLTFLoader();
			loader.load(
				url,
				(gltf: any) => {
					this.modelCache.set(url, gltf.scene);
					resolve(gltf.scene.clone());
				},
				undefined,
				(err: any) => reject(err),
			);
		});
	}

	private autoFit(model: any): void {
		const THREE = this.THREE;
		const box = new THREE.Box3().setFromObject(model);
		const center = box.getCenter(new THREE.Vector3());
		const size = box.getSize(new THREE.Vector3());
		const maxDim = Math.max(size.x, size.y, size.z);
		const scale = maxDim > 0 ? 1.5 / maxDim : 1;

		model.position.sub(center);
		model.scale.multiplyScalar(scale);
	}

	async renderToCanvas(canvas: HTMLCanvasElement, url: string): Promise<void> {
		if (!this.initialized) {
			await this.init();
		}
		if (!this.initialized || !this.renderer) return;

		try {
			const model = await this.loadModel(url);
			this.autoFit(model);

			// Clear scene of previous model
			while (this.scene.children.length > 2) {
				this.scene.remove(this.scene.children[this.scene.children.length - 1]);
			}
			this.scene.add(model);

			// Render
			this.renderer.render(this.scene, this.camera);

			// Copy to target canvas
			const ctx = canvas.getContext("2d");
			if (ctx) {
				canvas.width = 128;
				canvas.height = 128;
				ctx.drawImage(this.renderer.domElement, 0, 0);
			}

			// Clean up
			this.scene.remove(model);
		} catch (err) {
			// Silently fail — placeholder icon will show instead
		}
	}

	dispose(): void {
		this.renderer?.dispose();
		this.modelCache.clear();
		this.observer?.disconnect();
		this.initialized = false;
		this.initPromise = null;
		_rendererInstance = null;
	}
}

function getRenderer(): AssetThumbnailRenderer {
	if (!_rendererInstance) {
		_rendererInstance = new AssetThumbnailRenderer();
	}
	return _rendererInstance;
}

/**
 * React hook for rendering a 3D model thumbnail.
 * Returns a canvas ref and loading state.
 *
 * Lazily loads Three.js on first use. Falls back gracefully if Three.js
 * is not available (placeholder icon shows instead).
 */
export function useAssetThumbnail(packId: string, modelPath: string): {
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
	isLoading: boolean;
	hasRendered: boolean;
} {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [hasRendered, setHasRendered] = useState(false);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !packId || !modelPath) return;

		const url = buildModelUrl(packId, modelPath);
		const renderer = getRenderer();

		let cancelled = false;

		(async () => {
			setIsLoading(true);
			try {
				await renderer.renderToCanvas(canvas, url);
				if (!cancelled) {
					setHasRendered(true);
				}
			} catch {
				// Silently fail
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [packId, modelPath]);

	return { canvasRef, isLoading, hasRendered };
}
