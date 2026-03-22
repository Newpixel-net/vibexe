/**
 * Terrain Presets — categorized by game genre and environment type.
 *
 * Each preset defines terrain generation parameters (size, biome noise config)
 * AND material layer configurations (which textures, modifiers, blend rules).
 *
 * Used by the Terrain Painter Panel's preset browser to quickly generate
 * genre-appropriate terrain with matching materials.
 */

// ===== Types =====

export interface TerrainLayerPreset {
	materialId: string;
	tileSize: number;
	roughness: number;
	normalIntensity: number;
	modifiers: Array<{
		type: "Height" | "Slope" | "Curvature" | "Noise";
		enabled: boolean;
		blendMode: "Multiply" | "Add";
		opacity: number;
		params: Record<string, number>;
	}>;
}

export interface BiomeParamRanges {
	heightScale: [number, number];
	continentalGamma: [number, number];
	continentalFreq: number;
	ridgeFreq: [number, number];
	ridgePower: [number, number];
	ridgeSharpness: [number, number];
	plateauSteepness: [number, number];
	hillsAmp: [number, number];
	detailAmp: [number, number];
	warpStrength: [number, number];
	thermalIter: [number, number];
	talusAngle: [number, number];
	hydroDrops: [number, number];
	peakRounds: [number, number];
}

export interface TerrainPresetWaterConfig {
	enabled: boolean;
	waterPreset?: string;
	waterLevelFraction?: number;
	waterLevelAbsolute?: number;
	scaleMatchTerrain?: boolean;
}

export interface TerrainPreset {
	id: string;
	name: string;
	icon: string;
	description: string;
	genre: string[];
	environment: string;
	/** Module biome ID — maps to BIOME_PRESETS in terrain-painter module for erosion-quality generation */
	biomeId: string;
	terrain: {
		width: number;
		depth: number;
		segments: number;
		biome: BiomeParamRanges;
	};
	layers: TerrainLayerPreset[];
	water?: TerrainPresetWaterConfig;
}

// ===== Category Definitions =====

export const GENRE_CATEGORIES = [
	{ id: "all", name: "All", icon: "\u{1F3AE}" },
	{ id: "runner", name: "Runner", icon: "\u{1F3C3}" },
	{ id: "openworld", name: "Open World", icon: "\u{1F5FA}\uFE0F" },
	{ id: "rpg", name: "RPG", icon: "\u2694\uFE0F" },
	{ id: "racing", name: "Racing", icon: "\u{1F3CE}\uFE0F" },
	{ id: "strategy", name: "Strategy", icon: "\u265F\uFE0F" },
	{ id: "survival", name: "Survival", icon: "\u{1F3D5}\uFE0F" },
	{ id: "platformer", name: "Platformer", icon: "\u{1F3AF}" },
	{ id: "arena", name: "Arena", icon: "\u{1F3DF}\uFE0F" },
	{ id: "fps", name: "FPS", icon: "\u{1F52B}" },
	{ id: "towerdefense", name: "Tower Defense", icon: "\u{1F3F0}" },
	{ id: "sports", name: "Sports", icon: "\u26BD" },
] as const;

export const ENVIRONMENT_CATEGORIES = [
	{ id: "all", name: "All", icon: "\u{1F30D}" },
	{ id: "alpine", name: "Alpine", icon: "\u{1F3D4}\uFE0F" },
	{ id: "plains", name: "Plains", icon: "\u{1F33E}" },
	{ id: "desert", name: "Desert", icon: "\u{1F3DC}\uFE0F" },
	{ id: "tropical", name: "Tropical", icon: "\u{1F334}" },
	{ id: "tundra", name: "Arctic", icon: "\u2744\uFE0F" },
	{ id: "volcanic", name: "Volcanic", icon: "\u{1F30B}" },
	{ id: "forest", name: "Forest", icon: "\u{1F332}" },
	{ id: "coastal", name: "Coastal", icon: "\u{1F3DD}\uFE0F" },
	{ id: "alien", name: "Alien", icon: "\u{1F47D}" },
] as const;

// ===== Presets =====

export const TERRAIN_PRESETS: TerrainPreset[] = [
	// 1. Runner Grasslands
	{
		id: "runner_grasslands",
		name: "Runner Grasslands",
		icon: "\u{1F33F}",
		description: "Smooth rolling grass for endless runner games",
		genre: ["runner"],
		environment: "plains",
		biomeId: "runner_flat",
		terrain: {
			width: 400,
			depth: 100,
			segments: 128,
			biome: {
				heightScale: [3, 8],
				continentalGamma: [0.6, 0.9],
				continentalFreq: 0.3,
				ridgeFreq: [1, 1.5],
				ridgePower: [0.2, 0.5],
				ridgeSharpness: [0.3, 0.6],
				plateauSteepness: [1, 1.5],
				hillsAmp: [0.08, 0.15],
				detailAmp: [0.02, 0.04],
				warpStrength: [0.15, 0.3],
				thermalIter: [60, 100],
				talusAngle: [35, 52],
				hydroDrops: [3000, 6000],
				peakRounds: [10, 18],
			},
		},
		layers: [
			{
				materialId: "yfgm_grass01",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.5, minFalloff: 0.05, maxFalloff: 0.1 } },
				],
			},
			{
				materialId: "yfgm_soilgravel02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.2, minFalloff: 0.02, maxFalloff: 0.05 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 40, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_sandysoil",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 15, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_soilgravel01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.3, max: 1.0, minFalloff: 0.1, maxFalloff: 0.02 } },
				],
			},
		],
	water: { enabled: false },
	},

	// 2. Runner Desert
	{
		id: "runner_desert",
		name: "Runner Desert",
		icon: "\u{1F3DC}\uFE0F",
		description: "Gentle sand dunes for desert runner games",
		genre: ["runner"],
		environment: "desert",
		biomeId: "runner_flat",
		terrain: {
			width: 400,
			depth: 100,
			segments: 128,
			biome: {
				heightScale: [3, 8],
				continentalGamma: [0.6, 0.9],
				continentalFreq: 0.3,
				ridgeFreq: [1, 1.5],
				ridgePower: [0.2, 0.5],
				ridgeSharpness: [0.3, 0.6],
				plateauSteepness: [1, 1.5],
				hillsAmp: [0.08, 0.15],
				detailAmp: [0.02, 0.04],
				warpStrength: [0.15, 0.3],
				thermalIter: [60, 100],
				talusAngle: [35, 52],
				hydroDrops: [3000, 6000],
				peakRounds: [10, 18],
			},
		},
		layers: [
			{
				materialId: "yfgm_sandysoil",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.5, minFalloff: 0.05, maxFalloff: 0.1 } },
				],
			},
			{
				materialId: "yfgm_dry01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.1, max: 0.6, minFalloff: 0.05, maxFalloff: 0.1 } },
				],
			},
			{
				materialId: "yfgm_dry02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 15, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_salt",
				tileSize: 4,
				roughness: 1.0,
				normalIntensity: 0.8,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.15, minFalloff: 0.02, maxFalloff: 0.03 } },
				],
			},
		],
	water: { enabled: false },
	},

	// 3. Open World Mountains
	{
		id: "openworld_mountains",
		name: "Open World Mountains",
		icon: "\u{1F3D4}\uFE0F",
		description: "Classic alpine peaks with snow caps and erosion",
		genre: ["openworld", "rpg"],
		environment: "alpine",
		biomeId: "alpine",
		terrain: {
			width: 400,
			depth: 400,
			segments: 384,
			biome: {
				heightScale: [50, 80],
				continentalGamma: [1.2, 1.6],
				continentalFreq: 0.8,
				ridgeFreq: [2.5, 3.5],
				ridgePower: [1.5, 2.2],
				ridgeSharpness: [1, 1.5],
				plateauSteepness: [2.5, 3.5],
				hillsAmp: [0.06, 0.1],
				detailAmp: [0.02, 0.04],
				warpStrength: [0.45, 0.65],
				thermalIter: [150, 220],
				talusAngle: [15, 20],
				hydroDrops: [20000, 35000],
				peakRounds: [4, 7],
			},
		},
		layers: [
			{
				materialId: "yfgm_ground02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.2, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_grass01",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.03, max: 0.35, minFalloff: 0.02, maxFalloff: 0.05 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 30, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_groundstones02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 25, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_frozengrass",
				tileSize: 4,
				roughness: 0.7,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.72, max: 1.0, minFalloff: 0.1, maxFalloff: 0.02 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 45, minFalloff: 5, maxFalloff: 10 } },
				],
			},
		],
	water: { enabled: true, waterPreset: "ocean", waterLevelFraction: 0.20 },
	},

	// 4. Open World Forest
	{
		id: "openworld_forest",
		name: "Open World Forest",
		icon: "\u{1F332}",
		description: "Moderate rolling hills with dense forest floor",
		genre: ["openworld", "rpg", "survival"],
		environment: "forest",
		biomeId: "rolling_hills",
		terrain: {
			width: 300,
			depth: 300,
			segments: 128,
			biome: {
				heightScale: [12, 22],
				continentalGamma: [1, 1.3],
				continentalFreq: 0.6,
				ridgeFreq: [1.5, 2.5],
				ridgePower: [0.8, 1.2],
				ridgeSharpness: [0.6, 1],
				plateauSteepness: [1.5, 2.5],
				hillsAmp: [0.1, 0.18],
				detailAmp: [0.03, 0.06],
				warpStrength: [0.35, 0.55],
				thermalIter: [80, 130],
				talusAngle: [23, 35],
				hydroDrops: [8000, 15000],
				peakRounds: [6, 10],
			},
		},
		layers: [
			{
				materialId: "yfgm_grassleafs02",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.3, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_grass06",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.05, max: 0.5, minFalloff: 0.02, maxFalloff: 0.05 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 30, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_mossstones",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 25, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_soilweeds",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.5, max: 0.8, minFalloff: 0.05, maxFalloff: 0.05 } },
				],
			},
		],
	water: { enabled: true, waterPreset: "river", waterLevelFraction: 0.08 },
	},

	// 5. Racing Terrain
	{
		id: "racing_terrain",
		name: "Racing Terrain",
		icon: "\u{1F3CE}\uFE0F",
		description: "Ultra-smooth gentle curves for racing tracks",
		genre: ["racing"],
		environment: "plains",
		biomeId: "racing_smooth",
		terrain: {
			width: 500,
			depth: 200,
			segments: 128,
			biome: {
				heightScale: [8, 18],
				continentalGamma: [0.9, 1.2],
				continentalFreq: 0.4,
				ridgeFreq: [1.2, 2],
				ridgePower: [0.3, 0.7],
				ridgeSharpness: [0.4, 0.7],
				plateauSteepness: [1.5, 2.5],
				hillsAmp: [0.12, 0.2],
				detailAmp: [0.01, 0.03],
				warpStrength: [0.2, 0.4],
				thermalIter: [100, 180],
				talusAngle: [30, 46],
				hydroDrops: [8000, 15000],
				peakRounds: [8, 14],
			},
		},
		layers: [
			{
				materialId: "yfgm_grass03",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.6, minFalloff: 0.05, maxFalloff: 0.1 } },
				],
			},
			{
				materialId: "yfgm_soilgravel02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 10, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_sandysoil",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.2, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_clay",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 20, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
		],
	water: { enabled: false },
	},

	// 6. Strategy Map
	{
		id: "strategy_map",
		name: "Strategy Map",
		icon: "\u265F\uFE0F",
		description: "Gentle terrain with strategic plateaus and chokepoints",
		genre: ["strategy"],
		environment: "plains",
		biomeId: "strategy_overview",
		terrain: {
			width: 300,
			depth: 300,
			segments: 128,
			biome: {
				heightScale: [6, 14],
				continentalGamma: [0.7, 1],
				continentalFreq: 0.5,
				ridgeFreq: [1.5, 2.5],
				ridgePower: [0.4, 0.8],
				ridgeSharpness: [0.5, 0.9],
				plateauSteepness: [1.5, 2.5],
				hillsAmp: [0.12, 0.22],
				detailAmp: [0.03, 0.06],
				warpStrength: [0.25, 0.45],
				thermalIter: [80, 130],
				talusAngle: [30, 40],
				hydroDrops: [5000, 12000],
				peakRounds: [6, 12],
			},
		},
		layers: [
			{
				materialId: "yfgm_grass04",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.4, minFalloff: 0.02, maxFalloff: 0.05 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 25, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_groundstones01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.2, max: 0.6, minFalloff: 0.05, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_soilgravel01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 20, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_grass05",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.5, max: 0.9, minFalloff: 0.05, maxFalloff: 0.02 } },
				],
			},
		],
	water: { enabled: true, waterPreset: "ocean", waterLevelFraction: 0.15 },
	},

	// 7. Survival Wilderness
	{
		id: "survival_wilderness",
		name: "Survival Wilderness",
		icon: "\u{1F3D5}\uFE0F",
		description: "Varied terrain with dense undergrowth and rocky outcrops",
		genre: ["survival"],
		environment: "forest",
		biomeId: "survival_wilderness",
		terrain: {
			width: 300,
			depth: 300,
			segments: 128,
			biome: {
				heightScale: [18, 35],
				continentalGamma: [1.1, 1.5],
				continentalFreq: 0.6,
				ridgeFreq: [2, 3],
				ridgePower: [1, 1.6],
				ridgeSharpness: [0.7, 1.2],
				plateauSteepness: [2, 3],
				hillsAmp: [0.1, 0.16],
				detailAmp: [0.04, 0.07],
				warpStrength: [0.4, 0.6],
				thermalIter: [100, 170],
				talusAngle: [23, 35],
				hydroDrops: [10000, 20000],
				peakRounds: [5, 9],
			},
		},
		layers: [
			{
				materialId: "yfgm_grassleafs01",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.4, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_grass02",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.1, max: 0.5, minFalloff: 0.02, maxFalloff: 0.05 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 30, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_mossstones",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 25, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_ground01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.15, minFalloff: 0.02, maxFalloff: 0.03 } },
				],
			},
		],
	water: { enabled: true, waterPreset: "river", waterLevelFraction: 0.10 },
	},

	// 8. Battle Arena
	{
		id: "battle_arena",
		name: "Battle Arena",
		icon: "\u{1F3DF}\uFE0F",
		description: "Compact arena with a gentle central mound",
		genre: ["arena", "platformer"],
		environment: "plains",
		biomeId: "arena_flat",
		terrain: {
			width: 150,
			depth: 150,
			segments: 128,
			biome: {
				heightScale: [2, 5],
				continentalGamma: [0.4, 0.7],
				continentalFreq: 0.3,
				ridgeFreq: [0.3, 0.6],
				ridgePower: [0.1, 0.2],
				ridgeSharpness: [0.2, 0.4],
				plateauSteepness: [0.5, 1],
				hillsAmp: [0.03, 0.08],
				detailAmp: [0.01, 0.02],
				warpStrength: [0.05, 0.15],
				thermalIter: [80, 120],
				talusAngle: [35, 52],
				hydroDrops: [4000, 8000],
				peakRounds: [12, 18],
			},
		},
		layers: [
			{
				materialId: "yfgm_grass01",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.5, minFalloff: 0.05, maxFalloff: 0.1 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 30, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_soilgravel04",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 15, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_ground02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.2, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_soilgravel03",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.4, max: 1.0, minFalloff: 0.1, maxFalloff: 0.02 } },
				],
			},
		],
	water: { enabled: false },
	},

	// 9. Desert Wasteland
	{
		id: "desert_wasteland",
		name: "Desert Wasteland",
		icon: "\u{1FAA8}",
		description: "Dramatic mesa plateaus and arid canyons",
		genre: ["openworld", "survival"],
		environment: "desert",
		biomeId: "desert_mesa",
		terrain: {
			width: 400,
			depth: 400,
			segments: 384,
			biome: {
				heightScale: [25, 45],
				continentalGamma: [2, 2.8],
				continentalFreq: 0.7,
				ridgeFreq: [2, 3],
				ridgePower: [0.5, 1],
				ridgeSharpness: [0.3, 0.8],
				plateauSteepness: [5, 8],
				hillsAmp: [0.03, 0.06],
				detailAmp: [0.01, 0.02],
				warpStrength: [0.25, 0.4],
				thermalIter: [200, 350],
				talusAngle: [12, 17],
				hydroDrops: [5000, 10000],
				peakRounds: [8, 14],
			},
		},
		layers: [
			{
				materialId: "yfgm_sandysoil",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.3, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_dry01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.1, max: 0.5, minFalloff: 0.05, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_dry02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 20, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_salt",
				tileSize: 4,
				roughness: 1.0,
				normalIntensity: 0.8,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.7, max: 1.0, minFalloff: 0.1, maxFalloff: 0.02 } },
				],
			},
		],
	water: { enabled: false },
	},

	// 10. Tropical Paradise
	{
		id: "tropical_paradise",
		name: "Tropical Paradise",
		icon: "\u{1F334}",
		description: "Lush island terrain with mossy slopes",
		genre: ["openworld", "survival"],
		environment: "tropical",
		biomeId: "rolling_hills",
		terrain: {
			width: 300,
			depth: 300,
			segments: 128,
			biome: {
				heightScale: [25, 40],
				continentalGamma: [1.2, 1.5],
				continentalFreq: 0.6,
				ridgeFreq: [2, 3],
				ridgePower: [1.0, 1.5],
				ridgeSharpness: [0.8, 1.3],
				plateauSteepness: [2, 3],
				hillsAmp: [0.14, 0.22],
				detailAmp: [0.04, 0.08],
				warpStrength: [0.5, 0.7],
				thermalIter: [50, 90],
				talusAngle: [30, 42],
				hydroDrops: [8000, 15000],
				peakRounds: [5, 8],
			},
		},
		layers: [
			{
				materialId: "yfgm_soilmoss",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.3, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_grass06",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.05, max: 0.5, minFalloff: 0.02, maxFalloff: 0.05 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 30, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_mossstones",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 30, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_sandysoil",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.1, minFalloff: 0.02, maxFalloff: 0.02 } },
				],
			},
		],
	water: { enabled: true, waterPreset: "tropical", waterLevelFraction: 0.10 },
	},

	// 11. Arctic Expedition
	{
		id: "arctic_expedition",
		name: "Arctic Expedition",
		icon: "\u2744\uFE0F",
		description: "Flat snowy tundra with icy ridges",
		genre: ["openworld", "survival"],
		environment: "tundra",
		biomeId: "tundra",
		terrain: {
			width: 300,
			depth: 300,
			segments: 128,
			biome: {
				heightScale: [5, 12],
				continentalGamma: [0.8, 1.1],
				continentalFreq: 0.5,
				ridgeFreq: [1, 2],
				ridgePower: [0.3, 0.8],
				ridgeSharpness: [0.4, 0.8],
				plateauSteepness: [1, 2],
				hillsAmp: [0.15, 0.25],
				detailAmp: [0.05, 0.1],
				warpStrength: [0.3, 0.5],
				thermalIter: [60, 100],
				talusAngle: [30, 46],
				hydroDrops: [3000, 8000],
				peakRounds: [8, 15],
			},
		},
		layers: [
			{
				materialId: "yfgm_clay",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.2, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_frozengrass",
				tileSize: 4,
				roughness: 0.7,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.05, max: 0.5, minFalloff: 0.02, maxFalloff: 0.05 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 25, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_soilgravel04",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 20, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_salt",
				tileSize: 4,
				roughness: 1.0,
				normalIntensity: 0.8,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.6, max: 1.0, minFalloff: 0.1, maxFalloff: 0.02 } },
				],
			},
		],
	water: { enabled: true, waterPreset: "frozen", waterLevelFraction: 0.08 },
	},

	// 12. Volcanic Hellscape
	{
		id: "volcanic_hellscape",
		name: "Volcanic Hellscape",
		icon: "\u{1F30B}",
		description: "Dramatic volcanic peaks with lava-scarred ground",
		genre: ["openworld"],
		environment: "volcanic",
		biomeId: "volcanic",
		terrain: {
			width: 300,
			depth: 300,
			segments: 128,
			biome: {
				heightScale: [55, 90],
				continentalGamma: [1.8, 2.5],
				continentalFreq: 0.5,
				ridgeFreq: [1.8, 2.8],
				ridgePower: [2, 3],
				ridgeSharpness: [1.5, 2.5],
				plateauSteepness: [2, 3],
				hillsAmp: [0.04, 0.08],
				detailAmp: [0.03, 0.06],
				warpStrength: [0.5, 0.7],
				thermalIter: [100, 160],
				talusAngle: [17, 30],
				hydroDrops: [15000, 25000],
				peakRounds: [3, 5],
			},
		},
		layers: [
			{
				materialId: "yfgm_burnt",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.25, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_ground01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.1, max: 0.5, minFalloff: 0.05, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_soilgravel03",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 25, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_mars",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.6, max: 1.0, minFalloff: 0.1, maxFalloff: 0.02 } },
				],
			},
		],
	water: { enabled: true, waterPreset: "lava", waterLevelFraction: 0.10 },
	},

	// 13. Coastal Shores
	{
		id: "coastal_shores",
		name: "Coastal Shores",
		icon: "\u{1F3DD}\uFE0F",
		description: "Gentle terrain with sandy beach edges",
		genre: ["openworld"],
		environment: "coastal",
		biomeId: "coastal",
		terrain: {
			width: 350,
			depth: 350,
			segments: 128,
			biome: {
				heightScale: [8, 16],
				continentalGamma: [0.8, 1.2],
				continentalFreq: 1,
				ridgeFreq: [3, 4.5],
				ridgePower: [1, 1.5],
				ridgeSharpness: [0.8, 1.3],
				plateauSteepness: [2, 3],
				hillsAmp: [0.12, 0.2],
				detailAmp: [0.04, 0.08],
				warpStrength: [0.6, 0.8],
				thermalIter: [50, 90],
				talusAngle: [30, 40],
				hydroDrops: [5000, 12000],
				peakRounds: [5, 8],
			},
		},
		layers: [
			{
				materialId: "yfgm_sandysoil",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.15, minFalloff: 0.02, maxFalloff: 0.03 } },
				],
			},
			{
				materialId: "yfgm_grass01",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.1, max: 0.5, minFalloff: 0.02, maxFalloff: 0.05 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 30, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_groundstones01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 25, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_soilgravel02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.5, max: 0.8, minFalloff: 0.05, maxFalloff: 0.05 } },
				],
			},
		],
	water: { enabled: true, waterPreset: "ocean", waterLevelAbsolute: 0 },
	},

	// 14. Alien World
	{
		id: "alien_world",
		name: "Alien World",
		icon: "\u{1F47D}",
		description: "Otherworldly terrain with unusual formations",
		genre: ["openworld"],
		environment: "alien",
		biomeId: "badlands",
		terrain: {
			width: 300,
			depth: 300,
			segments: 128,
			biome: {
				heightScale: [30, 60],
				continentalGamma: [1.5, 2.5],
				continentalFreq: 0.9,
				ridgeFreq: [3, 5],
				ridgePower: [2, 3.5],
				ridgeSharpness: [2, 3.5],
				plateauSteepness: [3, 5],
				hillsAmp: [0.05, 0.1],
				detailAmp: [0.04, 0.08],
				warpStrength: [0.6, 0.85],
				thermalIter: [60, 100],
				talusAngle: [15, 25],
				hydroDrops: [20000, 40000],
				peakRounds: [2, 5],
			},
		},
		layers: [
			{
				materialId: "yfgm_mars",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.4, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_lava",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.1, minFalloff: 0.02, maxFalloff: 0.02 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 15, minFalloff: 3, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_burnt",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.15, max: 0.6, minFalloff: 0.05, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_ground01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 30, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
		],
	water: { enabled: true, waterPreset: "swamp", waterLevelFraction: 0.12 },
	},

	// 15. Platformer Hills
	{
		id: "platformer_hills",
		name: "Platformer Hills",
		icon: "\u{1F3AF}",
		description: "Gentle rolling hills with flat plateau areas for jumping",
		genre: ["platformer"],
		environment: "alpine",
		biomeId: "platformer_varied",
		terrain: {
			width: 200,
			depth: 200,
			segments: 128,
			biome: {
				heightScale: [4, 10],
				continentalGamma: [0.8, 1.2],
				continentalFreq: 0.6,
				ridgeFreq: [0.5, 1.2],
				ridgePower: [0.2, 0.5],
				ridgeSharpness: [0.3, 0.7],
				plateauSteepness: [3, 5],
				hillsAmp: [0.12, 0.22],
				detailAmp: [0.02, 0.04],
				warpStrength: [0.1, 0.25],
				thermalIter: [120, 200],
				talusAngle: [30, 46],
				hydroDrops: [8000, 15000],
				peakRounds: [8, 14],
			},
		},
		layers: [
			{
				materialId: "yfgm_grass01",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.4, minFalloff: 0.02, maxFalloff: 0.05 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 25, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_ground02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.2, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_groundstones02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 25, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_frozengrass",
				tileSize: 4,
				roughness: 0.7,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.7, max: 1.0, minFalloff: 0.1, maxFalloff: 0.02 } },
				],
			},
		],
	water: { enabled: false },
	},

	// 16. FPS Tactical
	{
		id: "fps_tactical",
		name: "FPS Tactical",
		icon: "\u{1F52B}",
		description: "Flat terrain with mild hills for cover and sightlines",
		genre: ["fps", "arena"],
		environment: "plains",
		biomeId: "fps_tactical",
		terrain: {
			width: 300,
			depth: 300,
			segments: 128,
			biome: {
				heightScale: [15, 30],
				continentalGamma: [1.2, 1.6],
				continentalFreq: 0.7,
				ridgeFreq: [2, 3],
				ridgePower: [1, 1.8],
				ridgeSharpness: [0.8, 1.3],
				plateauSteepness: [2, 3.5],
				hillsAmp: [0.08, 0.14],
				detailAmp: [0.03, 0.05],
				warpStrength: [0.35, 0.55],
				thermalIter: [120, 200],
				talusAngle: [20, 30],
				hydroDrops: [12000, 22000],
				peakRounds: [5, 9],
			},
		},
		layers: [
			{
				materialId: "yfgm_grass03",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.4, minFalloff: 0.02, maxFalloff: 0.05 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 25, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_soilgravel02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 10, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_ground01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.15, minFalloff: 0.02, maxFalloff: 0.03 } },
				],
			},
			{
				materialId: "yfgm_groundstones01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.5, max: 1.0, minFalloff: 0.1, maxFalloff: 0.02 } },
				],
			},
		],
	water: { enabled: false },
	},

	// 17. Tower Defense
	{
		id: "tower_defense",
		name: "Tower Defense",
		icon: "\u{1F3F0}",
		description: "Nearly flat terrain with gentle features for tower placement",
		genre: ["towerdefense", "strategy"],
		environment: "plains",
		biomeId: "strategy_overview",
		terrain: {
			width: 300,
			depth: 300,
			segments: 128,
			biome: {
				heightScale: [2, 6],
				continentalGamma: [0.5, 0.8],
				continentalFreq: 0.4,
				ridgeFreq: [0.5, 1],
				ridgePower: [0.1, 0.3],
				ridgeSharpness: [0.2, 0.5],
				plateauSteepness: [1, 2],
				hillsAmp: [0.05, 0.1],
				detailAmp: [0.01, 0.03],
				warpStrength: [0.08, 0.2],
				thermalIter: [80, 120],
				talusAngle: [35, 52],
				hydroDrops: [4000, 8000],
				peakRounds: [10, 16],
			},
		},
		layers: [
			{
				materialId: "yfgm_grass04",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.5, minFalloff: 0.05, maxFalloff: 0.1 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 30, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_soilgravel01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 15, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_ground02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.15, minFalloff: 0.02, maxFalloff: 0.03 } },
				],
			},
			{
				materialId: "yfgm_grassleafs01",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.3, max: 0.8, minFalloff: 0.05, maxFalloff: 0.05 } },
				],
			},
		],
	water: { enabled: false },
	},

	// 18. Sports Field
	{
		id: "sports_field",
		name: "Sports Field",
		icon: "\u26BD",
		description: "Ultra-flat grass field for sports and casual games",
		genre: ["sports", "arena"],
		environment: "plains",
		biomeId: "runner_flat",
		terrain: {
			width: 200,
			depth: 150,
			segments: 128,
			biome: {
				heightScale: [0.5, 2],
				continentalGamma: [0.3, 0.5],
				continentalFreq: 0.2,
				ridgeFreq: [0.2, 0.5],
				ridgePower: [0.05, 0.15],
				ridgeSharpness: [0.1, 0.3],
				plateauSteepness: [0.5, 1],
				hillsAmp: [0.02, 0.05],
				detailAmp: [0.005, 0.01],
				warpStrength: [0.03, 0.1],
				thermalIter: [50, 80],
				talusAngle: [40, 55],
				hydroDrops: [2000, 4000],
				peakRounds: [15, 25],
			},
		},
		layers: [
			{
				materialId: "yfgm_grass06",
				tileSize: 3,
				roughness: 0.75,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.6, minFalloff: 0.05, maxFalloff: 0.1 } },
				],
			},
			{
				materialId: "yfgm_grass02",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.1, max: 0.5, minFalloff: 0.05, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_ground02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.1, minFalloff: 0.02, maxFalloff: 0.03 } },
				],
			},
			{
				materialId: "yfgm_soilgravel02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 15, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
		],
	water: { enabled: false },
	},

	// 19. FPS Desert
	{
		id: "fps_desert",
		name: "FPS Desert",
		icon: "\u{1F3DC}\uFE0F",
		description: "Flat desert terrain with low dunes for FPS combat",
		genre: ["fps", "survival"],
		environment: "desert",
		biomeId: "fps_tactical",
		terrain: {
			width: 300,
			depth: 300,
			segments: 128,
			biome: {
				heightScale: [8, 18],
				continentalGamma: [1, 1.5],
				continentalFreq: 0.5,
				ridgeFreq: [1.5, 2.5],
				ridgePower: [0.5, 1],
				ridgeSharpness: [0.4, 0.8],
				plateauSteepness: [2, 3.5],
				hillsAmp: [0.06, 0.12],
				detailAmp: [0.02, 0.04],
				warpStrength: [0.2, 0.4],
				thermalIter: [150, 250],
				talusAngle: [18, 28],
				hydroDrops: [6000, 12000],
				peakRounds: [6, 10],
			},
		},
		layers: [
			{
				materialId: "yfgm_sandysoil",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.4, minFalloff: 0.02, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_dry01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.1, max: 0.5, minFalloff: 0.05, maxFalloff: 0.05 } },
				],
			},
			{
				materialId: "yfgm_clay",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 15, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_soilgravel03",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.5, max: 1.0, minFalloff: 0.1, maxFalloff: 0.02 } },
				],
			},
		],
	water: { enabled: false },
	},

	// 20. RPG Meadow
	{
		id: "rpg_meadow",
		name: "RPG Meadow",
		icon: "\u2694\uFE0F",
		description: "Gentle rolling meadow with paths for RPG exploration",
		genre: ["rpg", "openworld"],
		environment: "plains",
		biomeId: "rolling_hills",
		terrain: {
			width: 400,
			depth: 400,
			segments: 384,
			biome: {
				heightScale: [12, 22],
				continentalGamma: [1, 1.3],
				continentalFreq: 0.6,
				ridgeFreq: [1.5, 2.5],
				ridgePower: [0.8, 1.2],
				ridgeSharpness: [0.6, 1],
				plateauSteepness: [1.5, 2.5],
				hillsAmp: [0.1, 0.18],
				detailAmp: [0.03, 0.06],
				warpStrength: [0.35, 0.55],
				thermalIter: [80, 130],
				talusAngle: [23, 35],
				hydroDrops: [8000, 15000],
				peakRounds: [6, 10],
			},
		},
		layers: [
			{
				materialId: "yfgm_grass05",
				tileSize: 4,
				roughness: 0.8,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.4, minFalloff: 0.02, maxFalloff: 0.05 } },
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 25, minFalloff: 5, maxFalloff: 10 } },
				],
			},
			{
				materialId: "yfgm_soilmoss",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 10, maxAngle: 90, minFalloff: 5, maxFalloff: 5 } },
				],
			},
			{
				materialId: "yfgm_ground02",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.15, minFalloff: 0.02, maxFalloff: 0.03 } },
				],
			},
			{
				materialId: "yfgm_groundstones01",
				tileSize: 4,
				roughness: 0.85,
				normalIntensity: 1.0,
				modifiers: [
					{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.6, max: 1.0, minFalloff: 0.1, maxFalloff: 0.02 } },
				],
			},
		],
	water: { enabled: true, waterPreset: "clear-pool", waterLevelFraction: 0.10 },
	},
];

// ===== Filter helper =====

export function filterPresets(genre: string, environment: string): TerrainPreset[] {
	return TERRAIN_PRESETS.filter((p) => {
		if (genre !== "all" && !p.genre.includes(genre)) return false;
		if (environment !== "all" && p.environment !== environment) return false;
		return true;
	});
}
