/**
 * TerrainMesh — Three.js terrain mesh with heightmap displacement
 *
 * Unity has a built-in Terrain object. Three.js doesn't, so we create one:
 * - PlaneGeometry with configurable subdivisions
 * - Heightmap loaded from grayscale texture or generated procedurally
 * - Heightmap DataTexture for GPU sampling in filter shaders
 * - Normal map generated from heightmap
 * - Custom ShaderMaterial that blends textures using splatmaps
 */

import {
	TERRAIN_MATERIAL_VERTEX,
	TERRAIN_MATERIAL_FRAGMENT,
} from "../shaders/modifier-passes.glsl";
import type { TerrainData, TerrainBounds } from "./modifier-stack";

export interface TerrainConfig {
	width: number;
	depth: number;
	heightScale: number;
	segments: number; // subdivision count
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
	width: 100,
	depth: 100,
	heightScale: 30,
	segments: 128,
};

export class TerrainMesh {
	private THREE: any;
	mesh: any = null; // THREE.Mesh
	private geometry: any = null;
	private material: any = null;
	heightmapTexture: any = null; // DataTexture
	normalMapTexture: any = null; // DataTexture
	private heightData: Float32Array;
	config: TerrainConfig;

	constructor(THREE: any, config: Partial<TerrainConfig> = {}) {
		this.THREE = THREE;
		this.config = { ...DEFAULT_TERRAIN_CONFIG, ...config };

		const res = this.config.segments + 1;
		this.heightData = new Float32Array(res * res);

		this.createMesh();
		this.createHeightmapTexture();
		this.createNormalMapTexture();
	}

	private createMesh(): void {
		const T = this.THREE;
		const { width, depth, segments } = this.config;

		this.geometry = new T.PlaneGeometry(width, depth, segments, segments);
		// Rotate to XZ plane (Three.js PlaneGeometry is XY by default)
		this.geometry.rotateX(-Math.PI / 2);

		// Create PBR splatmap terrain material
		this.material = new T.ShaderMaterial({
			vertexShader: TERRAIN_MATERIAL_VERTEX,
			fragmentShader: TERRAIN_MATERIAL_FRAGMENT,
			uniforms: {
				u_heightmap: { value: null },
				u_heightScale: { value: this.config.heightScale },
				u_terrainWidth: { value: width },
				u_terrainDepth: { value: depth },
				u_splatmap0: { value: null },
				u_splatmap1: { value: null },
				// Layer diffuse textures
				u_layer0: { value: null },
				u_layer1: { value: null },
				u_layer2: { value: null },
				u_layer3: { value: null },
				u_layer4: { value: null },
				u_layer5: { value: null },
				u_layer6: { value: null },
				u_layer7: { value: null },
				// Normal maps (layers 0-3)
				u_normal0: { value: null },
				u_normal1: { value: null },
				u_normal2: { value: null },
				u_normal3: { value: null },
				u_hasNormal0: { value: 0.0 },
				u_hasNormal1: { value: 0.0 },
				u_hasNormal2: { value: 0.0 },
				u_hasNormal3: { value: 0.0 },
				// Roughness maps (layers 0-3)
				u_roughMap0: { value: null },
				u_roughMap1: { value: null },
				u_roughMap2: { value: null },
				u_roughMap3: { value: null },
				u_hasRoughMap0: { value: 0.0 },
				u_hasRoughMap1: { value: 0.0 },
				u_hasRoughMap2: { value: 0.0 },
				u_hasRoughMap3: { value: 0.0 },
				// AO maps (layers 0-3)
				u_aoMap0: { value: null },
				u_aoMap1: { value: null },
				u_aoMap2: { value: null },
				u_aoMap3: { value: null },
				u_hasAOMap0: { value: 0.0 },
				u_hasAOMap1: { value: 0.0 },
				u_hasAOMap2: { value: 0.0 },
				u_hasAOMap3: { value: 0.0 },
				// Emission flags (reuse AO slot as emission sampler)
				u_isEmissive0: { value: 0.0 },
				u_isEmissive1: { value: 0.0 },
				u_isEmissive2: { value: 0.0 },
				u_isEmissive3: { value: 0.0 },
				u_emissionIntensity0: { value: 0.0 },
				u_emissionIntensity1: { value: 0.0 },
				u_emissionIntensity2: { value: 0.0 },
				u_emissionIntensity3: { value: 0.0 },
				// Per-layer texture scale
				u_texScale0: { value: 10.0 },
				u_texScale1: { value: 10.0 },
				u_texScale2: { value: 10.0 },
				u_texScale3: { value: 10.0 },
				u_texScale4: { value: 10.0 },
				u_texScale5: { value: 10.0 },
				u_texScale6: { value: 10.0 },
				u_texScale7: { value: 10.0 },
				// Per-layer roughness
				u_roughness0: { value: 0.85 },
				u_roughness1: { value: 0.75 },
				u_roughness2: { value: 0.92 },
				u_roughness3: { value: 0.3 },
				u_roughness4: { value: 0.8 },
				u_roughness5: { value: 0.8 },
				u_roughness6: { value: 0.8 },
				u_roughness7: { value: 0.8 },
				u_layerCount: { value: 0 },
			},
			side: T.DoubleSide,
		});

		this.mesh = new T.Mesh(this.geometry, this.material);
		this.mesh.name = "__terrain__";
		this.mesh.receiveShadow = true;
	}

	private createHeightmapTexture(): void {
		const T = this.THREE;
		const res = this.config.segments + 1;

		this.heightmapTexture = new T.DataTexture(
			this.heightData,
			res,
			res,
			T.RedFormat,
			T.FloatType,
		);
		this.heightmapTexture.minFilter = T.LinearFilter;
		this.heightmapTexture.magFilter = T.LinearFilter;
		this.heightmapTexture.needsUpdate = true;

		this.material.uniforms.u_heightmap.value = this.heightmapTexture;
	}

	private createNormalMapTexture(): void {
		const T = this.THREE;
		const res = this.config.segments + 1;

		// Generate normals from heightmap on CPU
		const normalData = new Float32Array(res * res * 4); // RGBA
		this.computeNormals(normalData);

		this.normalMapTexture = new T.DataTexture(
			normalData,
			res,
			res,
			T.RGBAFormat,
			T.FloatType,
		);
		this.normalMapTexture.minFilter = T.LinearFilter;
		this.normalMapTexture.magFilter = T.LinearFilter;
		this.normalMapTexture.needsUpdate = true;
	}

	/** Compute normal map from heightmap data (CPU) */
	private computeNormals(normalData: Float32Array): void {
		const res = this.config.segments + 1;
		const scale = this.config.heightScale;

		for (let y = 0; y < res; y++) {
			for (let x = 0; x < res; x++) {
				const idx = y * res + x;
				const h = this.heightData[idx] * scale;

				// Sample neighbors (clamped)
				const hL =
					this.heightData[y * res + Math.max(0, x - 1)] * scale;
				const hR =
					this.heightData[y * res + Math.min(res - 1, x + 1)] * scale;
				const hD =
					this.heightData[Math.max(0, y - 1) * res + x] * scale;
				const hU =
					this.heightData[Math.min(res - 1, y + 1) * res + x] * scale;

				// Cross-kernel normal
				const nx = hL - hR;
				const ny = 2.0;
				const nz = hD - hU;
				const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

				// Store as 0-1 range (packed)
				const pidx = idx * 4;
				normalData[pidx] = (nx / len) * 0.5 + 0.5;
				normalData[pidx + 1] = (ny / len) * 0.5 + 0.5;
				normalData[pidx + 2] = (nz / len) * 0.5 + 0.5;
				normalData[pidx + 3] = 1.0;
			}
		}
	}

	/** Load heightmap from a grayscale image URL */
	async loadHeightmap(imageUrl: string): Promise<void> {
		const T = this.THREE;

		return new Promise((resolve, reject) => {
			const loader = new T.TextureLoader();
			loader.load(
				imageUrl,
				(texture: any) => {
					// Read pixel data from texture
					const canvas = document.createElement("canvas");
					const res = this.config.segments + 1;
					canvas.width = res;
					canvas.height = res;
					const ctx = canvas.getContext("2d")!;
					ctx.drawImage(texture.image, 0, 0, res, res);
					const imageData = ctx.getImageData(0, 0, res, res);

					// Extract red channel as height
					for (let i = 0; i < res * res; i++) {
						this.heightData[i] = imageData.data[i * 4] / 255.0;
					}

					this.updateHeightmap();
					resolve();
				},
				undefined,
				reject,
			);
		});
	}

	/** Generate a procedural heightmap using simple noise */
	generateProceduralHeightmap(
		scale = 0.02,
		octaves = 4,
		persistence = 0.5,
	): void {
		const res = this.config.segments + 1;

		for (let y = 0; y < res; y++) {
			for (let x = 0; x < res; x++) {
				let value = 0;
				let amplitude = 1;
				let frequency = scale;

				for (let o = 0; o < octaves; o++) {
					// Simple noise approximation using sin
					value +=
						amplitude *
						(Math.sin(x * frequency * 1.7 + y * frequency * 0.3) *
							0.5 +
							0.5) *
						(Math.cos(y * frequency * 2.1 - x * frequency * 0.7) *
							0.5 +
							0.5);
					amplitude *= persistence;
					frequency *= 2;
				}

				this.heightData[y * res + x] = value / (2 - Math.pow(persistence, octaves));
			}
		}

		this.updateHeightmap();
	}

	/** Update mesh geometry vertices from heightmap data */
	private updateHeightmap(): void {
		const positions = this.geometry.attributes.position.array as Float32Array;
		const res = this.config.segments + 1;
		const scale = this.config.heightScale;

		// PlaneGeometry after rotateX(-PI/2) has vertices in XZ plane
		// Y is the height axis
		for (let i = 0; i < res * res; i++) {
			positions[i * 3 + 1] = this.heightData[i] * scale;
		}

		this.geometry.attributes.position.needsUpdate = true;
		this.geometry.computeVertexNormals();
		this.geometry.computeBoundingBox();
		this.geometry.computeBoundingSphere();

		// Update heightmap texture
		this.heightmapTexture.image.data = this.heightData;
		this.heightmapTexture.needsUpdate = true;

		// Recompute normal map
		const normalData = this.normalMapTexture.image.data as Float32Array;
		this.computeNormals(normalData);
		this.normalMapTexture.needsUpdate = true;
	}

	/** Get terrain data for modifier stack processing */
	getTerrainData(): TerrainData {
		const pos = this.mesh.position;
		return {
			heightmapTexture: this.heightmapTexture,
			normalMapTexture: this.normalMapTexture,
			size: {
				x: this.config.width,
				y: this.config.heightScale,
				z: this.config.depth,
			},
			position: { x: pos.x, y: pos.y, z: pos.z },
			heightmapResolution: this.config.segments + 1,
		};
	}

	/** Get bounds for modifier stack */
	getBounds(): TerrainBounds {
		const pos = this.mesh.position;
		const hw = this.config.width / 2;
		const hd = this.config.depth / 2;

		return {
			min: { x: pos.x - hw, y: 0, z: pos.z - hd },
			max: {
				x: pos.x + hw,
				y: this.config.heightScale,
				z: pos.z + hd,
			},
			size: {
				x: this.config.width,
				y: this.config.heightScale,
				z: this.config.depth,
			},
		};
	}

	/** Set splatmap textures from modifier stack output */
	setSplatmaps(splatmaps: unknown[]): void {
		if (splatmaps[0])
			this.material.uniforms.u_splatmap0.value = splatmaps[0];
		if (splatmaps[1])
			this.material.uniforms.u_splatmap1.value = splatmaps[1];
	}

	/** Set layer diffuse textures */
	setLayerTextures(textures: unknown[]): void {
		const keys = [
			"u_layer0", "u_layer1", "u_layer2", "u_layer3",
			"u_layer4", "u_layer5", "u_layer6", "u_layer7",
		];
		for (let i = 0; i < Math.min(textures.length, 8); i++) {
			this.material.uniforms[keys[i]].value = textures[i];
		}
		this.material.uniforms.u_layerCount.value = textures.length;
	}

	/** Set layer normal map textures (layers 0-3) */
	setLayerNormalMaps(normals: (unknown | null)[]): void {
		for (let i = 0; i < Math.min(normals.length, 4); i++) {
			this.material.uniforms[`u_normal${i}`].value = normals[i];
			this.material.uniforms[`u_hasNormal${i}`].value = normals[i] ? 1.0 : 0.0;
		}
	}

	/** Set per-layer texture tiling scales */
	setLayerTexScales(scales: number[]): void {
		for (let i = 0; i < Math.min(scales.length, 8); i++) {
			this.material.uniforms[`u_texScale${i}`].value = scales[i];
		}
	}

	/** Set per-layer roughness values */
	setLayerRoughness(values: number[]): void {
		for (let i = 0; i < Math.min(values.length, 8); i++) {
			this.material.uniforms[`u_roughness${i}`].value = values[i];
		}
	}

	dispose(): void {
		this.geometry?.dispose();
		this.material?.dispose();
		this.heightmapTexture?.dispose();
		this.normalMapTexture?.dispose();
		// Dispose normal map textures from uniforms
		for (let i = 0; i < 4; i++) {
			const nt = this.material?.uniforms?.[`u_normal${i}`]?.value;
			if (nt) nt.dispose();
		}
	}
}
