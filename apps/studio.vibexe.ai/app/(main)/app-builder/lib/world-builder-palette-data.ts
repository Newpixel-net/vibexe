// ─── World Builder Palette Data ───
// Model palette for the World Builder, organized by media-stock-3d packs.
// Each item maps to a GLTF/GLB model served via /api/app-builder/media-stock-3d/{pack}/{path}

import type { WBPaletteItem } from "./world-builder-types";

export interface WBPaletteCategory {
	id: string;
	label: string;
	pack: string;
	items: WBPaletteItem[];
}

export interface WBPalettePack {
	id: string;
	name: string;
	categories: WBPaletteCategory[];
}

// Helper to build items
function item(id: string, name: string, modelPath: string, pack: string, category: string, thumbnailColor?: string): WBPaletteItem {
	return { id, name, modelPath, pack, category, thumbnailColor };
}

// ─── Platformer Project (DEFAULT) ───
const PLATFORMER_PROJECT: WBPalettePack = {
	id: "platformer-project",
	name: "Platformer Project",
	categories: [
		{
			id: "pp-characters",
			label: "Characters",
			pack: "platformer-project",
			items: [
				item("pp-lily", "Lily", "characters/Lily.glb", "platformer-project", "Characters", "#e879a8"),
				item("pp-slime", "Slime", "characters/Slime.glb", "platformer-project", "Characters", "#44cc66"),
			],
		},
		{
			id: "pp-platforms",
			label: "Platforms",
			pack: "platformer-project",
			items: [
				item("pp-grid-platform", "Grid Platform", "objects/grid_platform.glb", "platformer-project", "Platforms", "#66aa44"),
				item("pp-long-platform", "Long Platform", "objects/long_platform.glb", "platformer-project", "Platforms", "#66aa44"),
				item("pp-bouncing-platform", "Bouncing Platform", "objects/bouncing_platform.glb", "platformer-project", "Platforms", "#eecc33"),
				item("pp-round-block", "Round Block", "objects/round_block.glb", "platformer-project", "Platforms", "#8888cc"),
				item("pp-halfpipe-in", "Halfpipe In", "objects/halfpipe_in.glb", "platformer-project", "Platforms", "#cc8844"),
				item("pp-halfpipe-out", "Halfpipe Out", "objects/halfpipe_out.glb", "platformer-project", "Platforms", "#cc8844"),
			],
		},
		{
			id: "pp-collectibles",
			label: "Collectibles",
			pack: "platformer-project",
			items: [
				item("pp-coin", "Coin", "objects/coin.glb", "platformer-project", "Collectibles", "#ffd700"),
				item("pp-star", "Star", "objects/star.glb", "platformer-project", "Collectibles", "#ffee33"),
				item("pp-heart", "Heart", "objects/heart.glb", "platformer-project", "Collectibles", "#ff4466"),
				item("pp-disc", "Disc", "objects/disc.glb", "platformer-project", "Collectibles", "#33aaff"),
			],
		},
		{
			id: "pp-hazards",
			label: "Hazards",
			pack: "platformer-project",
			items: [
				item("pp-spikes", "Spikes", "objects/spikes.glb", "platformer-project", "Hazards", "#cc3333"),
				item("pp-spikes-panel", "Spikes Panel", "objects/spikes_panel.glb", "platformer-project", "Hazards", "#cc3333"),
				item("pp-flamethrower", "Flamethrower", "objects/flamethrower.glb", "platformer-project", "Hazards", "#ff6600"),
				item("pp-log", "Log", "objects/log.glb", "platformer-project", "Hazards", "#886633"),
			],
		},
		{
			id: "pp-interactive",
			label: "Interactive",
			pack: "platformer-project",
			items: [
				item("pp-item-box", "Item Box", "objects/item_box.glb", "platformer-project", "Interactive", "#ffaa00"),
				item("pp-checkpoint", "Checkpoint", "objects/checkpoint.glb", "platformer-project", "Interactive", "#33cc33"),
				item("pp-button-panel", "Button Panel", "objects/button_panel.glb", "platformer-project", "Interactive", "#3388ff"),
				item("pp-end-panel", "End Panel", "objects/end_panel.glb", "platformer-project", "Interactive", "#ffcc00"),
			],
		},
		{
			id: "pp-decorations",
			label: "Decorations",
			pack: "platformer-project",
			items: [
				item("pp-sign", "Sign", "objects/sign.glb", "platformer-project", "Decorations", "#886644"),
				item("pp-garden", "Garden", "objects/garden.glb", "platformer-project", "Decorations", "#44aa44"),
				item("pp-dice", "Dice", "objects/dice.glb", "platformer-project", "Decorations", "#dddddd"),
				item("pp-sphere", "Sphere", "objects/sphere.glb", "platformer-project", "Decorations", "#aaaacc"),
				item("pp-glider", "Glider", "objects/glider.glb", "platformer-project", "Decorations", "#5599ee"),
				item("pp-lilyhead", "Lily Head", "objects/lilyhead.glb", "platformer-project", "Decorations", "#e879a8"),
			],
		},
	],
};

// ─── KayKit Platformer ───
const COLORS = ["blue", "green", "red", "yellow"] as const;
const COLOR_HEX: Record<string, string> = { blue: "#3b82f6", green: "#22c55e", red: "#ef4444", yellow: "#eab308" };

function colorItems(baseName: string, displayName: string, category: string): WBPaletteItem[] {
	return COLORS.map((c) =>
		item(
			`kp-${baseName}-${c}`,
			`${displayName} (${c})`,
			`Assets/gltf/${c}/${baseName}_${c}.gltf`,
			"kaykit-platformer",
			category,
			COLOR_HEX[c],
		),
	);
}

const KAYKIT_PLATFORMER: WBPalettePack = {
	id: "kaykit-platformer",
	name: "KayKit Platformer",
	categories: [
		{
			id: "kp-platforms",
			label: "Platforms",
			pack: "kaykit-platformer",
			items: [
				...colorItems("platform_4x4x1", "Platform 4x4", "Platforms"),
				...colorItems("platform_2x2x1", "Platform 2x2", "Platforms"),
				...colorItems("platform_6x6x1", "Platform 6x6", "Platforms"),
				...colorItems("platform_4x2x1", "Platform 4x2", "Platforms"),
				...colorItems("platform_1x1x1", "Platform 1x1", "Platforms"),
			],
		},
		{
			id: "kp-slopes",
			label: "Slopes",
			pack: "kaykit-platformer",
			items: [
				...colorItems("platform_slope_4x4x4", "Slope 4x4x4", "Slopes"),
				...colorItems("platform_slope_2x2x2", "Slope 2x2x2", "Slopes"),
				...colorItems("platform_slope_6x6x4", "Slope 6x6x4", "Slopes"),
			],
		},
		{
			id: "kp-barriers",
			label: "Barriers",
			pack: "kaykit-platformer",
			items: [
				...colorItems("barrier_2x1x2", "Barrier 2x1x2", "Barriers"),
				...colorItems("barrier_4x1x4", "Barrier 4x1x4", "Barriers"),
				...colorItems("barrier_1x1x1", "Barrier 1x1x1", "Barriers"),
			],
		},
		{
			id: "kp-collectibles",
			label: "Collectibles",
			pack: "kaykit-platformer",
			items: [
				...colorItems("diamond", "Diamond", "Collectibles"),
				...colorItems("star", "Star", "Collectibles"),
				...colorItems("heart", "Heart", "Collectibles"),
				...colorItems("ball", "Ball", "Collectibles"),
			],
		},
		{
			id: "kp-interactive",
			label: "Interactive",
			pack: "kaykit-platformer",
			items: [
				...colorItems("flag_A", "Flag A", "Interactive"),
				...colorItems("spring_pad", "Spring Pad", "Interactive"),
				...colorItems("button_base", "Button", "Interactive"),
				...colorItems("power", "Power", "Interactive"),
			],
		},
		{
			id: "kp-arches",
			label: "Arches & Pipes",
			pack: "kaykit-platformer",
			items: [
				...colorItems("arch", "Arch", "Arches"),
				...colorItems("arch_tall", "Arch Tall", "Arches"),
				...colorItems("pipe_straight_A", "Pipe Straight", "Pipes"),
				...colorItems("pipe_90_A", "Pipe 90", "Pipes"),
			],
		},
		{
			id: "kp-neutral",
			label: "Neutral",
			pack: "kaykit-platformer",
			items: [
				item("kp-pillar-2x2x4", "Pillar 2x2x4", "Assets/gltf/neutral/pillar_2x2x4.gltf", "kaykit-platformer", "Neutral", "#888"),
				item("kp-pillar-1x1x4", "Pillar 1x1x4", "Assets/gltf/neutral/pillar_1x1x4.gltf", "kaykit-platformer", "Neutral", "#888"),
				item("kp-floor-wood-4x4", "Wood Floor 4x4", "Assets/gltf/neutral/floor_wood_4x4.gltf", "kaykit-platformer", "Neutral", "#a8753b"),
				item("kp-structure-a", "Structure A", "Assets/gltf/neutral/structure_A.gltf", "kaykit-platformer", "Neutral", "#888"),
				item("kp-structure-b", "Structure B", "Assets/gltf/neutral/structure_B.gltf", "kaykit-platformer", "Neutral", "#888"),
				item("kp-sign", "Sign", "Assets/gltf/neutral/sign.gltf", "kaykit-platformer", "Neutral", "#886644"),
				item("kp-spring", "Spring", "Assets/gltf/neutral/spring.gltf", "kaykit-platformer", "Neutral", "#cccc33"),
			],
		},
	],
};

// ─── KayKit City Builder ───
const KAYKIT_CITY: WBPalettePack = {
	id: "kaykit-city-builder",
	name: "KayKit City Builder",
	categories: [
		{
			id: "kc-buildings",
			label: "Buildings",
			pack: "kaykit-city-builder",
			items: [
				item("kc-building-a", "Building A", "Assets/gltf/building_A.gltf", "kaykit-city-builder", "Buildings", "#cc8844"),
				item("kc-building-b", "Building B", "Assets/gltf/building_B.gltf", "kaykit-city-builder", "Buildings", "#ccaa66"),
				item("kc-building-c", "Building C", "Assets/gltf/building_C.gltf", "kaykit-city-builder", "Buildings", "#aa8855"),
				item("kc-building-d", "Building D", "Assets/gltf/building_D.gltf", "kaykit-city-builder", "Buildings", "#bb9966"),
				item("kc-building-e", "Building E", "Assets/gltf/building_E.gltf", "kaykit-city-builder", "Buildings", "#998877"),
				item("kc-building-f", "Building F", "Assets/gltf/building_F.gltf", "kaykit-city-builder", "Buildings", "#aa7755"),
				item("kc-building-g", "Building G", "Assets/gltf/building_G.gltf", "kaykit-city-builder", "Buildings", "#bb8866"),
				item("kc-building-h", "Building H", "Assets/gltf/building_H.gltf", "kaykit-city-builder", "Buildings", "#cc9977"),
			],
		},
		{
			id: "kc-roads",
			label: "Roads",
			pack: "kaykit-city-builder",
			items: [
				item("kc-road-straight", "Road Straight", "Assets/gltf/road_straight.gltf", "kaykit-city-builder", "Roads", "#555555"),
				item("kc-road-corner", "Road Corner", "Assets/gltf/road_corner.gltf", "kaykit-city-builder", "Roads", "#555555"),
				item("kc-road-corner-curved", "Road Curved", "Assets/gltf/road_corner_curved.gltf", "kaykit-city-builder", "Roads", "#555555"),
				item("kc-road-junction", "Junction", "Assets/gltf/road_junction.gltf", "kaykit-city-builder", "Roads", "#555555"),
				item("kc-road-crossing", "Crossing", "Assets/gltf/road_straight_crossing.gltf", "kaykit-city-builder", "Roads", "#555555"),
				item("kc-road-tsplit", "T-Split", "Assets/gltf/road_tsplit.gltf", "kaykit-city-builder", "Roads", "#555555"),
			],
		},
		{
			id: "kc-vehicles",
			label: "Vehicles",
			pack: "kaykit-city-builder",
			items: [
				item("kc-car-sedan", "Sedan", "Assets/gltf/car_sedan.gltf", "kaykit-city-builder", "Vehicles", "#3388ee"),
				item("kc-car-taxi", "Taxi", "Assets/gltf/car_taxi.gltf", "kaykit-city-builder", "Vehicles", "#eecc33"),
				item("kc-car-police", "Police Car", "Assets/gltf/car_police.gltf", "kaykit-city-builder", "Vehicles", "#2244aa"),
				item("kc-car-hatchback", "Hatchback", "Assets/gltf/car_hatchback.gltf", "kaykit-city-builder", "Vehicles", "#cc4444"),
				item("kc-car-stationwagon", "Station Wagon", "Assets/gltf/car_stationwagon.gltf", "kaykit-city-builder", "Vehicles", "#44aa88"),
			],
		},
		{
			id: "kc-props",
			label: "Street Props",
			pack: "kaykit-city-builder",
			items: [
				item("kc-streetlight", "Streetlight", "Assets/gltf/streetlight.gltf", "kaykit-city-builder", "Props", "#888888"),
				item("kc-bench", "Bench", "Assets/gltf/bench.gltf", "kaykit-city-builder", "Props", "#886644"),
				item("kc-bush", "Bush", "Assets/gltf/bush.gltf", "kaykit-city-builder", "Props", "#44aa44"),
				item("kc-dumpster", "Dumpster", "Assets/gltf/dumpster.gltf", "kaykit-city-builder", "Props", "#44aa44"),
				item("kc-firehydrant", "Fire Hydrant", "Assets/gltf/firehydrant.gltf", "kaykit-city-builder", "Props", "#cc3333"),
				item("kc-watertower", "Water Tower", "Assets/gltf/watertower.gltf", "kaykit-city-builder", "Props", "#888888"),
				item("kc-trafficlight-a", "Traffic Light A", "Assets/gltf/trafficlight_A.gltf", "kaykit-city-builder", "Props", "#333333"),
			],
		},
	],
};

// ─── KayKit Resource Bits ───
const KAYKIT_RESOURCES: WBPalettePack = {
	id: "kaykit-resource-bits",
	name: "KayKit Resources",
	categories: [
		{
			id: "kr-gold",
			label: "Gold",
			pack: "kaykit-resource-bits",
			items: [
				item("kr-gold-bar", "Gold Bar", "Assets/gltf/Gold_Bar.gltf", "kaykit-resource-bits", "Gold", "#ffd700"),
				item("kr-gold-bars", "Gold Bars", "Assets/gltf/Gold_Bars.gltf", "kaykit-resource-bits", "Gold", "#ffd700"),
				item("kr-gold-nuggets", "Gold Nuggets", "Assets/gltf/Gold_Nuggets.gltf", "kaykit-resource-bits", "Gold", "#ffd700"),
				item("kr-gold-stack-lg", "Gold Stack (L)", "Assets/gltf/Gold_Bars_Stack_Large.gltf", "kaykit-resource-bits", "Gold", "#ffd700"),
			],
		},
		{
			id: "kr-iron",
			label: "Iron",
			pack: "kaykit-resource-bits",
			items: [
				item("kr-iron-bar", "Iron Bar", "Assets/gltf/Iron_Bar.gltf", "kaykit-resource-bits", "Iron", "#888899"),
				item("kr-iron-bars", "Iron Bars", "Assets/gltf/Iron_Bars.gltf", "kaykit-resource-bits", "Iron", "#888899"),
				item("kr-iron-nuggets", "Iron Nuggets", "Assets/gltf/Iron_Nuggets.gltf", "kaykit-resource-bits", "Iron", "#888899"),
			],
		},
		{
			id: "kr-wood",
			label: "Wood",
			pack: "kaykit-resource-bits",
			items: [
				item("kr-wood-log-a", "Wood Log A", "Assets/gltf/Wood_Log_A.gltf", "kaykit-resource-bits", "Wood", "#a8753b"),
				item("kr-wood-log-b", "Wood Log B", "Assets/gltf/Wood_Log_B.gltf", "kaykit-resource-bits", "Wood", "#a8753b"),
				item("kr-wood-plank-a", "Plank A", "Assets/gltf/Wood_Plank_A.gltf", "kaykit-resource-bits", "Wood", "#c49555"),
				item("kr-wood-stack", "Log Stack", "Assets/gltf/Wood_Log_Stack.gltf", "kaykit-resource-bits", "Wood", "#a8753b"),
			],
		},
		{
			id: "kr-fuel",
			label: "Fuel",
			pack: "kaykit-resource-bits",
			items: [
				item("kr-fuel-a", "Fuel Barrel A", "Assets/gltf/Fuel_A_Barrel.gltf", "kaykit-resource-bits", "Fuel", "#338833"),
				item("kr-fuel-b", "Fuel Barrel B", "Assets/gltf/Fuel_B_Barrel.gltf", "kaykit-resource-bits", "Fuel", "#3333cc"),
				item("kr-fuel-c", "Fuel Barrel C", "Assets/gltf/Fuel_C_Barrel.gltf", "kaykit-resource-bits", "Fuel", "#cc3333"),
				item("kr-fuel-jerrycan", "Jerrycan", "Assets/gltf/Fuel_A_Jerrycan.gltf", "kaykit-resource-bits", "Fuel", "#338833"),
			],
		},
		{
			id: "kr-stone",
			label: "Stone",
			pack: "kaykit-resource-bits",
			items: [
				item("kr-stone-brick", "Stone Brick", "Assets/gltf/Stone_Brick.gltf", "kaykit-resource-bits", "Stone", "#999999"),
				item("kr-stone-stack-lg", "Stone Stack (L)", "Assets/gltf/Stone_Bricks_Stack_Large.gltf", "kaykit-resource-bits", "Stone", "#999999"),
				item("kr-stone-chunks-lg", "Stone Chunks", "Assets/gltf/Stone_Chunks_Large.gltf", "kaykit-resource-bits", "Stone", "#777777"),
			],
		},
	],
};

// ─── Squad Shooter ───
const SQUAD_SHOOTER: WBPalettePack = {
	id: "squad-shooter",
	name: "Squad Shooter",
	categories: [
		{
			id: "ss-world1",
			label: "World 1 (Desert)",
			pack: "squad-shooter",
			items: [
				item("ss-w1-ground", "Ground", "environment/world_1/1_Ground_1.glb", "squad-shooter", "World 1", "#c8a862"),
				item("ss-w1-block-big", "Block Big", "environment/world_1/1_Block_1x1_Big.glb", "squad-shooter", "World 1", "#b8944a"),
				item("ss-w1-block-med", "Block Med", "environment/world_1/1_Block_1x1_Medium.glb", "squad-shooter", "World 1", "#b8944a"),
				item("ss-w1-border1", "Border 1", "environment/world_1/1_Border_1.glb", "squad-shooter", "World 1", "#a88a44"),
				item("ss-w1-wall", "Wall 1x1", "environment/world_1/1_Wall_1x1.glb", "squad-shooter", "World 1", "#a88a44"),
			],
		},
		{
			id: "ss-world2",
			label: "World 2 (Industrial)",
			pack: "squad-shooter",
			items: [
				item("ss-w2-ground", "Ground", "environment/world_2/2_Ground_1.glb", "squad-shooter", "World 2", "#6688aa"),
				item("ss-w2-block-big", "Block Big", "environment/world_2/2_Block_1x1_Big.glb", "squad-shooter", "World 2", "#557799"),
				item("ss-w2-block-med", "Block Med", "environment/world_2/2_Block_1x1_Medium.glb", "squad-shooter", "World 2", "#557799"),
				item("ss-w2-border1", "Border 1", "environment/world_2/2_Border_1.glb", "squad-shooter", "World 2", "#4477aa"),
				item("ss-w2-wall", "Wall 1x1", "environment/world_2/2_Wall_1x1.glb", "squad-shooter", "World 2", "#4477aa"),
			],
		},
		{
			id: "ss-collectibles",
			label: "Collectibles",
			pack: "squad-shooter",
			items: [
				item("ss-coin", "Coin", "misc/Coin.glb", "squad-shooter", "Collectibles", "#ffd700"),
				item("ss-ring", "Ring", "misc/Ring.glb", "squad-shooter", "Collectibles", "#44ccff"),
				item("ss-chest", "Chest", "misc/Chest.glb", "squad-shooter", "Collectibles", "#cc8833"),
			],
		},
		{
			id: "ss-weapons",
			label: "Weapons",
			pack: "squad-shooter",
			items: [
				item("ss-minigun", "Minigun", "weapons/Minigun.glb", "squad-shooter", "Weapons", "#888888"),
				item("ss-shotgun", "Shotgun", "weapons/Shotgun.glb", "squad-shooter", "Weapons", "#886644"),
				item("ss-teslagun", "Tesla Gun", "weapons/Teslagun.glb", "squad-shooter", "Weapons", "#33aaff"),
				item("ss-grenade-launcher", "Grenade Launcher", "weapons/Grenade_launcher.glb", "squad-shooter", "Weapons", "#44aa44"),
			],
		},
	],
};

// ─── All packs ───
export const WB_PALETTE_PACKS: WBPalettePack[] = [
	PLATFORMER_PROJECT,
	KAYKIT_PLATFORMER,
	KAYKIT_CITY,
	KAYKIT_RESOURCES,
	SQUAD_SHOOTER,
];

/** Flat list of all palette items across all packs */
export function getAllPaletteItems(): WBPaletteItem[] {
	const items: WBPaletteItem[] = [];
	for (const pack of WB_PALETTE_PACKS) {
		for (const cat of pack.categories) {
			items.push(...cat.items);
		}
	}
	return items;
}

/** Find palette item by id */
export function findPaletteItem(id: string): WBPaletteItem | undefined {
	for (const pack of WB_PALETTE_PACKS) {
		for (const cat of pack.categories) {
			const found = cat.items.find((i) => i.id === id);
			if (found) return found;
		}
	}
	return undefined;
}
