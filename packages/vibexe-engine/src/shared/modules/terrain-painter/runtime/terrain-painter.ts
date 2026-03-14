/**
 * TerrainPainter — Main controller for procedural terrain painting
 * Converted from Unity TerrainPainter.cs
 *
 * Manages terrain meshes, layer settings, and the GPU modifier pipeline.
 * This is the top-level API that the game code and editor UI interact with.
 *
 * Usage in sandpack iframe:
 *   const THREE = window.THREE;
 *   const painter = new TerrainPainter(THREE, renderer, scene);
 *   painter.generateProceduralTerrain();
 *   painter.addLayer({ name: "Grass", diffuseUrl: "...", ... });
 *   painter.addModifier(0, new HeightModifier());
 *   painter.repaint();
 */

import { ModifierStack } from "./modifier-stack";
import { TerrainMesh, type TerrainConfig } from "./terrain-mesh";
import { LayerSettings, type LayerTexture } from "./layer-settings";
import type { Modifier } from "./modifier";

export interface TerrainPainterConfig {
	terrain: Partial<TerrainConfig>;
	splatmapResolution: number;
}

export const DEFAULT_PAINTER_CONFIG: TerrainPainterConfig = {
	terrain: {},
	splatmapResolution: 256,
};

export class TerrainPainter {
	private THREE: any;
	private renderer: any;
	private scene: any;
	terrain: TerrainMesh;
	private modifierStack: ModifierStack;
	layers: LayerSettings[] = [];
	private layerTextures: any[] = []; // THREE.Texture[]
	private layerNormalTextures: (any | null)[] = []; // THREE.Texture[] (layers 0-3)
	private config: TerrainPainterConfig;

	constructor(
		THREE: any,
		renderer: any,
		scene: any,
		config: Partial<TerrainPainterConfig> = {},
	) {
		this.THREE = THREE;
		this.renderer = renderer;
		this.scene = scene;
		this.config = { ...DEFAULT_PAINTER_CONFIG, ...config };

		this.terrain = new TerrainMesh(THREE, this.config.terrain);
		this.modifierStack = new ModifierStack(
			THREE,
			renderer,
			this.config.splatmapResolution,
		);

		// Add terrain mesh to scene
		scene.add(this.terrain.mesh);
	}

	/** Generate a procedural heightmap terrain */
	generateProceduralTerrain(
		scale = 0.02,
		octaves = 4,
		persistence = 0.5,
	): void {
		this.terrain.generateProceduralHeightmap(scale, octaves, persistence);
	}

	/** Load heightmap from image URL */
	async loadHeightmap(imageUrl: string): Promise<void> {
		await this.terrain.loadHeightmap(imageUrl);
	}

	/** Add a new texture layer */
	addLayer(texture: LayerTexture): number {
		const layer = new LayerSettings(texture);
		this.layers.push(layer);

		const idx = this.layers.length - 1;

		// Load the diffuse texture
		this.loadLayerTexture(idx, texture.diffuseUrl);

		// Load normal map (auto-derive from diffuse URL if not specified)
		if (idx < 4) {
			const normalUrl = texture.normalUrl || this.deriveNormalUrl(texture.diffuseUrl);
			if (normalUrl) {
				this.loadLayerNormalTexture(idx, normalUrl);
			}
		}

		return idx;
	}

	/** Remove a layer by index */
	removeLayer(index: number): void {
		if (index >= 0 && index < this.layers.length) {
			this.layers.splice(index, 1);
			this.layerTextures.splice(index, 1);
			if (index < 4) this.layerNormalTextures.splice(index, 1);
		}
	}

	/** Move a layer up in the stack */
	moveLayerUp(index: number): void {
		if (index > 0) {
			[this.layers[index - 1], this.layers[index]] = [
				this.layers[index],
				this.layers[index - 1],
			];
			[this.layerTextures[index - 1], this.layerTextures[index]] = [
				this.layerTextures[index],
				this.layerTextures[index - 1],
			];
		}
	}

	/** Move a layer down in the stack */
	moveLayerDown(index: number): void {
		if (index < this.layers.length - 1) {
			[this.layers[index + 1], this.layers[index]] = [
				this.layers[index],
				this.layers[index + 1],
			];
			[this.layerTextures[index + 1], this.layerTextures[index]] = [
				this.layerTextures[index],
				this.layerTextures[index + 1],
			];
		}
	}

	/** Add a modifier to a layer's stack */
	addModifier(layerIndex: number, modifier: Modifier): void {
		if (layerIndex >= 0 && layerIndex < this.layers.length) {
			this.layers[layerIndex].modifierStack.push(modifier);
		}
	}

	/** Remove a modifier from a layer's stack */
	removeModifier(layerIndex: number, modifierIndex: number): void {
		if (layerIndex >= 0 && layerIndex < this.layers.length) {
			this.layers[layerIndex].modifierStack.splice(modifierIndex, 1);
		}
	}

	/** Repaint all terrain using current layer settings */
	repaint(): void {
		if (this.layers.length === 0) return;

		const terrainData = this.terrain.getTerrainData();
		const bounds = this.terrain.getBounds();

		// Configure modifier stack with terrain data
		this.modifierStack.configure(terrainData, bounds);

		// Process all layers through GPU pipeline
		this.modifierStack.processLayers(this.layers);

		// Apply splatmaps to terrain material
		const splatmaps = this.modifierStack.getSplatmapTextures();
		this.terrain.setSplatmaps(splatmaps);

		// Set layer diffuse textures on terrain material
		this.terrain.setLayerTextures(this.layerTextures);

		// Set normal maps (layers 0-3)
		this.terrain.setLayerNormalMaps(this.layerNormalTextures);

		// Compute per-layer texture scales from tiling config
		const terrainW = this.config.terrain.width || 100;
		const scales: number[] = [];
		const roughnessValues: number[] = [];
		for (let i = 0; i < this.layers.length; i++) {
			const tileSize = this.layers[i].texture.tiling || 4;
			scales.push(terrainW / tileSize);
			roughnessValues.push(this.layers[i].texture.roughness ?? 0.8);
		}
		this.terrain.setLayerTexScales(scales);
		this.terrain.setLayerRoughness(roughnessValues);
	}

	/** Set splatmap resolution and repaint */
	setSplatmapResolution(resolution: number): void {
		this.config.splatmapResolution = resolution;
		this.modifierStack.setResolution(resolution);
		this.repaint();
	}

	/** Load a layer's diffuse texture from URL */
	private loadLayerTexture(index: number, url: string): void {
		const T = this.THREE;
		const loader = new T.TextureLoader();

		loader.load(url, (texture: any) => {
			texture.wrapS = T.RepeatWrapping;
			texture.wrapT = T.RepeatWrapping;
			texture.minFilter = T.LinearMipmapLinearFilter;
			texture.anisotropy = 16;
			texture.colorSpace = T.SRGBColorSpace;
			this.layerTextures[index] = texture;
		});
	}

	/** Load a layer's normal map texture from URL */
	private loadLayerNormalTexture(index: number, url: string): void {
		const T = this.THREE;
		const loader = new T.TextureLoader();

		loader.load(
			url,
			(texture: any) => {
				texture.wrapS = T.RepeatWrapping;
				texture.wrapT = T.RepeatWrapping;
				texture.minFilter = T.LinearMipmapLinearFilter;
				texture.anisotropy = 16;
				// Normal maps must stay in linear color space
				if (T.LinearSRGBColorSpace) {
					texture.colorSpace = T.LinearSRGBColorSpace;
				} else if (T.LinearEncoding !== undefined) {
					texture.encoding = T.LinearEncoding;
				}
				this.layerNormalTextures[index] = texture;
			},
			undefined,
			() => {
				// Normal map failed to load — terrain still works, just flat normals
				this.layerNormalTextures[index] = null;
			},
		);
	}

	/** Auto-derive normal map URL from diffuse URL (e.g. "Ground037.jpg" → "Ground037_Normal.jpg") */
	private deriveNormalUrl(diffuseUrl: string): string | null {
		if (!diffuseUrl) return null;
		const lastDot = diffuseUrl.lastIndexOf(".");
		if (lastDot === -1) return null;
		const base = diffuseUrl.substring(0, lastDot);
		const ext = diffuseUrl.substring(lastDot);
		return `${base}_Normal${ext}`;
	}

	/** Serialize full state for persistence */
	toJSON(): Record<string, unknown> {
		return {
			config: this.config,
			layers: this.layers.map((l) => l.toJSON()),
		};
	}

	/** Restore from saved state */
	fromJSON(data: Record<string, unknown>): void {
		if (data.config) {
			this.config = data.config as TerrainPainterConfig;
		}
		// Layers need to be restored by the caller since they require texture loading
	}

	dispose(): void {
		this.terrain.dispose();
		this.modifierStack.dispose();
		for (const tex of this.layerTextures) tex?.dispose();
		for (const tex of this.layerNormalTextures) tex?.dispose();
		if (this.terrain.mesh.parent) {
			this.terrain.mesh.parent.remove(this.terrain.mesh);
		}
	}
}
