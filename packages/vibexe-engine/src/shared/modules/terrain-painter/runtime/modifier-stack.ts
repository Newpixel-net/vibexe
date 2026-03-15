/**
 * ModifierStack — GPU pipeline for terrain texture painting
 * Converted from Unity ModifierStack.cs
 *
 * This is the core rendering engine. For each terrain layer:
 * 1. Start with a white (full coverage) render target
 * 2. Apply each modifier in the stack (height, slope, etc.)
 * 3. Each modifier renders to the target using configured blend modes
 * 4. The final target contains the alpha mask for that layer
 * 5. Write the mask into the appropriate splatmap channel
 *
 * Uses Three.js WebGLRenderTarget for GPU-accelerated processing.
 */

import type { Modifier, ModifierUniforms } from "./modifier";
import type { LayerSettings } from "./layer-settings";
import {
	COMMON_VERTEX,
	HEIGHT_FRAGMENT,
	SLOPE_FRAGMENT,
	CURVATURE_FRAGMENT,
	TEXTURE_MASK_FRAGMENT,
	NOISE_FRAGMENT,
	DIRECTION_FRAGMENT,
	SPLATMAP_COMPOSITE_VERTEX,
	SPLATMAP_COMPOSITE_FRAGMENT,
} from "../shaders/modifier-passes.glsl";

/**
 * THREE.js types used — these come from window.THREE in the sandpack iframe.
 * We use `any` here since this code runs in the sandpack sandbox where
 * THREE is a window global, not a proper import.
 */

export interface TerrainData {
	/** Heightmap as a THREE.DataTexture (R channel, float) */
	heightmapTexture: unknown;
	/** Normal map as a THREE.DataTexture */
	normalMapTexture: unknown;
	/** Terrain world size */
	size: { x: number; y: number; z: number };
	/** Terrain world position */
	position: { x: number; y: number; z: number };
	/** Heightmap resolution */
	heightmapResolution: number;
}

export interface TerrainBounds {
	min: { x: number; y: number; z: number };
	max: { x: number; y: number; z: number };
	size: { x: number; y: number; z: number };
}

export class ModifierStack {
	private THREE: any;
	private renderer: any;
	private resolution: number;
	private alphaMap: any = null; // WebGLRenderTarget
	private fullscreenQuad: any = null; // Mesh
	private fullscreenCamera: any = null; // OrthographicCamera
	private passMaterials: any[] = []; // ShaderMaterial[]
	private compositeMaterial: any = null;
	private splatmaps: any[] = []; // WebGLRenderTarget[] (RGBA, 4 layers each)
	private isWebGPU = false;

	constructor(THREE: any, renderer: any, resolution = 256) {
		this.THREE = THREE;
		this.renderer = renderer;
		this.resolution = resolution;

		// Raw GLSL ShaderMaterial is incompatible with three.webgpu.js
		// (even on WebGL2 fallback, the node material pipeline is used).
		// ModifierStack uses GLSL passes — skip until converted to TSL.
		// Primary terrain painting works via bridge vertex attribute weights (CPU path).
		this.isWebGPU = true; // TODO: Convert modifier passes to TSL, then remove this
		if (this.isWebGPU) return;

		this.initPipeline();
	}

	private initPipeline(): void {
		const T = this.THREE;

		// Fullscreen quad for blit operations
		const geo = new T.PlaneGeometry(2, 2);
		this.fullscreenCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

		// Create shader materials for each pass
		const passFragments = [
			HEIGHT_FRAGMENT,
			SLOPE_FRAGMENT,
			CURVATURE_FRAGMENT,
			TEXTURE_MASK_FRAGMENT,
			NOISE_FRAGMENT,
			DIRECTION_FRAGMENT,
		];

		this.passMaterials = passFragments.map(
			(frag) =>
				new T.ShaderMaterial({
					vertexShader: COMMON_VERTEX,
					fragmentShader: frag,
					uniforms: {},
					depthTest: false,
					depthWrite: false,
				}),
		);

		// Composite material for writing layer masks to splatmap channels
		this.compositeMaterial = new T.ShaderMaterial({
			vertexShader: SPLATMAP_COMPOSITE_VERTEX,
			fragmentShader: SPLATMAP_COMPOSITE_FRAGMENT,
			uniforms: {
				u_existingSplatmap: { value: null },
				u_layerMask: { value: null },
				u_channelIndex: { value: 0 },
				u_layerEnabled: { value: 1.0 },
			},
			depthTest: false,
			depthWrite: false,
		});

		this.fullscreenQuad = new T.Mesh(geo, this.passMaterials[0]);

		// Alpha map render target (single channel mask per layer)
		this.alphaMap = new T.WebGLRenderTarget(this.resolution, this.resolution, {
			format: T.RedFormat,
			type: T.UnsignedByteType,
			minFilter: T.LinearFilter,
			magFilter: T.LinearFilter,
		});
	}

	/** Ensure splatmap render targets exist (1 per 4 layers) */
	ensureSplatmaps(layerCount: number): void {
		if (this.isWebGPU) return;
		const T = this.THREE;
		const splatmapCount = Math.ceil(layerCount / 4);

		while (this.splatmaps.length < splatmapCount) {
			this.splatmaps.push(
				new T.WebGLRenderTarget(this.resolution, this.resolution, {
					format: T.RGBAFormat,
					type: T.UnsignedByteType,
					minFilter: T.LinearFilter,
					magFilter: T.LinearFilter,
				}),
			);
		}
	}

	/** Set up common uniforms from terrain data */
	configure(terrain: TerrainData, bounds: TerrainBounds): void {
		if (this.isWebGPU) return;
		const heightScale = bounds.max.y - bounds.min.y;
		const invWidth = 1.0 / bounds.size.x;
		const invHeight = 1.0 / bounds.size.z;

		const terrainPosScale = [
			terrain.position.x * invWidth - bounds.min.x * invWidth,
			terrain.position.z * invHeight - bounds.min.z * invHeight,
			terrain.size.x / bounds.size.x,
			terrain.size.z / bounds.size.z,
		];

		const terrainBounds = [
			bounds.min.x,
			bounds.max.z,
			bounds.size.x,
			bounds.size.z,
		];

		const texelSize = 1.0 / terrain.heightmapResolution;

		// Apply to all pass materials
		for (const mat of this.passMaterials) {
			mat.uniforms.u_heightmap = { value: terrain.heightmapTexture };
			mat.uniforms.u_normalMap = { value: terrain.normalMapTexture };
			mat.uniforms.u_heightmapScale = { value: heightScale };
			mat.uniforms.u_texelSize = { value: texelSize };
			mat.uniforms.u_normalTexelSize = { value: texelSize };
			mat.uniforms.u_terrainPosScale = { value: terrainPosScale };
			mat.uniforms.u_terrainBounds = { value: terrainBounds };
		}
	}

	/** Process all layers and generate splatmaps */
	processLayers(layers: LayerSettings[]): void {
		if (this.isWebGPU) return;
		this.ensureSplatmaps(layers.length);

		// Clear all splatmaps to black
		for (const splatmap of this.splatmaps) {
			this.renderer.setRenderTarget(splatmap);
			this.renderer.clear();
		}

		// Process each layer (reverse order like Unity)
		for (let i = layers.length - 1; i >= 0; i--) {
			this.processSingleLayer(layers[i], i);
		}

		this.renderer.setRenderTarget(null);
	}

	/** Process a single layer's modifier stack and write to splatmap */
	private processSingleLayer(settings: LayerSettings, layerIndex: number): void {
		if (!settings.enabled) return;

		const T = this.THREE;

		// Step 1: Clear alpha map to white (full coverage)
		this.renderer.setRenderTarget(this.alphaMap);
		this.renderer.setClearColor(new T.Color(1, 1, 1), 1);
		this.renderer.clear();

		// Step 2: Apply each modifier in reverse order
		const scene = new T.Scene();
		scene.add(this.fullscreenQuad);

		for (let i = settings.modifierStack.length - 1; i >= 0; i--) {
			const modifier = settings.modifierStack[i];
			if (!modifier.enabled || modifier.opacity === 0) continue;

			// Get the material for this pass type
			const material = this.passMaterials[modifier.passIndex];
			if (!material) continue;

			// Configure modifier-specific uniforms
			const uniforms: ModifierUniforms = {};
			modifier.configure(uniforms);

			// Apply uniforms to material
			for (const [key, val] of Object.entries(uniforms)) {
				material.uniforms[key] = val;
			}

			// Render the pass
			this.fullscreenQuad.material = material;
			material.needsUpdate = true;

			this.renderer.setRenderTarget(this.alphaMap);

			// For blend modes, we use THREE.js blending on the material
			this.applyBlendMode(material, modifier);

			this.renderer.render(scene, this.fullscreenCamera);
		}

		// Step 3: Write alpha map to splatmap channel
		const splatmapIndex = Math.floor(layerIndex / 4);
		const channelIndex = layerIndex % 4;

		if (splatmapIndex >= this.splatmaps.length) {
			console.warn(`[ModifierStack] Layer ${layerIndex} requires splatmap ${splatmapIndex}, but only ${this.splatmaps.length} splatmaps exist`);
			return;
		}

		this.compositeMaterial.uniforms.u_existingSplatmap.value =
			this.splatmaps[splatmapIndex].texture;
		this.compositeMaterial.uniforms.u_layerMask.value =
			this.alphaMap.texture;
		this.compositeMaterial.uniforms.u_channelIndex.value = channelIndex;
		this.compositeMaterial.uniforms.u_layerEnabled.value = settings.enabled
			? 1.0
			: 0.0;

		this.fullscreenQuad.material = this.compositeMaterial;

		// Need a temp target since we can't read and write same RT
		const tempRT = new T.WebGLRenderTarget(
			this.resolution,
			this.resolution,
			{
				format: T.RGBAFormat,
				type: T.UnsignedByteType,
			},
		);

		// Copy existing splatmap to temp
		this.renderer.setRenderTarget(tempRT);
		this.renderer.clear();

		// Update source to read from temp, write to splatmap
		this.compositeMaterial.uniforms.u_existingSplatmap.value =
			this.splatmaps[splatmapIndex].texture;

		this.renderer.setRenderTarget(this.splatmaps[splatmapIndex]);
		this.renderer.render(scene, this.fullscreenCamera);

		tempRT.dispose();

		scene.remove(this.fullscreenQuad);
	}

	/** Apply Three.js blending to match Unity blend modes */
	private applyBlendMode(material: any, modifier: Modifier): void {
		const T = this.THREE;

		// First pass starts with white, subsequent passes blend on top
		material.blending = T.CustomBlending;

		switch (modifier.blendMode) {
			case "Multiply":
				material.blendSrc = T.DstColorFactor;
				material.blendDst = T.ZeroFactor;
				material.blendEquation = T.AddEquation;
				break;
			case "Add":
				material.blendSrc = T.OneFactor;
				material.blendDst = T.OneFactor;
				material.blendEquation = T.AddEquation;
				break;
			case "Subtract":
				material.blendSrc = T.OneFactor;
				material.blendDst = T.OneFactor;
				material.blendEquation = T.ReverseSubtractEquation;
				break;
			case "Min":
				material.blendSrc = T.OneFactor;
				material.blendDst = T.OneFactor;
				material.blendEquation = T.MinEquation;
				break;
			case "Max":
				material.blendSrc = T.OneFactor;
				material.blendDst = T.OneFactor;
				material.blendEquation = T.MaxEquation;
				break;
		}
	}

	/** Get splatmap textures for terrain material */
	getSplatmapTextures(): unknown[] {
		return this.splatmaps.map((rt: any) => rt.texture);
	}

	/** Update resolution — recreates render targets */
	setResolution(resolution: number): void {
		this.resolution = resolution;
		this.alphaMap?.dispose();
		for (const sm of this.splatmaps) sm?.dispose();
		this.splatmaps = [];
		this.initPipeline();
	}

	dispose(): void {
		this.alphaMap?.dispose();
		for (const sm of this.splatmaps) sm?.dispose();
		for (const mat of this.passMaterials) mat?.dispose();
		this.compositeMaterial?.dispose();
		this.fullscreenQuad?.geometry?.dispose();
		this.splatmaps = [];
	}
}
