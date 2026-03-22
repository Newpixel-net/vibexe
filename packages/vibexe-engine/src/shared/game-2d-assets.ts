/**
 * 2D Game Assets Reference — Catalog for 2D game generation agents.
 *
 * Injected into 2D game agent prompt. Edit HERE to update all 2D game generation.
 * Assets served from: /opt/vibexe/media-stock/games/ via /api/app-builder/media-stock/
 *
 * 20,454 sprites total. Rebuilt from server inventory.
 *
 * All packs use cartoon/pixel art style (PNG, web-ready).
 * Raw sprites are 800-3000px — ALWAYS apply SCALES when creating sprites.
 */

// ============================================================================
// SCALE PRESETS — Raw PNGs are oversized, must be scaled down
// ============================================================================

export const SCALES_2D: Record<string, number> = {
	// Characters
	player: 0.15,
	enemy: 0.12,
	npc: 0.12,
	boss: 0.2,
	// Platforms & tiles
	platform: 0.2,
	tile: 0.125,
	block: 0.15,
	// Items & collectibles
	collectible: 0.08,
	powerup: 0.1,
	coin: 0.06,
	// Projectiles
	projectile: 0.05,
	bullet: 0.04,
	// Environment
	background: 1.0,
	parallaxLayer: 1.0,
	decoration: 0.15,
	prop: 0.12,
	// UI
	button: 0.2,
	icon: 0.08,
	heart: 0.06,
};

// ============================================================================
// ASSET PACK DEFINITIONS
// ============================================================================

export interface AssetPack2D {
	id: string;
	name: string;
	style: "cartoon" | "pixel" | "hand-drawn" | "vector";
	spriteCount: number;
	serverPath: string;
	description: string;
	categories: Record<string, string[]>;
}

export const PACKS_2D: AssetPack2D[] = [
	// ---- CHARACTER PACKS ----
	{
		id: "robot",
		name: "Robot Character Pack",
		style: "cartoon",
		spriteCount: 120,
		serverPath: "robot",
		description:
			"Robot character with full walk/run/jump/idle/attack animations. Individual frame PNGs.",
		categories: {
			idle: [
				"idle_01.png",
				"idle_02.png",
				"idle_03.png",
				"idle_04.png",
				"idle_05.png",
				"idle_06.png",
				"idle_07.png",
				"idle_08.png",
				"idle_09.png",
				"idle_10.png",
			],
			walk: [
				"walk_01.png",
				"walk_02.png",
				"walk_03.png",
				"walk_04.png",
				"walk_05.png",
				"walk_06.png",
				"walk_07.png",
				"walk_08.png",
			],
			run: [
				"run_01.png",
				"run_02.png",
				"run_03.png",
				"run_04.png",
				"run_05.png",
				"run_06.png",
				"run_07.png",
				"run_08.png",
			],
			jump: ["jump_01.png", "jump_02.png", "jump_03.png", "jump_04.png"],
			attack: [
				"attack_01.png",
				"attack_02.png",
				"attack_03.png",
				"attack_04.png",
				"attack_05.png",
				"attack_06.png",
			],
			hurt: ["hurt_01.png", "hurt_02.png"],
			death: [
				"death_01.png",
				"death_02.png",
				"death_03.png",
				"death_04.png",
				"death_05.png",
				"death_06.png",
				"death_07.png",
				"death_08.png",
			],
		},
	},
	{
		id: "zombie",
		name: "Zombie Character Pack",
		style: "cartoon",
		spriteCount: 80,
		serverPath: "zombie",
		description:
			"Zombie enemy character with walk/attack/death animations. Individual frame PNGs.",
		categories: {
			walk: [
				"walk_01.png",
				"walk_02.png",
				"walk_03.png",
				"walk_04.png",
				"walk_05.png",
				"walk_06.png",
				"walk_07.png",
				"walk_08.png",
			],
			attack: [
				"attack_01.png",
				"attack_02.png",
				"attack_03.png",
				"attack_04.png",
				"attack_05.png",
				"attack_06.png",
			],
			hurt: ["hurt_01.png", "hurt_02.png"],
			death: [
				"death_01.png",
				"death_02.png",
				"death_03.png",
				"death_04.png",
				"death_05.png",
				"death_06.png",
			],
		},
	},
	{
		id: "alien",
		name: "Alien Character Pack",
		style: "cartoon",
		spriteCount: 60,
		serverPath: "alien",
		description:
			"Alien character with walk/jump/attack animations. Individual frame PNGs.",
		categories: {
			idle: ["idle_01.png", "idle_02.png", "idle_03.png", "idle_04.png"],
			walk: [
				"walk_01.png",
				"walk_02.png",
				"walk_03.png",
				"walk_04.png",
				"walk_05.png",
				"walk_06.png",
			],
			jump: ["jump_01.png", "jump_02.png", "jump_03.png"],
			attack: [
				"attack_01.png",
				"attack_02.png",
				"attack_03.png",
				"attack_04.png",
			],
		},
	},

	// ---- ENVIRONMENT PACKS ----
	{
		id: "environments-nature",
		name: "Nature Environment",
		style: "cartoon",
		spriteCount: 11,
		serverPath: "environments/nature",
		description:
			"Nature parallax background — 11 layers (sky, mountains, trees, ground). 1920x1080 PNGs.",
		categories: {
			layers: [
				"1.png",
				"2.png",
				"3.png",
				"4.png",
				"5.png",
				"6.png",
				"7.png",
				"8.png",
				"9.png",
				"10.png",
				"11.png",
			],
		},
	},
	{
		id: "environments-forest",
		name: "Forest Environment",
		style: "cartoon",
		spriteCount: 8,
		serverPath: "environments/forest",
		description:
			"Forest parallax background — 8 layers (sky, trees, fog, ground). 1920x1080 PNGs.",
		categories: {
			layers: [
				"1.png",
				"2.png",
				"3.png",
				"4.png",
				"5.png",
				"6.png",
				"7.png",
				"8.png",
			],
		},
	},
	{
		id: "environments-dark",
		name: "Dark Environment",
		style: "cartoon",
		spriteCount: 7,
		serverPath: "environments/dark",
		description:
			"Dark/horror parallax background — 7 layers. 1920x1080 PNGs.",
		categories: {
			layers: [
				"1.png",
				"2.png",
				"3.png",
				"4.png",
				"5.png",
				"6.png",
				"7.png",
			],
		},
	},
	{
		id: "environments-mountains",
		name: "Mountain Environment",
		style: "cartoon",
		spriteCount: 6,
		serverPath: "environments/mountains",
		description:
			"Mountain parallax background — 6 layers (sky, peaks, valleys). 1920x1080 PNGs.",
		categories: {
			layers: ["1.png", "2.png", "3.png", "4.png", "5.png", "6.png"],
		},
	},
	{
		id: "environments-simple",
		name: "Simple Environment",
		style: "cartoon",
		spriteCount: 4,
		serverPath: "environments/simple",
		description:
			"Simple parallax background — 4 layers (sky, hills, ground). 1920x1080 PNGs.",
		categories: {
			layers: ["1.png", "2.png", "3.png", "4.png"],
		},
	},
	{
		id: "environments-space",
		name: "Space Environment",
		style: "cartoon",
		spriteCount: 5,
		serverPath: "environments/space",
		description:
			"Space parallax background — 5 layers (stars, nebula, planets). 1920x1080 PNGs.",
		categories: {
			layers: ["1.png", "2.png", "3.png", "4.png", "5.png"],
		},
	},

	// ---- PLATFORM & TILE PACKS ----
	{
		id: "platforms",
		name: "Platform Tiles",
		style: "cartoon",
		spriteCount: 50,
		serverPath: "platforms",
		description:
			"Assorted platform tiles — grass, stone, dirt, ice. Various sizes. PNG.",
		categories: {
			grass: [
				"grass_left.png",
				"grass_mid.png",
				"grass_right.png",
				"grass_single.png",
			],
			stone: [
				"stone_left.png",
				"stone_mid.png",
				"stone_right.png",
				"stone_single.png",
			],
			dirt: [
				"dirt_left.png",
				"dirt_mid.png",
				"dirt_right.png",
				"dirt_single.png",
			],
			ice: [
				"ice_left.png",
				"ice_mid.png",
				"ice_right.png",
				"ice_single.png",
			],
		},
	},

	// ---- ITEMS & COLLECTIBLES ----
	{
		id: "items",
		name: "Items & Collectibles",
		style: "cartoon",
		spriteCount: 40,
		serverPath: "items",
		description:
			"Coins, gems, hearts, keys, potions. Individual PNG sprites.",
		categories: {
			coins: [
				"coin_gold.png",
				"coin_silver.png",
				"coin_bronze.png",
				"coin_spin_01.png",
				"coin_spin_02.png",
				"coin_spin_03.png",
				"coin_spin_04.png",
				"coin_spin_05.png",
			],
			gems: ["gem_red.png", "gem_blue.png", "gem_green.png", "gem_purple.png"],
			hearts: ["heart_full.png", "heart_half.png", "heart_empty.png"],
			keys: ["key_gold.png", "key_silver.png"],
			potions: [
				"potion_red.png",
				"potion_blue.png",
				"potion_green.png",
				"potion_purple.png",
			],
		},
	},
];

// ============================================================================
// ENVIRONMENT PARALLAX MAPPING
// ============================================================================

export interface ParallaxConfig {
	packId: string;
	layers: { file: string; factor: number }[];
}

export const PARALLAX_CONFIGS: Record<string, ParallaxConfig> = {
	nature: {
		packId: "environments-nature",
		layers: [
			{ file: "1.png", factor: 0.0 },
			{ file: "2.png", factor: 0.05 },
			{ file: "3.png", factor: 0.1 },
			{ file: "4.png", factor: 0.15 },
			{ file: "5.png", factor: 0.2 },
			{ file: "6.png", factor: 0.3 },
			{ file: "7.png", factor: 0.4 },
			{ file: "8.png", factor: 0.5 },
			{ file: "9.png", factor: 0.6 },
			{ file: "10.png", factor: 0.7 },
			{ file: "11.png", factor: 0.8 },
		],
	},
	forest: {
		packId: "environments-forest",
		layers: [
			{ file: "1.png", factor: 0.0 },
			{ file: "2.png", factor: 0.1 },
			{ file: "3.png", factor: 0.2 },
			{ file: "4.png", factor: 0.35 },
			{ file: "5.png", factor: 0.5 },
			{ file: "6.png", factor: 0.6 },
			{ file: "7.png", factor: 0.7 },
			{ file: "8.png", factor: 0.85 },
		],
	},
	dark: {
		packId: "environments-dark",
		layers: [
			{ file: "1.png", factor: 0.0 },
			{ file: "2.png", factor: 0.1 },
			{ file: "3.png", factor: 0.2 },
			{ file: "4.png", factor: 0.35 },
			{ file: "5.png", factor: 0.5 },
			{ file: "6.png", factor: 0.65 },
			{ file: "7.png", factor: 0.8 },
		],
	},
	mountains: {
		packId: "environments-mountains",
		layers: [
			{ file: "1.png", factor: 0.0 },
			{ file: "2.png", factor: 0.15 },
			{ file: "3.png", factor: 0.3 },
			{ file: "4.png", factor: 0.5 },
			{ file: "5.png", factor: 0.7 },
			{ file: "6.png", factor: 0.85 },
		],
	},
	simple: {
		packId: "environments-simple",
		layers: [
			{ file: "1.png", factor: 0.0 },
			{ file: "2.png", factor: 0.3 },
			{ file: "3.png", factor: 0.6 },
			{ file: "4.png", factor: 0.9 },
		],
	},
	space: {
		packId: "environments-space",
		layers: [
			{ file: "1.png", factor: 0.0 },
			{ file: "2.png", factor: 0.1 },
			{ file: "3.png", factor: 0.25 },
			{ file: "4.png", factor: 0.5 },
			{ file: "5.png", factor: 0.8 },
		],
	},
};

// ============================================================================
// ASSET REFERENCE STRING — Injected into agent prompt
// ============================================================================

export function buildAssetReferencePrompt(): string {
	const lines: string[] = [
		"## 2D Game Assets Reference",
		"",
		"Assets are served via `/api/app-builder/media-stock/{path}`. Use `spriteUrl(path)` helper.",
		"",
		"### IMPORTANT: Always apply SCALES_2D",
		"Raw sprites are 800-3000px. ALWAYS scale down when creating sprites.",
		"Example: `sprite.scale.set(SCALES_2D.player)` for characters.",
		"",
	];

	for (const pack of PACKS_2D) {
		lines.push(`### ${pack.name} (${pack.id})`);
		lines.push(`Path prefix: \`${pack.serverPath}/\``);
		lines.push(`${pack.description}`);
		lines.push("");
		for (const [cat, files] of Object.entries(pack.categories)) {
			lines.push(`  ${cat}: ${files.join(", ")}`);
		}
		lines.push("");
	}

	lines.push("### Parallax Environments");
	lines.push("6 environments: nature (11 layers), forest (8), dark (7), mountains (6), simple (4), space (5)");
	lines.push("Use PIXI.TilingSprite for each layer with parallax scrolling factor.");
	lines.push("");

	return lines.join("\n");
}
