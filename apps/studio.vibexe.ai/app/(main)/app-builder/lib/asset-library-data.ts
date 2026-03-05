/**
 * Asset Library Data Layer — Transforms PACKS_3D into a flat UI catalog.
 *
 * Provides ~500+ AssetLibraryItems organized by category with search/filter.
 * Used by the Asset Library panel in the scene editor.
 */

import { PACKS_3D } from "@vibexe-ai/vibexe-engine";

// ===== Types =====

export type AssetCategory =
	| "platforms"
	| "characters"
	| "collectibles"
	| "hazards"
	| "decorations"
	| "interactive"
	| "buildings"
	| "resources"
	| "weapons"
	| "environment";

export interface AssetLibraryItem {
	id: string;
	displayName: string;
	category: AssetCategory;
	subcategory: string;
	packId: string;
	filename: string;
	modelPath: string;
	factory: string;
	factoryArgs: Record<string, any>;
	format: "gltf" | "glb";
	hasColorVariants: boolean;
	availableColors: string[];
	isAnimated: boolean;
}

// ===== Category mapping =====

const KAYKIT_COLORS = ["blue", "green", "red", "yellow"];

interface CategoryMapping {
	category: AssetCategory;
	subcategory: string;
	factory: string;
	isAnimated?: boolean;
}

// kaykit-platformer source category → target mapping
const PLATFORMER_MAP: Record<string, CategoryMapping> = {
	platforms_color: { category: "platforms", subcategory: "Standard", factory: "createDecoration3D" },
	platforms_special_color: { category: "platforms", subcategory: "Special", factory: "createDecoration3D" },
	platform_slopes_color: { category: "platforms", subcategory: "Slopes", factory: "createDecoration3D" },
	barriers_color: { category: "hazards", subcategory: "Walls", factory: "createDecoration3D" },
	arches_color: { category: "platforms", subcategory: "Arches", factory: "createDecoration3D" },
	collectibles_color: { category: "collectibles", subcategory: "KayKit", factory: "createDecoration3D" },
	bombs_color: { category: "hazards", subcategory: "Bombs", factory: "createDecoration3D" },
	interactive_color: { category: "interactive", subcategory: "Buttons & Flags", factory: "createDecoration3D" },
	pipes_color: { category: "decorations", subcategory: "Pipes", factory: "createDecoration3D" },
	railings_color: { category: "decorations", subcategory: "Railings", factory: "createDecoration3D" },
	signage_color: { category: "decorations", subcategory: "Signs", factory: "createDecoration3D" },
	levers_color: { category: "interactive", subcategory: "Levers", factory: "createDecoration3D" },
	hoops_color: { category: "interactive", subcategory: "Hoops", factory: "createDecoration3D" },
	bracing_color: { category: "decorations", subcategory: "Bracing", factory: "createDecoration3D" },
	misc_color: { category: "decorations", subcategory: "Misc", factory: "createDecoration3D" },
	// Neutral variants
	neutral_barriers: { category: "hazards", subcategory: "Neutral Walls", factory: "createDecoration3D" },
	neutral_floors: { category: "platforms", subcategory: "Wood Floors", factory: "createDecoration3D" },
	neutral_pillars: { category: "decorations", subcategory: "Pillars", factory: "createDecoration3D" },
	neutral_structures: { category: "decorations", subcategory: "Structures", factory: "createDecoration3D" },
	neutral_struts: { category: "decorations", subcategory: "Struts", factory: "createDecoration3D" },
	neutral_signage: { category: "decorations", subcategory: "Signs", factory: "createDecoration3D" },
	neutral_misc: { category: "decorations", subcategory: "Misc", factory: "createDecoration3D" },
};

// kaykit-city-builder
const CITY_MAP: Record<string, CategoryMapping> = {
	ground: { category: "environment", subcategory: "Ground", factory: "createDecoration3D" },
	buildings: { category: "buildings", subcategory: "Buildings", factory: "createDecoration3D" },
	vehicles: { category: "buildings", subcategory: "Vehicles", factory: "createDecoration3D" },
	roads: { category: "decorations", subcategory: "Roads", factory: "createDecoration3D" },
	streetProps: { category: "decorations", subcategory: "Street Props", factory: "createDecoration3D" },
};

// kaykit-resource-bits
const RESOURCE_SUBCATEGORY: Record<string, string> = {
	copper: "Copper", fuel: "Fuel", gold: "Gold", iron: "Iron",
	pallets: "Pallets", parts: "Parts", silver: "Silver",
	stone: "Stone", textiles: "Textiles", wood: "Wood",
};

// kaykit-skeletons
const SKELETON_MAP: Record<string, CategoryMapping> = {
	characters: { category: "characters", subcategory: "Skeletons", factory: "createAnimatedCharacter3D", isAnimated: true },
	weapons: { category: "weapons", subcategory: "Skeleton", factory: "createDecoration3D" },
	projectiles: { category: "weapons", subcategory: "Skeleton", factory: "createDecoration3D" },
	shields: { category: "weapons", subcategory: "Skeleton", factory: "createDecoration3D" },
};

// platformer-project
const PLATFORMER_PROJECT_MAP: Record<string, CategoryMapping> = {
	characters: { category: "characters", subcategory: "Platformer", factory: "createAnimatedCharacter3D", isAnimated: true },
	platforms: { category: "platforms", subcategory: "Platformer", factory: "createPlatform3D" },
	collectibles: { category: "collectibles", subcategory: "Platformer", factory: "createCollectible3D" },
	hazards: { category: "hazards", subcategory: "Platformer", factory: "createBarrier3D" },
	interactive: { category: "interactive", subcategory: "Platformer", factory: "createDecoration3D" },
	decorations: { category: "decorations", subcategory: "Platformer", factory: "createDecoration3D" },
	special: { category: "decorations", subcategory: "Platformer Special", factory: "createDecoration3D" },
};

// squad-shooter
const SQUAD_MAP: Record<string, CategoryMapping> = {
	player: { category: "characters", subcategory: "Squad Shooter", factory: "createDecoration3D" },
	enemies: { category: "characters", subcategory: "Squad Enemies", factory: "createDecoration3D" },
	weapons: { category: "weapons", subcategory: "Squad Shooter", factory: "createDecoration3D" },
	world_1: { category: "environment", subcategory: "Desert Theme", factory: "createDecoration3D" },
	world_2: { category: "environment", subcategory: "Industrial Theme", factory: "createDecoration3D" },
	misc: { category: "collectibles", subcategory: "Squad Shooter", factory: "createDecoration3D" },
	particles: { category: "decorations", subcategory: "VFX Meshes", factory: "createDecoration3D" },
	animations: { category: "decorations", subcategory: "Chest Anims", factory: "createDecoration3D" },
};

// ===== Helpers =====

function humanize(name: string): string {
	// "platform_4x4x1" → "Platform 4x4x1", "Gold_Bar" → "Gold Bar"
	return name
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.replace(/(\d)x(\d)/g, "$1x$2"); // keep "4x4" lowercase x
}

function buildModelPath(packId: string, sourceCat: string, filename: string, color?: string): string {
	switch (packId) {
		case "kaykit-platformer":
			if (sourceCat.startsWith("neutral_")) {
				return `Assets/gltf/neutral/${filename}.gltf`;
			}
			if (color) {
				return `Assets/gltf/${color}/${filename}_${color}.gltf`;
			}
			return `Assets/gltf/blue/${filename}_blue.gltf`;

		case "kaykit-city-builder":
			return `Assets/gltf/${filename}.gltf`;

		case "kaykit-resource-bits":
			return `Assets/gltf/${filename}.gltf`;

		case "kaykit-skeletons":
			// Items already include extension in the array
			return filename;

		case "platformer-project":
			if (sourceCat === "characters") return `characters/${filename}.glb`;
			return `objects/${filename}.glb`;

		case "squad-shooter": {
			// Category-based path mapping
			const catPathMap: Record<string, string> = {
				player: "characters/player",
				enemies: "characters/enemies",
				weapons: "weapons",
				world_1: "environment/world_1",
				world_2: "environment/world_2",
				misc: "misc",
				particles: "particles",
				animations: "animations",
			};
			const prefix = catPathMap[sourceCat] || sourceCat;
			return `${prefix}/${filename}.glb`;
		}

		default:
			return filename;
	}
}

function buildFactoryArgs(
	item: AssetLibraryItem,
	packId: string,
	sourceCat: string,
	filename: string,
	factory: string,
): Record<string, any> {
	// platformer-project uses specific factory helpers
	if (packId === "platformer-project") {
		switch (factory) {
			case "createPlatform3D":
				return { variant: filename, type: filename };
			case "createCollectible3D":
				return { type: filename };
			case "createBarrier3D":
				return { type: filename };
			case "createAnimatedCharacter3D":
				return { url: `__MODEL_URL__platformer-project__characters/${filename}.glb` };
			case "createDecoration3D":
				return {
					type: filename,
					_pack: "platformer-project",
					_path: `objects/${filename}.glb`,
				};
		}
	}

	// kaykit-skeletons animated characters
	if (packId === "kaykit-skeletons" && factory === "createAnimatedCharacter3D") {
		return { url: `__MODEL_URL__kaykit-skeletons__${filename}` };
	}

	// meshy animated characters
	if (packId === "meshy-characters") {
		return { url: `__MODEL_URL__meshy-characters__${filename}.glb` };
	}

	// squad-shooter uses createDecoration3D with _pack/_path
	if (packId === "squad-shooter") {
		const catPathMap: Record<string, string> = {
			player: "characters/player",
			enemies: "characters/enemies",
			weapons: "weapons",
			world_1: "environment/world_1",
			world_2: "environment/world_2",
			misc: "misc",
			particles: "particles",
			animations: "animations",
		};
		const prefix = catPathMap[sourceCat] || sourceCat;
		return {
			type: filename,
			_pack: "squad-shooter",
			_path: `${prefix}/${filename}.glb`,
		};
	}

	// createDecoration3D generic (kaykit packs)
	if (factory === "createDecoration3D") {
		// Neutral kaykit-platformer
		if (packId === "kaykit-platformer" && sourceCat.startsWith("neutral_")) {
			return {
				type: filename,
				neutral: true,
				_pack: "kaykit-platformer",
				_path: `Assets/gltf/neutral/${filename}.gltf`,
			};
		}
		// Color kaykit-platformer — _pack/_path for explicit cross-pack
		if (packId === "kaykit-platformer" && sourceCat.endsWith("_color")) {
			return {
				type: filename,
				_pack: "kaykit-platformer",
				_path: `Assets/gltf/blue/${filename}_blue.gltf`,
				color: "blue",
			};
		}
		// City builder / resource bits
		if (packId === "kaykit-city-builder" || packId === "kaykit-resource-bits") {
			return {
				type: filename,
				_pack: packId,
				_path: `Assets/gltf/${filename}.gltf`,
			};
		}
		// Skeleton equipment
		if (packId === "kaykit-skeletons") {
			return {
				type: filename.replace(/\.(gltf|glb)$/, ""),
				_pack: "kaykit-skeletons",
				_path: filename,
			};
		}
	}

	return { type: filename };
}

// ===== Build the catalog =====

function buildCatalog(): AssetLibraryItem[] {
	const items: AssetLibraryItem[] = [];

	for (const pack of PACKS_3D) {
		// Skip OBJ packs (not supported in scene editor)
		if (pack.format === "obj") continue;

		for (const [sourceCat, names] of Object.entries(pack.categories)) {
			let mapping: CategoryMapping | undefined;
			let isColorVariant = false;

			switch (pack.id) {
				case "kaykit-platformer":
					mapping = PLATFORMER_MAP[sourceCat];
					isColorVariant = sourceCat.endsWith("_color");
					break;
				case "kaykit-city-builder":
					mapping = CITY_MAP[sourceCat];
					break;
				case "kaykit-resource-bits":
					mapping = {
						category: "resources",
						subcategory: RESOURCE_SUBCATEGORY[sourceCat] || sourceCat,
						factory: "createDecoration3D",
					};
					break;
				case "kaykit-skeletons":
					mapping = SKELETON_MAP[sourceCat];
					break;
				case "platformer-project":
					mapping = PLATFORMER_PROJECT_MAP[sourceCat];
					break;
				case "meshy-characters":
					mapping = {
						category: "characters",
						subcategory: "Meshy",
						factory: "createAnimatedCharacter3D",
						isAnimated: true,
					};
					break;
				case "squad-shooter":
					mapping = SQUAD_MAP[sourceCat];
					break;
			}

			if (!mapping) continue;

			for (const name of names) {
				const cleanName = name.replace(/\.(gltf|glb)$/, "");
				const format = (pack.format === "glb" || name.endsWith(".glb")) ? "glb" : "gltf";
				const modelPath = buildModelPath(pack.id, sourceCat, name);

				const item: AssetLibraryItem = {
					id: `${pack.id}:${cleanName}`,
					displayName: humanize(cleanName),
					category: mapping.category,
					subcategory: mapping.subcategory,
					packId: pack.id,
					filename: name,
					modelPath,
					factory: mapping.factory,
					factoryArgs: {}, // filled below
					format,
					hasColorVariants: isColorVariant,
					availableColors: isColorVariant ? KAYKIT_COLORS : [],
					isAnimated: mapping.isAnimated || false,
				};

				item.factoryArgs = buildFactoryArgs(item, pack.id, sourceCat, name, mapping.factory);

				items.push(item);
			}
		}
	}

	return items;
}

// ===== Exports =====

export const ASSET_CATALOG = buildCatalog();

export const ASSET_CATEGORIES: AssetCategory[] = [
	"platforms",
	"characters",
	"collectibles",
	"hazards",
	"decorations",
	"interactive",
	"buildings",
	"resources",
	"weapons",
	"environment",
];

export function getItemsByCategory(category: AssetCategory): AssetLibraryItem[] {
	return ASSET_CATALOG.filter((item) => item.category === category);
}

export function getSubcategories(category: AssetCategory): string[] {
	const subs = new Set<string>();
	for (const item of ASSET_CATALOG) {
		if (item.category === category) subs.add(item.subcategory);
	}
	return Array.from(subs);
}

export function searchAssets(query: string): AssetLibraryItem[] {
	if (!query.trim()) return ASSET_CATALOG;
	const q = query.toLowerCase();
	return ASSET_CATALOG.filter(
		(item) =>
			item.displayName.toLowerCase().includes(q) ||
			item.subcategory.toLowerCase().includes(q) ||
			item.packId.toLowerCase().includes(q),
	);
}

/**
 * Build a color-specific variant of a kaykit color item's factory args.
 * Updates _path to point to the selected color variant.
 */
export function withColor(item: AssetLibraryItem, color: string): Record<string, any> {
	if (!item.hasColorVariants) return item.factoryArgs;
	const baseName = item.filename;
	return {
		...item.factoryArgs,
		color,
		_path: `Assets/gltf/${color}/${baseName}_${color}.gltf`,
	};
}
