/**
 * PopulationEngine — Main orchestrator for terrain population
 *
 * Coordinates Poisson sampling, heatmap filtering, clustering, and
 * object placement to populate terrain with natural-looking distributions.
 *
 * Usage:
 *   const engine = new PopulationEngine();
 *   engine.setTerrainData(heightData, bounds);
 *   engine.addLayer(layer);
 *   const result = engine.populateLayer(layerId);
 *   // result.objects[] contains positioned + rotated + scaled instances
 */

import { filterPoints, uniformHeatmap, compositeHeatmaps, type HeatmapData } from "./position-generator";
import { expandClusters } from "./detail-clusterer";
import type { Vector2 } from "./fast-poisson-disk-sampling";
import {
	type PopulationLayer,
	type TreePopulationEntry,
	type DetailPopulationEntry,
	type PopulatedObject,
	type PopulationResult,
	type AutoHeatmapRule,
	type ComputedHeatmap,
	DEFAULT_POPULATION_LAYER,
} from "./population-types";

// ===== Terrain Data Interface =====

/** Terrain data needed by the population engine */
export interface TerrainInfo {
	/** Heightmap as normalized Float32Array (0-1), row-major */
	heightData: Float32Array;
	/** Resolution of heightmap (width = height = resolution) */
	resolution: number;
	/** World-space bounds */
	bounds: {
		minX: number;
		minZ: number;
		maxX: number;
		maxZ: number;
		minY: number;
		maxY: number;
	};
	/** Splatmap data per layer (optional, for splatmap-based rules) */
	splatmapLayers?: Float32Array[];
}

// ===== Population Engine =====

export class PopulationEngine {
	private terrain: TerrainInfo | null = null;
	private layers: Map<string, PopulationLayer> = new Map();
	private cachedHeatmaps: Map<string, ComputedHeatmap> = new Map();
	private allObjects: Map<string, PopulatedObject[]> = new Map();
	private nextId = 1;

	/** Set terrain data that the engine reads for height queries and auto-heatmaps */
	setTerrainData(terrain: TerrainInfo): void {
		this.terrain = terrain;
		// Invalidate all cached heatmaps
		this.cachedHeatmaps.clear();
	}

	/** Add or update a population layer */
	setLayer(layer: PopulationLayer): void {
		this.layers.set(layer.id, layer);
		// Invalidate cached heatmap for this layer
		this.cachedHeatmaps.delete(layer.id);
	}

	/** Remove a population layer and its objects */
	removeLayer(layerId: string): PopulatedObject[] {
		this.layers.delete(layerId);
		this.cachedHeatmaps.delete(layerId);
		const removed = this.allObjects.get(layerId) || [];
		this.allObjects.delete(layerId);
		return removed;
	}

	/** Get a layer by ID */
	getLayer(layerId: string): PopulationLayer | undefined {
		return this.layers.get(layerId);
	}

	/** Get all layers */
	getLayers(): PopulationLayer[] {
		return Array.from(this.layers.values());
	}

	/** Get spawned objects for a layer */
	getObjects(layerId: string): PopulatedObject[] {
		return this.allObjects.get(layerId) || [];
	}

	/** Get all spawned objects across all layers */
	getAllObjects(): PopulatedObject[] {
		const all: PopulatedObject[] = [];
		for (const objs of this.allObjects.values()) {
			for (const o of objs) all.push(o);
		}
		return all;
	}

	/**
	 * Compute the heatmap for a layer (cached).
	 * This is the core "bridge" between Terrain Painter and Population.
	 */
	computeHeatmap(layerId: string): HeatmapData | null {
		const layer = this.layers.get(layerId);
		if (!layer) return null;

		// Check cache
		const cached = this.cachedHeatmaps.get(layerId);
		if (cached) return cached.heatmap;

		let heatmap: HeatmapData;

		if (layer.heatmapSource === "custom" && layer.heatmapTextureUrl) {
			// Custom heatmap — will be loaded externally and set via setCustomHeatmap()
			// Return uniform for now
			heatmap = uniformHeatmap(128, 128, 1.0);
		} else if (layer.autoRules.length > 0 && this.terrain) {
			// Auto-derive from terrain data
			heatmap = this.computeAutoHeatmap(layer.autoRules);
		} else {
			// No rules = spawn everywhere
			heatmap = uniformHeatmap(128, 128, 1.0);
		}

		// Cache it
		this.cachedHeatmaps.set(layerId, {
			layerId,
			heatmap,
			computedAt: Date.now(),
		});

		return heatmap;
	}

	/** Set a pre-loaded custom heatmap for a layer */
	setCustomHeatmap(layerId: string, heatmap: HeatmapData): void {
		this.cachedHeatmaps.set(layerId, {
			layerId,
			heatmap,
			computedAt: Date.now(),
		});
	}

	/** Invalidate cached heatmap (force recompute on next populate) */
	invalidateHeatmap(layerId: string): void {
		this.cachedHeatmaps.delete(layerId);
	}

	/**
	 * Populate a single layer — the main entry point.
	 * Generates positions via Poisson sampling, filters by heatmap,
	 * expands clusters for details, then builds PopulatedObject instances.
	 */
	populateLayer(layerId: string, seed?: number): PopulationResult {
		const startTime = performance.now();
		const layer = this.layers.get(layerId);

		if (!layer || !layer.enabled || !this.terrain) {
			return {
				layerId,
				objects: [],
				durationMs: 0,
				candidateCount: 0,
				filteredCount: 0,
			};
		}

		// Clear previous objects for this layer (unless additive)
		if (!layer.additiveMode) {
			this.allObjects.delete(layerId);
		}

		const heatmap = this.computeHeatmap(layerId);
		if (!heatmap) {
			return { layerId, objects: [], durationMs: 0, candidateCount: 0, filteredCount: 0 };
		}

		const bounds = this.terrain.bounds;
		const bottomLeft: Vector2 = { x: bounds.minX, y: bounds.minZ };
		const topRight: Vector2 = { x: bounds.maxX, y: bounds.maxZ };

		const allNewObjects: PopulatedObject[] = [];
		let totalCandidates = 0;
		let totalFiltered = 0;

		// Process trees
		for (const tree of layer.trees) {
			const filtered = filterPoints(
				heatmap,
				bottomLeft,
				topRight,
				tree.minimumDistance,
				{ minThreshold: layer.minThreshold, maxThreshold: layer.maxThreshold },
				seed,
			);

			totalCandidates += filtered.length * 3; // approximate pre-filter count
			totalFiltered += filtered.length;

			const objects = this.buildTreeObjects(layer.id, tree, filtered, seed);
			for (const o of objects) allNewObjects.push(o);
		}

		// Process details (with clustering)
		for (const detail of layer.details) {
			const seedPoints = filterPoints(
				heatmap,
				bottomLeft,
				topRight,
				detail.minimumDistance,
				{ minThreshold: layer.minThreshold, maxThreshold: layer.maxThreshold },
				seed,
			);

			totalCandidates += seedPoints.length * 3;
			totalFiltered += seedPoints.length;

			// Expand clusters
			const expanded = expandClusters(
				seedPoints,
				detail.clusterRadius,
				detail.clusterAmount,
				seed,
			);

			const objects = this.buildDetailObjects(layer.id, detail, expanded, seed);
			for (const o of objects) allNewObjects.push(o);
		}

		// Store objects
		const existing = layer.additiveMode ? (this.allObjects.get(layerId) || []) : [];
		this.allObjects.set(layerId, [...existing, ...allNewObjects]);

		const durationMs = performance.now() - startTime;

		return {
			layerId,
			objects: allNewObjects,
			durationMs,
			candidateCount: totalCandidates,
			filteredCount: totalFiltered,
		};
	}

	/** Populate all enabled layers */
	populateAll(seed?: number): PopulationResult[] {
		const results: PopulationResult[] = [];
		for (const [layerId, layer] of this.layers) {
			if (layer.enabled) {
				results.push(this.populateLayer(layerId, seed));
			}
		}
		return results;
	}

	/** Clear all objects for a layer */
	clearLayer(layerId: string): PopulatedObject[] {
		const removed = this.allObjects.get(layerId) || [];
		this.allObjects.delete(layerId);
		return removed;
	}

	/** Clear all objects across all layers */
	clearAll(): PopulatedObject[] {
		const all = this.getAllObjects();
		this.allObjects.clear();
		return all;
	}

	// ===== Private Helpers =====

	/** Build PopulatedObject instances for tree entries */
	private buildTreeObjects(
		layerId: string,
		tree: TreePopulationEntry,
		positions: Vector2[],
		seed?: number,
	): PopulatedObject[] {
		const objects: PopulatedObject[] = [];
		let rngState = seed !== undefined ? seed + hashString(tree.id) : 0;

		const rand = (): number => {
			if (seed !== undefined) {
				rngState = (rngState + 0x6d2b79f5) | 0;
				let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
				t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			}
			return Math.random();
		};

		for (const pos of positions) {
			const terrainY = this.sampleTerrainHeight(pos.x, pos.y);
			const scale = tree.minScale + rand() * (tree.maxScale - tree.minScale);
			const rotY = tree.randomRotation ? rand() * Math.PI * 2 : 0;

			// Surface normal alignment
			let rotX = 0;
			let rotZ = 0;
			if (tree.alignToSurface && this.terrain) {
				const normal = this.sampleTerrainNormal(pos.x, pos.y);
				rotX = Math.atan2(normal.z, normal.y);
				rotZ = -Math.atan2(normal.x, normal.y);
			}

			objects.push({
				id: `pop_${this.nextId++}`,
				layerId,
				entryId: tree.id,
				position: {
					x: pos.x,
					y: terrainY - tree.sinkAmount,
					z: pos.y,
				},
				rotation: { x: rotX, y: rotY, z: rotZ },
				scale,
				modelPath: tree.modelPath,
				packId: tree.packId,
			});
		}

		return objects;
	}

	/** Build PopulatedObject instances for detail entries */
	private buildDetailObjects(
		layerId: string,
		detail: DetailPopulationEntry,
		positions: Vector2[],
		seed?: number,
	): PopulatedObject[] {
		const objects: PopulatedObject[] = [];
		let rngState = seed !== undefined ? seed + hashString(detail.id) : 0;

		const rand = (): number => {
			if (seed !== undefined) {
				rngState = (rngState + 0x6d2b79f5) | 0;
				let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
				t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			}
			return Math.random();
		};

		for (const pos of positions) {
			const terrainY = this.sampleTerrainHeight(pos.x, pos.y);
			const rotY = rand() * Math.PI * 2;

			objects.push({
				id: `pop_${this.nextId++}`,
				layerId,
				entryId: detail.id,
				position: { x: pos.x, y: terrainY, z: pos.y },
				rotation: { x: 0, y: rotY, z: 0 },
				scale: detail.scale,
				modelPath: detail.modelPath,
				packId: detail.packId,
			});
		}

		return objects;
	}

	/** Sample terrain height at world XZ position */
	private sampleTerrainHeight(worldX: number, worldZ: number): number {
		if (!this.terrain) return 0;

		const { bounds, heightData, resolution } = this.terrain;
		const u = (worldX - bounds.minX) / (bounds.maxX - bounds.minX);
		const v = (worldZ - bounds.minZ) / (bounds.maxZ - bounds.minZ);

		if (u < 0 || u > 1 || v < 0 || v > 1) return 0;

		// Bilinear interpolation
		const fx = u * (resolution - 1);
		const fy = v * (resolution - 1);
		const x0 = Math.floor(fx);
		const y0 = Math.floor(fy);
		const x1 = Math.min(x0 + 1, resolution - 1);
		const y1 = Math.min(y0 + 1, resolution - 1);
		const dx = fx - x0;
		const dy = fy - y0;

		const h00 = heightData[y0 * resolution + x0];
		const h10 = heightData[y0 * resolution + x1];
		const h01 = heightData[y1 * resolution + x0];
		const h11 = heightData[y1 * resolution + x1];

		const h = h00 * (1 - dx) * (1 - dy) + h10 * dx * (1 - dy) + h01 * (1 - dx) * dy + h11 * dx * dy;

		const heightRange = bounds.maxY - bounds.minY;
		return bounds.minY + h * heightRange;
	}

	/** Sample terrain normal at world XZ position (approximate from heightmap) */
	private sampleTerrainNormal(worldX: number, worldZ: number): { x: number; y: number; z: number } {
		if (!this.terrain) return { x: 0, y: 1, z: 0 };

		const { bounds, heightData, resolution } = this.terrain;
		const u = (worldX - bounds.minX) / (bounds.maxX - bounds.minX);
		const v = (worldZ - bounds.minZ) / (bounds.maxZ - bounds.minZ);

		const px = Math.floor(u * (resolution - 1));
		const py = Math.floor(v * (resolution - 1));

		const heightScale = bounds.maxY - bounds.minY;
		const texelWorldSize = (bounds.maxX - bounds.minX) / resolution;

		const hL = heightData[py * resolution + Math.max(0, px - 1)] * heightScale;
		const hR = heightData[py * resolution + Math.min(resolution - 1, px + 1)] * heightScale;
		const hD = heightData[Math.max(0, py - 1) * resolution + px] * heightScale;
		const hU = heightData[Math.min(resolution - 1, py + 1) * resolution + px] * heightScale;

		const nx = (hL - hR) / (2 * texelWorldSize);
		const ny = 1;
		const nz = (hD - hU) / (2 * texelWorldSize);
		const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

		return { x: nx / len, y: ny / len, z: nz / len };
	}

	/**
	 * Compute an auto-heatmap from terrain data using rules.
	 * This is where Terrain Painter data gets turned into population heatmaps.
	 */
	private computeAutoHeatmap(rules: AutoHeatmapRule[]): HeatmapData {
		if (!this.terrain) return uniformHeatmap(128, 128, 1.0);

		const resolution = 128; // Heatmap resolution (lower than terrain for performance)
		const { heightData, resolution: terrainRes, bounds } = this.terrain;
		const heightScale = bounds.maxY - bounds.minY;

		const ruleMaps: { data: HeatmapData; blendMode: "multiply" | "add" | "min" | "max"; invert: boolean }[] = [];

		for (const rule of rules) {
			if (!rule.enabled) continue;

			const ruleData = new Float32Array(resolution * resolution);

			for (let y = 0; y < resolution; y++) {
				for (let x = 0; x < resolution; x++) {
					const u = x / (resolution - 1);
					const v = y / (resolution - 1);

					// Sample terrain at this UV
					const tx = Math.floor(u * (terrainRes - 1));
					const ty = Math.floor(v * (terrainRes - 1));

					let value: number;

					switch (rule.source) {
						case "height": {
							value = heightData[ty * terrainRes + tx];
							break;
						}
						case "slope": {
							value = this.computeSlopeAt(tx, ty, terrainRes, heightData, heightScale, bounds);
							break;
						}
						case "curvature": {
							value = this.computeCurvatureAt(tx, ty, terrainRes, heightData);
							break;
						}
						case "noise": {
							// Simple noise based on position
							value = this.simpleNoise(u * 10, v * 10);
							break;
						}
						case "splatmap": {
							const layerIdx = rule.sourceLayerIndex ?? 0;
							if (this.terrain.splatmapLayers && this.terrain.splatmapLayers[layerIdx]) {
								const splatData = this.terrain.splatmapLayers[layerIdx];
								const si = ty * terrainRes + tx;
								value = si < splatData.length ? splatData[si] : 0;
							} else {
								value = 0;
							}
							break;
						}
						default:
							value = 1;
					}

					// Remap to rule's input range
					value = remapClamp(value, rule.inputMin, rule.inputMax, 0, 1);

					ruleData[y * resolution + x] = value;
				}
			}

			ruleMaps.push({
				data: { data: ruleData, width: resolution, height: resolution },
				blendMode: rule.blendMode,
				invert: rule.invert,
			});
		}

		if (ruleMaps.length === 0) {
			return uniformHeatmap(resolution, resolution, 1.0);
		}

		return compositeHeatmaps(ruleMaps, resolution, resolution);
	}

	/** Compute normalized slope at a heightmap texel (0 = flat, 1 = vertical) */
	private computeSlopeAt(
		tx: number,
		ty: number,
		terrainRes: number,
		heightData: Float32Array,
		heightScale: number,
		bounds: TerrainInfo["bounds"],
	): number {
		const texelWorldSize = (bounds.maxX - bounds.minX) / terrainRes;

		const hL = heightData[ty * terrainRes + Math.max(0, tx - 1)] * heightScale;
		const hR = heightData[ty * terrainRes + Math.min(terrainRes - 1, tx + 1)] * heightScale;
		const hD = heightData[Math.max(0, ty - 1) * terrainRes + tx] * heightScale;
		const hU = heightData[Math.min(terrainRes - 1, ty + 1) * terrainRes + tx] * heightScale;

		const dx = (hR - hL) / (2 * texelWorldSize);
		const dz = (hU - hD) / (2 * texelWorldSize);

		// Slope angle in radians, normalized to 0-1 (0 = flat, 1 = 90 degrees)
		const slopeAngle = Math.atan(Math.sqrt(dx * dx + dz * dz));
		return slopeAngle / (Math.PI / 2);
	}

	/** Compute normalized curvature at a heightmap texel (0.5 = flat, >0.5 = convex, <0.5 = concave) */
	private computeCurvatureAt(
		tx: number,
		ty: number,
		terrainRes: number,
		heightData: Float32Array,
	): number {
		const hC = heightData[ty * terrainRes + tx];
		const hL = heightData[ty * terrainRes + Math.max(0, tx - 1)];
		const hR = heightData[ty * terrainRes + Math.min(terrainRes - 1, tx + 1)];
		const hD = heightData[Math.max(0, ty - 1) * terrainRes + tx];
		const hU = heightData[Math.min(terrainRes - 1, ty + 1) * terrainRes + tx];

		// Laplacian: sum of second derivatives
		const laplacian = (hL + hR + hD + hU - 4 * hC);

		// Normalize to 0-1 range (map laplacian to sigmoid-like range)
		return 0.5 + Math.tanh(laplacian * 20) * 0.5;
	}

	/** Simple 2D value noise for the noise rule source */
	private simpleNoise(x: number, y: number): number {
		const xi = Math.floor(x);
		const yi = Math.floor(y);
		const xf = x - xi;
		const yf = y - yi;

		const hash = (a: number, b: number): number => {
			let h = (a * 374761393 + b * 668265263 + 1274126177) | 0;
			h = Math.imul(h ^ (h >>> 13), 1103515245);
			return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
		};

		const v00 = hash(xi, yi);
		const v10 = hash(xi + 1, yi);
		const v01 = hash(xi, yi + 1);
		const v11 = hash(xi + 1, yi + 1);

		// Smoothstep interpolation
		const sx = xf * xf * (3 - 2 * xf);
		const sy = yf * yf * (3 - 2 * yf);

		return v00 * (1 - sx) * (1 - sy) + v10 * sx * (1 - sy) + v01 * (1 - sx) * sy + v11 * sx * sy;
	}

	// ===== Serialization =====

	toJSON(): { layers: PopulationLayer[]; objects: Record<string, PopulatedObject[]> } {
		const layers = Array.from(this.layers.values());
		const objects: Record<string, PopulatedObject[]> = {};
		for (const [id, objs] of this.allObjects) {
			objects[id] = objs;
		}
		return { layers, objects };
	}

	fromJSON(data: { layers?: PopulationLayer[]; objects?: Record<string, PopulatedObject[]> }): void {
		this.layers.clear();
		this.allObjects.clear();
		this.cachedHeatmaps.clear();

		if (data.layers) {
			for (const layer of data.layers) {
				this.layers.set(layer.id, layer);
			}
		}
		if (data.objects) {
			for (const [id, objs] of Object.entries(data.objects)) {
				this.allObjects.set(id, objs);
				// Update nextId to avoid collisions
				for (const obj of objs) {
					const numPart = obj.id.replace("pop_", "");
					const num = parseInt(numPart, 10);
					if (!isNaN(num) && num >= this.nextId) {
						this.nextId = num + 1;
					}
				}
			}
		}
	}
}

// ===== Utilities =====

/** Remap a value from one range to another, clamped */
function remapClamp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
	if (inMax === inMin) return outMin;
	const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
	return outMin + t * (outMax - outMin);
}

/** Simple string hash for seeding per-entry RNG */
function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
	}
	return hash;
}
