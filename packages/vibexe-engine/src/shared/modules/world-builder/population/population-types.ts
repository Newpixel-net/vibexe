/**
 * Population System — Type definitions
 *
 * These types define the configuration format for terrain population.
 * They map 1:1 to SuperiorWorlds concepts (layers, trees, details)
 * but adapted for Vibexe's web-based architecture.
 */

import type { BlendMode, HeatmapData } from "./position-generator";

// ===== Layer Configuration =====

/** A population layer — controls what spawns and where using heatmaps */
export interface PopulationLayer {
	/** Unique layer ID */
	id: string;
	/** Human-readable layer name (e.g., "Forest Floor", "Mountain Peaks") */
	name: string;
	/** Whether this layer is active */
	enabled: boolean;
	/** Where the heatmap comes from */
	heatmapSource: "auto" | "custom";
	/** Custom heatmap texture URL (only used when heatmapSource = "custom") */
	heatmapTextureUrl?: string;
	/** Auto-heatmap rules (only used when heatmapSource = "auto") */
	autoRules: AutoHeatmapRule[];
	/** Minimum heatmap value to accept placement (0-1) */
	minThreshold: number;
	/** Maximum heatmap value to accept placement (0-1) */
	maxThreshold: number;
	/** If true, add to existing population instead of replacing */
	additiveMode: boolean;
	/** Tree objects (large, individually placed via Poisson) */
	trees: TreePopulationEntry[];
	/** Detail objects (small, cluster-placed around Poisson seeds) */
	details: DetailPopulationEntry[];
}

/** Default values for a new population layer */
export const DEFAULT_POPULATION_LAYER: Omit<PopulationLayer, "id"> = {
	name: "New Layer",
	enabled: true,
	heatmapSource: "auto",
	heatmapTextureUrl: undefined,
	autoRules: [],
	minThreshold: 0.5,
	maxThreshold: 1.0,
	additiveMode: false,
	trees: [],
	details: [],
};

// ===== Object Entries =====

/** Base properties shared by both tree and detail entries */
interface PopulationEntryBase {
	/** Unique entry ID within the layer */
	id: string;
	/** Display name (from asset catalog) */
	displayName: string;
	/** Asset catalog item ID (from SharedAssetBrowser) */
	assetId: string;
	/** Model file path (relative to media-stock-3d) */
	modelPath: string;
	/** Asset pack ID (e.g., "kaykit-platformer", "platformer-project") */
	packId: string;
	/** Minimum Poisson disk distance between instances */
	minimumDistance: number;
}

/** Tree population entry — large objects, individually placed */
export interface TreePopulationEntry extends PopulationEntryBase {
	/** Minimum height/scale multiplier (default 0.8) */
	minScale: number;
	/** Maximum height/scale multiplier (default 1.2) */
	maxScale: number;
	/** Whether to apply random Y-axis rotation (default true) */
	randomRotation: boolean;
	/** Whether to align to terrain surface normal (default false) */
	alignToSurface: boolean;
	/** How much to sink the model into terrain (default 0, positive = lower) */
	sinkAmount: number;
}

/** Detail population entry — small objects with clustering */
export interface DetailPopulationEntry extends PopulationEntryBase {
	/** Cluster spread radius around each Poisson seed (0 = no clustering) */
	clusterRadius: number;
	/** Number of instances per cluster (default 3) */
	clusterAmount: number;
	/** Scale multiplier for detail objects (usually smaller than trees) */
	scale: number;
}

/** Defaults for new tree entries */
export const DEFAULT_TREE_ENTRY: Omit<TreePopulationEntry, "id" | "assetId" | "modelPath" | "packId" | "displayName"> = {
	minimumDistance: 5,
	minScale: 0.8,
	maxScale: 1.2,
	randomRotation: true,
	alignToSurface: false,
	sinkAmount: 0,
};

/** Defaults for new detail entries */
export const DEFAULT_DETAIL_ENTRY: Omit<DetailPopulationEntry, "id" | "assetId" | "modelPath" | "packId" | "displayName"> = {
	minimumDistance: 3,
	clusterRadius: 1.5,
	clusterAmount: 3,
	scale: 0.5,
};

// ===== Auto-Heatmap Rules =====

/** Rule that derives a heatmap from terrain analysis data */
export interface AutoHeatmapRule {
	/** Unique rule ID */
	id: string;
	/** What terrain property to use as source */
	source: HeatmapSource;
	/** For splatmap source: which texture layer index (0-7) */
	sourceLayerIndex?: number;
	/** Invert the source (high → low, low → high) */
	invert: boolean;
	/** Remap input range: values below this become 0 */
	inputMin: number;
	/** Remap input range: values above this become 1 */
	inputMax: number;
	/** How to blend this rule with previous rules */
	blendMode: BlendMode;
	/** Whether this rule is active */
	enabled: boolean;
}

export type HeatmapSource =
	| "height"       // Normalized terrain height (0 = lowest, 1 = highest)
	| "slope"        // Terrain slope angle (0 = flat, 1 = vertical)
	| "curvature"    // Terrain curvature (0 = flat, 0.5 = ridge, 1 = valley)
	| "noise"        // Perlin noise (for random variation)
	| "splatmap";    // Terrain Painter's splatmap layer (where a specific texture is painted)

/** Default values for a new auto-heatmap rule */
export const DEFAULT_AUTO_RULE: Omit<AutoHeatmapRule, "id"> = {
	source: "height",
	invert: false,
	inputMin: 0,
	inputMax: 1,
	blendMode: "multiply",
	enabled: true,
};

// ===== Computed Heatmap =====

/** Cached computed heatmap for a layer (recomputed when rules change) */
export interface ComputedHeatmap {
	layerId: string;
	heatmap: HeatmapData;
	/** Timestamp of last computation */
	computedAt: number;
}

// ===== Population Result =====

/** A single spawned object from the population system */
export interface PopulatedObject {
	/** Unique instance ID */
	id: string;
	/** Source layer ID */
	layerId: string;
	/** Source entry ID (tree or detail) */
	entryId: string;
	/** World position (XZ from Poisson, Y from terrain height) */
	position: { x: number; y: number; z: number };
	/** Euler rotation in radians */
	rotation: { x: number; y: number; z: number };
	/** Uniform scale multiplier */
	scale: number;
	/** Asset model path for loading */
	modelPath: string;
	/** Asset pack ID */
	packId: string;
}

/** Result of populating a single layer */
export interface PopulationResult {
	layerId: string;
	objects: PopulatedObject[];
	/** Execution time in ms */
	durationMs: number;
	/** Number of Poisson candidates generated (before filtering) */
	candidateCount: number;
	/** Number that passed heatmap filter */
	filteredCount: number;
}

// ===== AI Blueprint Format =====

/** High-level blueprint that AI agents use to describe world population */
export interface WorldPopulationBlueprint {
	/** Biome type hint (used to select presets) */
	biome: string;
	/** Optional seed for deterministic generation */
	seed?: number;
	/** Layer definitions in human-readable format */
	layers: BlueprintLayer[];
}

/** A layer in an AI blueprint */
export interface BlueprintLayer {
	/** Layer name */
	name: string;
	/** Placement rule in natural language (resolved to AutoHeatmapRules) */
	rule: string;
	/** Density hint */
	density: "sparse" | "medium" | "dense" | "very-dense";
	/** Assets to place */
	assets: BlueprintAsset[];
}

/** An asset reference in an AI blueprint */
export interface BlueprintAsset {
	/** Asset category (maps to asset-library-data categories) */
	category: string;
	/** Object type */
	type: "tree" | "detail";
	/** Optional keyword filter for asset search */
	keywords?: string[];
	/** Optional specific asset ID (skips search) */
	assetId?: string;
}

// ===== Density Constants =====

/** Minimum Poisson distance for each density level */
export const DENSITY_DISTANCES: Record<string, number> = {
	"very-dense": 1.5,
	dense: 3,
	medium: 6,
	sparse: 10,
};

// ===== Serialization =====

/** Full population state for save/load */
export interface PopulationState {
	layers: PopulationLayer[];
	/** All spawned objects across all layers */
	objects: PopulatedObject[];
	/** Version for forward compatibility */
	version: number;
}

export const POPULATION_STATE_VERSION = 1;
