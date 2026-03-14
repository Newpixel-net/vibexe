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
		description: "Dense woodland with trees on flat areas, bushes on slopes, flowers in valleys",
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
						keywords: ["garden", "sign", "pillar"],
						categories: ["environment", "decorations"],
						minimumDistance: 14,
						minScale: 0.8,
						maxScale: 1.4,
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
						keywords: ["sign", "barrel", "crate"],
						categories: ["decorations", "environment"],
						minimumDistance: 10,
						minScale: 0.6,
						maxScale: 1.0,
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
						keywords: ["pillar", "spikes", "platform"],
						categories: ["environment", "decorations"],
						minimumDistance: 12,
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
		description: "Sparse cacti and rocks scattered across dunes, with brush in sheltered areas",
		layers: [
			{
				name: "Cacti & Joshua Trees",
				autoRules: [
					{ source: "slope", invert: true, inputMin: 0, inputMax: 0.2, blendMode: "multiply", enabled: true },
					{ source: "noise", invert: false, inputMin: 0.4, inputMax: 1.0, blendMode: "multiply", enabled: true },
				],
				minThreshold: 0.5,
				maxThreshold: 1.0,
				treeSlots: [
					{
						role: "cactus",
						keywords: ["pillar", "sign", "garden"],
						categories: ["environment", "decorations"],
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
						keywords: ["spikes", "platform", "pillar"],
						categories: ["environment", "decorations", "hazards"],
						minimumDistance: 12,
						minScale: 0.4,
						maxScale: 2.0,
					},
				],
				detailSlots: [],
			},
		],
	},

	{
		id: "alpine",
		name: "Alpine",
		description: "Pine trees below treeline, bare rock and snow above, meadow flowers in between",
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
						keywords: ["garden", "pillar", "sign"],
						categories: ["environment", "decorations"],
						minimumDistance: 12,
						minScale: 0.7,
						maxScale: 1.3,
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
						role: "meadow props",
						keywords: ["coin", "star", "heart"],
						categories: ["collectibles", "decorations"],
						minimumDistance: 10,
						minScale: 0.6,
						maxScale: 0.9,
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
						keywords: ["spikes", "platform", "pillar"],
						categories: ["environment", "decorations", "hazards"],
						minimumDistance: 14,
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
		description: "Dense palm trees near water, lush vegetation on flat areas, rocks on slopes",
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
						keywords: ["garden", "pillar", "sign"],
						categories: ["environment", "decorations"],
						minimumDistance: 12,
						minScale: 0.8,
						maxScale: 1.3,
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
						keywords: ["barrel", "crate", "sign"],
						categories: ["decorations", "environment"],
						minimumDistance: 10,
						minScale: 0.5,
						maxScale: 1.0,
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
						keywords: ["pillar", "garden", "sign"],
						categories: ["environment", "decorations"],
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
						keywords: ["sign", "barrel", "crate"],
						categories: ["decorations", "environment"],
						minimumDistance: 8,
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
						role: "city tree",
						keywords: ["garden", "sign", "pillar"],
						categories: ["environment", "decorations"],
						minimumDistance: 12,
						minScale: 0.7,
						maxScale: 1.1,
					},
				],
				detailSlots: [],
			},
		],
	},

	{
		id: "platformer",
		name: "Platformer World",
		description: "Game-focused: platforms at various heights, collectibles in accessible areas, hazards on edges",
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
						keywords: ["platform", "grid_platform", "long_platform"],
						categories: ["environment", "decorations"],
						minimumDistance: 8,
						minScale: 0.8,
						maxScale: 1.2,
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
						role: "collectible",
						keywords: ["coin", "star", "heart"],
						categories: ["collectibles", "decorations"],
						minimumDistance: 10,
						minScale: 0.6,
						maxScale: 0.9,
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
						role: "decoration",
						keywords: ["sign", "barrel", "crate"],
						categories: ["decorations", "environment"],
						minimumDistance: 10,
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
