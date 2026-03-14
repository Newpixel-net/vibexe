/**
 * BlueprintResolver — Resolves biome preset asset slots to actual catalog items
 *
 * When a biome preset is applied, its treeSlots/detailSlots contain keywords
 * and categories but no actual model paths. This resolver matches slots against
 * the asset catalog to produce fully-resolved PopulationLayer configurations.
 *
 * Also handles AI-generated WorldPopulationBlueprint resolution.
 */

import {
	type PopulationLayer,
	type TreePopulationEntry,
	type DetailPopulationEntry,
	type AutoHeatmapRule,
	type BiomePreset,
	type PresetAssetSlot,
	DEFAULT_TREE_ENTRY,
	DEFAULT_DETAIL_ENTRY,
	getBiomePreset,
	DENSITY_DISTANCES,
} from "@vibexe-ai/vibexe-engine";
import {
	ASSET_CATALOG,
	searchAssets,
	type AssetLibraryItem,
	type AssetCategory,
} from "./asset-library-data";

// ===== ID Generation =====

let _resolverIdCounter = 1;
function genId(): string {
	return `res_${_resolverIdCounter++}_${Date.now().toString(36)}`;
}

// ===== Asset Slot Resolution =====

/**
 * Find the best matching asset for a preset slot.
 * Searches by keywords and categories, returns the first good match.
 */
function resolveSlot(slot: PresetAssetSlot): AssetLibraryItem | null {
	const candidates: AssetLibraryItem[] = [];

	// Search by each keyword
	for (const kw of slot.keywords) {
		const results = searchAssets(kw);
		for (const r of results) {
			// Filter by preferred categories
			if (slot.categories.length > 0 && !slot.categories.includes(r.category)) continue;
			// Skip animated characters (too heavy for population)
			if (r.isAnimated) continue;
			candidates.push(r);
		}
	}

	if (candidates.length === 0) {
		// Fallback: just search by category
		for (const cat of slot.categories) {
			const catItems = ASSET_CATALOG.filter(
				(i) => i.category === (cat as AssetCategory) && !i.isAnimated,
			);
			if (catItems.length > 0) return catItems[0];
		}
		return null;
	}

	// Prefer shorter names (more generic/likely correct)
	candidates.sort((a, b) => a.displayName.length - b.displayName.length);
	return candidates[0];
}

/**
 * Resolve all asset slots in a biome preset into fully-configured PopulationLayers.
 */
export function resolvePreset(preset: BiomePreset): PopulationLayer[] {
	const layers: PopulationLayer[] = [];

	for (const tpl of preset.layers) {
		const trees: TreePopulationEntry[] = [];
		const details: DetailPopulationEntry[] = [];

		// Resolve tree slots
		for (const slot of tpl.treeSlots) {
			const asset = resolveSlot(slot);
			if (!asset) continue;

			trees.push({
				...DEFAULT_TREE_ENTRY,
				id: genId(),
				assetId: asset.id,
				displayName: asset.displayName,
				modelPath: asset.modelPath,
				packId: asset.packId,
				minimumDistance: slot.minimumDistance,
				minScale: slot.minScale ?? 0.8,
				maxScale: slot.maxScale ?? 1.2,
			});
		}

		// Resolve detail slots
		for (const slot of tpl.detailSlots) {
			const asset = resolveSlot(slot);
			if (!asset) continue;

			details.push({
				...DEFAULT_DETAIL_ENTRY,
				id: genId(),
				assetId: asset.id,
				displayName: asset.displayName,
				modelPath: asset.modelPath,
				packId: asset.packId,
				minimumDistance: slot.minimumDistance,
				clusterRadius: slot.clusterRadius ?? 1.5,
				clusterAmount: slot.clusterAmount ?? 3,
				scale: slot.scale ?? 0.5,
			});
		}

		// Only add layers that have at least one resolved asset
		if (trees.length === 0 && details.length === 0) continue;

		layers.push({
			id: genId(),
			name: tpl.name,
			enabled: true,
			heatmapSource: "auto",
			autoRules: tpl.autoRules.map((r) => ({ ...r, id: genId() })),
			minThreshold: tpl.minThreshold,
			maxThreshold: tpl.maxThreshold,
			additiveMode: false,
			trees,
			details,
		});
	}

	return layers;
}

/**
 * Resolve a biome preset by ID, returning ready-to-use PopulationLayers.
 */
export function resolvePresetById(presetId: string): PopulationLayer[] | null {
	const preset = getBiomePreset(presetId);
	if (!preset) return null;
	return resolvePreset(preset);
}

// ===== AI Blueprint Resolution =====

interface AIBlueprintLayer {
	name: string;
	rule?: string;
	density?: "sparse" | "medium" | "dense" | "very-dense";
	assets?: {
		type?: "tree" | "detail";
		keywords?: string[];
		category?: string;
		assetId?: string;
	}[];
}

interface AIBlueprint {
	biome?: string;
	seed?: number;
	layers?: AIBlueprintLayer[];
}

/** Map natural-language rules to auto-heatmap rules */
function parseRule(rule: string): Omit<AutoHeatmapRule, "id">[] {
	const rules: Omit<AutoHeatmapRule, "id">[] = [];
	const r = rule.toLowerCase();

	if (r.includes("flat") || r.includes("gentle")) {
		rules.push({ source: "slope", invert: true, inputMin: 0, inputMax: 0.25, blendMode: "multiply", enabled: true });
	}
	if (r.includes("steep") || r.includes("cliff")) {
		rules.push({ source: "slope", invert: false, inputMin: 0.3, inputMax: 0.8, blendMode: "multiply", enabled: true });
	}
	if (r.includes("low") || r.includes("valley")) {
		rules.push({ source: "height", invert: true, inputMin: 0, inputMax: 0.4, blendMode: "multiply", enabled: true });
	}
	if (r.includes("high") || r.includes("peak") || r.includes("mountain")) {
		rules.push({ source: "height", invert: false, inputMin: 0.5, inputMax: 1.0, blendMode: "multiply", enabled: true });
	}
	if (r.includes("mid") || r.includes("middle")) {
		rules.push({ source: "height", invert: false, inputMin: 0.3, inputMax: 0.7, blendMode: "multiply", enabled: true });
	}
	if (r.includes("random") || r.includes("scattered")) {
		rules.push({ source: "noise", invert: false, inputMin: 0.3, inputMax: 0.8, blendMode: "multiply", enabled: true });
	}
	if (r.includes("ridge") || r.includes("convex")) {
		rules.push({ source: "curvature", invert: false, inputMin: 0.55, inputMax: 1.0, blendMode: "multiply", enabled: true });
	}

	// Default: flat areas if no rules matched
	if (rules.length === 0) {
		rules.push({ source: "slope", invert: true, inputMin: 0, inputMax: 0.3, blendMode: "multiply", enabled: true });
	}

	return rules;
}

/**
 * Resolve an AI-generated blueprint into PopulationLayers.
 *
 * If the blueprint has a biome hint and no custom layers, use the biome preset.
 * Otherwise, resolve each custom layer by searching assets.
 */
export function resolveBlueprint(blueprint: AIBlueprint): PopulationLayer[] {
	// If biome hint is provided and no custom layers, use preset
	if (blueprint.biome && (!blueprint.layers || blueprint.layers.length === 0)) {
		const preset = getBiomePreset(blueprint.biome);
		if (preset) return resolvePreset(preset);
	}

	if (!blueprint.layers || blueprint.layers.length === 0) return [];

	const layers: PopulationLayer[] = [];

	for (const bpLayer of blueprint.layers) {
		const trees: TreePopulationEntry[] = [];
		const details: DetailPopulationEntry[] = [];
		const density = bpLayer.density || "medium";
		const minDist = DENSITY_DISTANCES[density] ?? 6;

		for (const asset of bpLayer.assets || []) {
			const isDetail = asset.type === "detail";

			// Resolve asset
			let item: AssetLibraryItem | null = null;
			if (asset.assetId) {
				item = ASSET_CATALOG.find((i) => i.id === asset.assetId) ?? null;
			}
			if (!item && asset.keywords) {
				const slot: PresetAssetSlot = {
					role: "",
					keywords: asset.keywords,
					categories: asset.category ? [asset.category] : [],
					minimumDistance: minDist,
				};
				item = resolveSlot(slot);
			}
			if (!item) continue;

			if (isDetail) {
				details.push({
					...DEFAULT_DETAIL_ENTRY,
					id: genId(),
					assetId: item.id,
					displayName: item.displayName,
					modelPath: item.modelPath,
					packId: item.packId,
					minimumDistance: minDist,
				});
			} else {
				trees.push({
					...DEFAULT_TREE_ENTRY,
					id: genId(),
					assetId: item.id,
					displayName: item.displayName,
					modelPath: item.modelPath,
					packId: item.packId,
					minimumDistance: minDist,
				});
			}
		}

		if (trees.length === 0 && details.length === 0) continue;

		const autoRules = bpLayer.rule
			? parseRule(bpLayer.rule)
			: [{ source: "slope" as const, invert: true, inputMin: 0, inputMax: 0.3, blendMode: "multiply" as const, enabled: true }];

		layers.push({
			id: genId(),
			name: bpLayer.name,
			enabled: true,
			heatmapSource: "auto",
			autoRules: autoRules.map((r) => ({ ...r, id: genId() })),
			minThreshold: 0.3,
			maxThreshold: 1.0,
			additiveMode: false,
			trees,
			details,
		});
	}

	return layers;
}
