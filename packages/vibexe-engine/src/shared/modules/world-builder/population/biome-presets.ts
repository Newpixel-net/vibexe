/**
 * BiomePresets — Pre-built population blueprints for common biome types
 *
 * AI agents use these as starting points. Each preset defines layers with
 * auto-heatmap rules that derive placement from terrain analysis data.
 *
 * The rules are designed so that:
 * - Trees go on flat-to-moderate slopes (avoids cliffs)
 * - Grass/details go in valleys and gentle slopes
 * - Rocks go on steep slopes and ridges
 * - Special features (flowers, mushrooms) go in specific micro-environments
 */

import type {
	PopulationLayer,
	AutoHeatmapRule,
	TreePopulationEntry,
	DetailPopulationEntry,
} from "./population-types";

// ===== Preset Types =====

export interface BiomePreset {
	/** Preset identifier */
	id: string;
	/** Display name */
	name: string;
	/** Description shown in UI */
	description: string;
	/** Layer templates (no asset IDs — those are resolved at runtime) */
	layers: PresetLayerTemplate[];
}

export interface PresetLayerTemplate {
	name: string;
	autoRules: Omit<AutoHeatmapRule, "id">[];
	minThreshold: number;
	maxThreshold: number;
	/** Tree slot descriptors (resolved to actual assets at runtime) */
	treeSlots: PresetAssetSlot[];
	/** Detail slot descriptors */
	detailSlots: PresetAssetSlot[];
}

export interface PresetAssetSlot {
	/** Descriptive name for the slot (e.g., "large tree", "ground cover") */
	role: string;
	/** Asset search keywords */
	keywords: string[];
	/** Preferred asset categories */
	categories: string[];
	/** Default minimum Poisson distance */
	minimumDistance: number;
	/** For trees: scale range */
	minScale?: number;
	maxScale?: number;
	/** For details: cluster settings */
	clusterRadius?: number;
	clusterAmount?: number;
	scale?: number;
}

// ===== Preset Definitions =====

export const BIOME_PRESETS: BiomePreset[] = [
	{
		id: "forest",
		name: "Forest",
		description: "Dense woodland with vegetation on flat areas, bushes on slopes, rocks on ridges",
		layers: [
			{
				name: "Canopy Trees",
				autoRules: [
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.35, blendMode: "multiply", enabled: true },
					{ source: "height", invert: false, inputMin: 0.1, inputMax: 0.7, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.4,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "large tree",
						keywords: ["garden"],
						categories: ["decorations"],
						minimumDistance: 12,
						minScale: 1.0,
						maxScale: 1.8,
					},
					{
						role: "tree trunk",
						keywords: ["pillar 2x2"],
						categories: ["decorations"],
						minimumDistance: 16,
						minScale: 0.6,
						maxScale: 1.0,
					},
				],
				detailSlots: [],
			},
			{
				name: "Undergrowth",
				autoRules: [
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.25, blendMode: "multiply", enabled: true },
					{ source: "noise", invert: false, inputMin: 0.3, inputMax: 0.8, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.3,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "bush",
						keywords: ["bush"],
						categories: ["decorations"],
						minimumDistance: 6,
						minScale: 0.6,
						maxScale: 1.2,
					},
					{
						role: "fallen log",
						keywords: ["wood log"],
						categories: ["resources"],
						minimumDistance: 10,
						minScale: 0.5,
						maxScale: 0.8,
					},
				],
				detailSlots: [],
			},
			{
				name: "Rocky Outcrops",
				autoRules: [
					{ source: "slope", invert: false, inputMin: 0.3, inputMax: 0.8, blendMode: "multiply", enabled: true },
					{ source: "curvature", invert: false, inputMin: 0.55, inputMax: 1.0, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.3,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "rock",
						keywords: ["stone chunks"],
						categories: ["resources"],
						minimumDistance: 10,
						minScale: 0.5,
						maxScale: 1.5,
					},
				],
				detailSlots: [],
			},
		],
	},

	{
		id: "desert",
		name: "Desert",
		description: "Sparse vegetation scattered across dunes, with rocks on ridges",
		layers: [
			{
				name: "Cacti & Vegetation",
				autoRules: [
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.2, blendMode: "multiply", enabled: true },
					{ source: "noise", invert: false, inputMin: 0.4, inputMax: 1.0, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.5,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "cactus",
						keywords: ["garden"],
						categories: ["decorations"],
						minimumDistance: 16,
						minScale: 0.7,
						maxScale: 1.3,
					},
				],
				detailSlots: [],
			},
			{
				name: "Desert Rocks",
				autoRules: [
					{ source: "curvature", invert: false, inputMin: 0.5, inputMax: 1.0, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.3,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "desert rock",
						keywords: ["stone chunks"],
						categories: ["resources"],
						minimumDistance: 10,
						minScale: 0.4,
						maxScale: 2.0,
					},
					{
						role: "small stone",
						keywords: ["stone brick"],
						categories: ["resources"],
						minimumDistance: 8,
						minScale: 0.3,
						maxScale: 0.7,
					},
				],
				detailSlots: [],
			},
		],
	},

	{
		id: "alpine",
		name: "Alpine",
		description: "Trees below treeline, bare rock above, meadow collectibles in between",
		layers: [
			{
				name: "Pine Forest (Low)",
				autoRules: [
					{ source: "height", invert: false, inputMin: 0.05, inputMax: 0.45, blendMode: "multiply", enabled: true },
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.4, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.4,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "pine tree",
						keywords: ["garden"],
						categories: ["decorations"],
						minimumDistance: 10,
						minScale: 0.8,
						maxScale: 1.5,
					},
					{
						role: "tree trunk",
						keywords: ["pillar 1x1"],
						categories: ["decorations"],
						minimumDistance: 14,
						minScale: 0.5,
						maxScale: 0.8,
					},
				],
				detailSlots: [],
			},
			{
				name: "Alpine Meadow (Mid)",
				autoRules: [
					{ source: "height", invert: false, inputMin: 0.35, inputMax: 0.6, blendMode: "multiply", enabled: true },
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.3, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.3,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "meadow flowers",
						keywords: ["coin"],
						categories: ["collectibles"],
						minimumDistance: 6,
						minScale: 0.5,
						maxScale: 0.8,
					},
					{
						role: "meadow star",
						keywords: ["star"],
						categories: ["collectibles"],
						minimumDistance: 8,
						minScale: 0.4,
						maxScale: 0.7,
					},
				],
				detailSlots: [],
			},
			{
				name: "Rocky Peaks (High)",
				autoRules: [
					{ source: "height", invert: false, inputMin: 0.55, inputMax: 1.0, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.3,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "large boulder",
						keywords: ["stone chunks"],
						categories: ["resources"],
						minimumDistance: 12,
						minScale: 0.5,
						maxScale: 2.0,
					},
				],
				detailSlots: [],
			},
		],
	},

	{
		id: "tropical",
		name: "Tropical",
		description: "Dense vegetation near water, lush bushes on flat areas, fallen wood on ground",
		layers: [
			{
				name: "Palm Trees",
				autoRules: [
					{ source: "height", invert: true, inputMin: 0, inputMax: 0.3, blendMode: "multiply", enabled: true },
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.25, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.4,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "palm tree",
						keywords: ["garden"],
						categories: ["decorations"],
						minimumDistance: 10,
						minScale: 1.0,
						maxScale: 1.6,
					},
				],
				detailSlots: [],
			},
			{
				name: "Jungle Floor",
				autoRules: [
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.2, blendMode: "multiply", enabled: true },
					{ source: "noise", invert: false, inputMin: 0.2, inputMax: 0.9, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.3,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "bush",
						keywords: ["bush"],
						categories: ["decorations"],
						minimumDistance: 6,
						minScale: 0.5,
						maxScale: 1.0,
					},
					{
						role: "fallen wood",
						keywords: ["wood log"],
						categories: ["resources"],
						minimumDistance: 8,
						minScale: 0.4,
						maxScale: 0.7,
					},
				],
				detailSlots: [],
			},
		],
	},

	{
		id: "city",
		name: "City / Urban",
		description: "Buildings on flat areas, street props along edges, vegetation in parks",
		layers: [
			{
				name: "Buildings",
				autoRules: [
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.1, blendMode: "multiply", enabled: true },
					{ source: "noise", invert: false, inputMin: 0.3, inputMax: 1.0, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.5,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "building",
						keywords: ["building"],
						categories: ["buildings"],
						minimumDistance: 16,
						minScale: 0.8,
						maxScale: 1.2,
					},
				],
				detailSlots: [],
			},
			{
				name: "Street Props",
				autoRules: [
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.15, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.3,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "street furniture",
						keywords: ["bench"],
						categories: ["decorations"],
						minimumDistance: 8,
						minScale: 0.8,
						maxScale: 1.0,
					},
					{
						role: "street light",
						keywords: ["streetlight"],
						categories: ["decorations"],
						minimumDistance: 12,
						minScale: 0.8,
						maxScale: 1.0,
					},
				],
				detailSlots: [],
			},
			{
				name: "Park Trees",
				autoRules: [
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.15, blendMode: "multiply", enabled: true },
					{ source: "noise", invert: false, inputMin: 0.5, inputMax: 1.0, blendMode: "multiply", enabled: true },
					{ source: "height", invert: true, inputMin: 0, inputMax: 0.4, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.5,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "park bush",
						keywords: ["bush"],
						categories: ["decorations"],
						minimumDistance: 8,
						minScale: 0.7,
						maxScale: 1.1,
					},
					{
						role: "park tree",
						keywords: ["garden"],
						categories: ["decorations"],
						minimumDistance: 12,
						minScale: 0.8,
						maxScale: 1.3,
					},
				],
				detailSlots: [],
			},
		],
	},

	{
		id: "platformer",
		name: "Platformer World",
		description: "Game-focused: platforms, collectibles, and decorations scattered on terrain",
		layers: [
			{
				name: "Platforms",
				autoRules: [
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.2, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.4,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "platform",
						keywords: ["grid platform"],
						categories: ["platforms"],
						minimumDistance: 8,
						minScale: 0.8,
						maxScale: 1.2,
					},
					{
						role: "long platform",
						keywords: ["long platform"],
						categories: ["platforms"],
						minimumDistance: 12,
						minScale: 0.8,
						maxScale: 1.0,
					},
				],
				detailSlots: [],
			},
			{
				name: "Collectibles",
				autoRules: [
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.15, blendMode: "multiply", enabled: true },
					{ source: "noise", invert: false, inputMin: 0.3, inputMax: 0.8, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.3,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "coin",
						keywords: ["coin"],
						categories: ["collectibles"],
						minimumDistance: 5,
						minScale: 0.6,
						maxScale: 0.9,
					},
					{
						role: "star",
						keywords: ["star"],
						categories: ["collectibles"],
						minimumDistance: 10,
						minScale: 0.5,
						maxScale: 0.8,
					},
				],
				detailSlots: [],
			},
			{
				name: "Decorations",
				autoRules: [
					{ source: "noise", invert: false, inputMin: 0.4, inputMax: 1.0, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.4,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "sign",
						keywords: ["sign"],
						categories: ["decorations"],
						minimumDistance: 10,
						minScale: 0.7,
						maxScale: 1.0,
					},
					{
						role: "decoration",
						keywords: ["garden"],
						categories: ["decorations"],
						minimumDistance: 12,
						minScale: 0.7,
						maxScale: 1.0,
					},
				],
				detailSlots: [],
			},
		],
	},
];

/** Get a biome preset by ID */
export function getBiomePreset(id: string): BiomePreset | undefined {
	return BIOME_PRESETS.find((p) => p.id === id);
}

/** Get all available preset IDs */
export function getBiomePresetIds(): string[] {
	return BIOME_PRESETS.map((p) => p.id);
}
