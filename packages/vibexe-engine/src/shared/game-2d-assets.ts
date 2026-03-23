/**
 * 2D Game Visual Reference — Catalog for 2D game generation agents.
 *
 * Injected into 2D game agent prompt. Edit HERE to update all 2D game generation.
 *
 * ALL visuals are PROGRAMMATIC — PIXI.Graphics shapes, canvas gradients,
 * Proton particles. No external sprite files needed.
 */

// ============================================================================
// COLOR PALETTES — Theme-based visual presets
// ============================================================================

export interface ColorPalette {
	name: string;
	skyTop: number;
	skyBottom: number;
	mountains: number[];
	ground: number;
	groundTop: number;
	platform: number;
	platformTop: number;
	player: number;
	playerLight: number;
	coin: number;
	coinGlow: number;
	enemy: number;
	enemyLight: number;
	foliage: number;
	foliageLight: number;
	water: number;
	ambient: string;
	weather: string | null;
}

export const PALETTES: Record<string, ColorPalette> = {
	forest: {
		name: "Enchanted Forest",
		skyTop: 0x0a0a2e,
		skyBottom: 0x1a4a3a,
		mountains: [0x0d1a0d, 0x1a2d1a, 0x2a3d2a],
		ground: 0x2d5a27,
		groundTop: 0x4a8a3a,
		platform: 0x5a3a1a,
		platformTop: 0x7a5a3a,
		player: 0x44aaff,
		playerLight: 0x77ccff,
		coin: 0xffdd00,
		coinGlow: 0xffaa00,
		enemy: 0xcc3333,
		enemyLight: 0xff5555,
		foliage: 0x339933,
		foliageLight: 0x55cc55,
		water: 0x2266aa,
		ambient: "fireflies",
		weather: null,
	},
	sunset: {
		name: "Golden Sunset",
		skyTop: 0x1a0533,
		skyBottom: 0xff6633,
		mountains: [0x1a1133, 0x2d1a44, 0x442d55],
		ground: 0x3a5a2a,
		groundTop: 0x5a8a3a,
		platform: 0x6a4a2a,
		platformTop: 0x8a6a4a,
		player: 0x44ccaa,
		playerLight: 0x66eebb,
		coin: 0xffdd00,
		coinGlow: 0xff8800,
		enemy: 0xaa2244,
		enemyLight: 0xdd4466,
		foliage: 0x447733,
		foliageLight: 0x66aa55,
		water: 0x334488,
		ambient: "fireflies",
		weather: null,
	},
	space: {
		name: "Cosmic Void",
		skyTop: 0x000011,
		skyBottom: 0x0a0a33,
		mountains: [0x111133, 0x1a1a44, 0x222255],
		ground: 0x333355,
		groundTop: 0x444477,
		platform: 0x555577,
		platformTop: 0x6666aa,
		player: 0x44ffaa,
		playerLight: 0x77ffcc,
		coin: 0xffaa33,
		coinGlow: 0xff6600,
		enemy: 0xff44aa,
		enemyLight: 0xff77cc,
		foliage: 0x4466aa,
		foliageLight: 0x6688cc,
		water: 0x223366,
		ambient: "dust",
		weather: null,
	},
	volcanic: {
		name: "Lava Realm",
		skyTop: 0x1a0000,
		skyBottom: 0x4a1500,
		mountains: [0x1a0505, 0x2d0a0a, 0x3d1515],
		ground: 0x2a1a0a,
		groundTop: 0x4a2a1a,
		platform: 0x3a2a1a,
		platformTop: 0x5a3a2a,
		player: 0x44aaff,
		playerLight: 0x77ccff,
		coin: 0xffdd00,
		coinGlow: 0xff4400,
		enemy: 0xff6600,
		enemyLight: 0xff8833,
		foliage: 0x553322,
		foliageLight: 0x774433,
		water: 0xff3300,
		ambient: "embers",
		weather: null,
	},
	candy: {
		name: "Candy Kingdom",
		skyTop: 0xffaacc,
		skyBottom: 0xaaccff,
		mountains: [0xddaacc, 0xccbbdd, 0xbbccee],
		ground: 0x88cc77,
		groundTop: 0xaaee99,
		platform: 0xcc88aa,
		platformTop: 0xeeaacc,
		player: 0xff6699,
		playerLight: 0xff99bb,
		coin: 0xffdd00,
		coinGlow: 0xff88ff,
		enemy: 0x9944cc,
		enemyLight: 0xbb66ee,
		foliage: 0x77cc55,
		foliageLight: 0x99ee77,
		water: 0x6699ff,
		ambient: "pollen",
		weather: null,
	},
	arctic: {
		name: "Frozen Tundra",
		skyTop: 0x1a2a4a,
		skyBottom: 0x7799bb,
		mountains: [0x334455, 0x445566, 0x556677],
		ground: 0x889999,
		groundTop: 0xaabbcc,
		platform: 0x778899,
		platformTop: 0x99aabb,
		player: 0xff6644,
		playerLight: 0xff8866,
		coin: 0xffdd00,
		coinGlow: 0xffaa00,
		enemy: 0x4488cc,
		enemyLight: 0x66aaee,
		foliage: 0x446666,
		foliageLight: 0x668888,
		water: 0x5588aa,
		ambient: "dust",
		weather: "snow",
	},
	dark: {
		name: "Shadow Depths",
		skyTop: 0x050510,
		skyBottom: 0x0a0a20,
		mountains: [0x0a0a15, 0x10101d, 0x151525],
		ground: 0x1a1a2a,
		groundTop: 0x2a2a3a,
		platform: 0x222233,
		platformTop: 0x333344,
		player: 0x00ccff,
		playerLight: 0x44eeff,
		coin: 0xffdd00,
		coinGlow: 0x00ff88,
		enemy: 0xff2244,
		enemyLight: 0xff4466,
		foliage: 0x1a2a1a,
		foliageLight: 0x2a3a2a,
		water: 0x112244,
		ambient: "embers",
		weather: null,
	},
	ocean: {
		name: "Deep Ocean",
		skyTop: 0x001133,
		skyBottom: 0x0055aa,
		mountains: [0x002244, 0x003355, 0x004466],
		ground: 0x224455,
		groundTop: 0x336677,
		platform: 0x335566,
		platformTop: 0x447788,
		player: 0xffaa33,
		playerLight: 0xffcc66,
		coin: 0xffdd00,
		coinGlow: 0x44ffaa,
		enemy: 0xcc44aa,
		enemyLight: 0xee66cc,
		foliage: 0x228855,
		foliageLight: 0x33aa77,
		water: 0x1155aa,
		ambient: "dust",
		weather: null,
	},
};

// Keep SCALES_2D for backward compat (used in index.ts export)
export const SCALES_2D: Record<string, number> = {};

// Keep types for backward compat
export interface AssetPack2D {
	id: string;
	name: string;
	style: string;
	spriteCount: number;
	serverPath: string;
	description: string;
	categories: Record<string, string[]>;
}
export const PACKS_2D: AssetPack2D[] = [];

// ============================================================================
// VISUAL REFERENCE STRING — Injected into agent prompt
// ============================================================================

export function buildAssetReferencePrompt(): string {
	const lines: string[] = [
		"## Visual Quality Reference (Programmatic Graphics)",
		"",
		"ALL visuals are created with PIXI.Graphics — no external sprites needed.",
		"The helper functions in src/config/assets.ts create professional-looking graphics.",
		"",
		"### Color Palettes (import { PALETTES } from '../config/assets')",
		"",
		"8 palettes: forest, sunset, space, volcanic, candy, arctic, dark, ocean.",
		"Each palette has: skyTop, skyBottom, mountains[], ground, groundTop,",
		"platform, platformTop, player, playerLight, coin, coinGlow, enemy, enemyLight,",
		"foliage, foliageLight, water, ambient (particle type), weather (null or 'snow'/'rain').",
		"",
		"### Drawing Helpers (import from '../config/assets')",
		"",
		"- lerpColor(a, b, t) — interpolate between two hex colors",
		"- drawSkyGradient(worldW, worldH, topColor, bottomColor) — smooth FillGradient sky (no banding)",
		"- drawStars(worldW, skyH, count) — scattered twinkling dots",
		"- drawMountainRange(worldW, baseY, color, alpha, minH, maxH, spacing) — triangle peaks",
		"- drawCloud(w, h) — soft white ellipse cluster",
		"- drawTree(trunkH, leafR, trunkColor, leafColor) — trunk + layered canopy",
		"- drawPlatformBlock(w, h, mainColor, topColor) — gradient fill + DropShadowFilter + grass tufts (returns Container)",
		"- drawPlayerCharacter(size, bodyColor, lightColor) — gradient body + OutlineFilter + eye shine (returns Container)",
		"- drawCoinToken(radius, color, glowColor) — radial gradient + GlowFilter (returns Container)",
		"- drawEnemySlime(size, color, lightColor) — radial gradient blob + OutlineFilter (returns Container)",
		"- drawHeart(size, color) — heart shape for lives display",
		"- drawGroundStrip(worldW, groundY, floorH, color, topColor) — gradient fill ground with grass tufts",
		"- drawGemShape(radius, color) — hexagonal gem with radial gradient + GlowFilter (returns Container)",
		"- drawShipShape(size, color, lightColor) — sleek ship with gradient body + engine glow (returns Container)",
		"",
		"### Visual Techniques (MUST USE in every game)",
		"",
		"1. **Gradient Sky**: drawSkyGradient() with FillGradient — NEVER flat-color background",
		"2. **Parallax Mountains**: 3 layers with decreasing alpha at different scroll speeds",
		"3. **Atmospheric Clouds**: drawCloud() with BlurFilter for soft edges",
		"4. **Decorative Trees/Props**: drawTree() with gradient trunk + radial canopy",
		"5. **Grass Tufts**: On ground and platform surfaces",
		"6. **Real Glow Effects**: GlowFilter on coins + powerups — no more manual glow rings",
		"7. **Squash & Stretch**: engine.juice.squashStretch() on land — spring easing",
		"8. **Screen Shake**: engine.juice.screenShake() — smooth GSAP-powered decay",
		"9. **Hit Pause**: engine.juice.hitPause() on impacts — freeze 60-100ms for feel",
		"10. **Score Pop**: engine.juice.scalePop() on score text when value changes",
		"11. **Floating Objects**: engine.juice.float() on coins — GSAP sine bobbing",
		"12. **DropShadow Filters**: On platforms + player for depth — drawPlatformBlock already has it",
		"13. **Outline Filters**: drawPlayerCharacter + drawEnemySlime have sticker-style outlines",
		"14. **Proton Particles**: Theme ambient + gameplay triggers (jump dust, collect sparkle, enemy death explosion)",
		"15. **Polished UI**: Score with text stroke, engine.juice.scalePop on changes, heart-based lives",
		"",
		"### Anti-Patterns (NEVER DO)",
		"",
		"- NEVER use flat single-color backgrounds — always gradient sky",
		"- NEVER make player a plain rectangle — use drawPlayerCharacter()",
		"- NEVER skip particles — every game needs ambient + gameplay effects",
		"- NEVER use untextured platforms — drawPlatformBlock() adds gradient + DropShadow + grass",
		"- NEVER put ALL game objects at same depth — use parallax layers",
		"- NEVER create filters in update() — create in enter(), assign once",
		"- NEVER forget engine.juice.killAll() in exit() — leaks GSAP tweens",
		"- NEVER use setTimeout for animations — use gsap.delayedCall() or gsap.to()",
		"",
	];

	return lines.join("\n");
}
