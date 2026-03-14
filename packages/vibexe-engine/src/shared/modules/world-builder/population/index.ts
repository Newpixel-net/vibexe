/**
 * Terrain Population System — Public API
 *
 * Heatmap-driven Poisson Disk Sampling for natural object distribution.
 * Ported from SuperiorWorlds WorldBuilder Unity asset.
 */

// Core algorithms
export { poissonDiskSampling, poissonDiskSamplingSeeded } from "./fast-poisson-disk-sampling";
export type { Vector2 } from "./fast-poisson-disk-sampling";

// Heatmap filtering
export {
	filterPoints,
	heatmapFromImageData,
	uniformHeatmap,
	compositeHeatmaps,
} from "./position-generator";
export type { HeatmapData, FilterOptions, BlendMode } from "./position-generator";

// Detail clustering
export {
	calculateConcentricClusterPositions,
	calculateConcentricClusterPositionsSeeded,
	expandClusters,
} from "./detail-clusterer";

// Population engine
export { PopulationEngine } from "./population-engine";
export type { TerrainInfo } from "./population-engine";

// Type definitions
export type {
	PopulationLayer,
	TreePopulationEntry,
	DetailPopulationEntry,
	AutoHeatmapRule,
	HeatmapSource,
	ComputedHeatmap,
	PopulatedObject,
	PopulationResult,
	WorldPopulationBlueprint,
	BlueprintLayer,
	BlueprintAsset,
	PopulationState,
} from "./population-types";

export {
	DEFAULT_POPULATION_LAYER,
	DEFAULT_TREE_ENTRY,
	DEFAULT_DETAIL_ENTRY,
	DEFAULT_AUTO_RULE,
	DENSITY_DISTANCES,
	POPULATION_STATE_VERSION,
} from "./population-types";

// Terrain analyzer (bridge between Terrain Painter and Population)
export {
	extractTerrainInfo,
	extractHeightFromGeometry,
} from "./terrain-analyzer";

// Biome presets
export { BIOME_PRESETS, getBiomePreset, getBiomePresetIds } from "./biome-presets";
export type { BiomePreset, PresetLayerTemplate, PresetAssetSlot } from "./biome-presets";
