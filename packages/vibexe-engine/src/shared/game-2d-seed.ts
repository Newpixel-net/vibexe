/**
 * 2D Game Seed Variety System
 *
 * Converts a 4-digit seed into a CreativeBrief that drives game generation variety.
 * Each seed deterministically selects from variety pools (theme, mechanics, layout, etc.)
 * and derives numeric parameters (gravity, speed, etc.) scaled by difficulty.
 *
 * The CreativeBrief is injected into the AI prompt as a "creative direction" document,
 * ensuring each new session produces a genuinely different game.
 */

// ===== Seeded PRNG (mulberry32) — same as game-3d-templates.ts =====
function mulberry32(seed: number): () => number {
	return function (): number {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ===== Variety Pools =====

const THEMES = [
	"forest",
	"sunset",
	"space",
	"volcanic",
	"candy",
	"arctic",
	"dark",
	"ocean",
] as const;

const MECHANIC_EMPHASIS = [
	"collect-focused",
	"combat-focused",
	"speed-focused",
	"exploration-focused",
] as const;

const LAYOUT_STYLES = [
	"spread-exploration",
	"tight-platforming",
	"vertical-challenge",
	"long-horizontal",
	"multi-path",
] as const;

const DIFFICULTY_PROFILES = [
	"casual-easy",
	"medium-balanced",
	"hard-intense",
] as const;

const ATMOSPHERES = [
	"fireflies-warm",
	"embers-dark",
	"dust-serene",
	"pollen-bright",
	"snow-cold",
	"rain-moody",
] as const;

const ENEMY_BEHAVIORS = [
	"patrol-simple",
	"chase-aggressive",
	"ranged-tactical",
	"swarm-overwhelming",
] as const;

const LEVEL_SHAPES = [
	"flat-wide",
	"hilly-undulating",
	"staircase-ascending",
	"valley-bowl",
] as const;

const COLLECTIBLE_PATTERNS = [
	"scattered-random",
	"trail-guided",
	"cluster-reward",
] as const;

const SPECIAL_MECHANICS = [
	"double-jump",
	"wall-slide",
	"dash",
	"gravity-flip",
	"teleport-portals",
	"time-slow",
] as const;

const ART_STYLE_DIRECTIONS = [
	"cartoon-bold",
	"pixel-retro",
	"painterly-soft",
	"neon-glow",
] as const;

// ===== Theme flavor text for creative brief =====

const THEME_FLAVORS: Record<string, string> = {
	forest: "deep greens, fireflies, mystical woodland mood",
	sunset: "warm oranges and purples, golden hour glow, silhouette drama",
	space: "deep blue-black, starfields, cosmic wonder, floating debris",
	volcanic: "dark reds and blacks, lava glow, ash particles, danger",
	candy: "bright pastels, sugar sparkles, playful bouncy energy",
	arctic: "ice whites and blues, snowfall, crisp clean atmosphere",
	dark: "deep shadows, moody lighting, mysterious fog, eerie",
	ocean: "sea blues and teals, wave motion, underwater shimmer",
};

const MECHANIC_FLAVORS: Record<string, string> = {
	"collect-focused":
		"coins plentiful, gem clusters, exploration rewarded with treasures",
	"combat-focused":
		"enemies prominent, combat encounters frequent, power-ups combat-oriented",
	"speed-focused":
		"fast movement, time pressure, speedrun-friendly paths, momentum mechanics",
	"exploration-focused":
		"hidden areas, branching paths, secrets to discover, reward curiosity",
};

const LAYOUT_FLAVORS: Record<string, string> = {
	"spread-exploration":
		"wide open spaces, multiple routes, large world to explore",
	"tight-platforming":
		"precise jumps required, small platforms, technical skill test",
	"vertical-challenge":
		"towers and climbing, upward progression, height-based difficulty",
	"long-horizontal":
		"wide scrolling level, journey-like progression, forward momentum",
	"multi-path":
		"branching routes, upper and lower paths, choice-driven traversal",
};

const DIFFICULTY_FLAVORS: Record<string, string> = {
	"casual-easy":
		"wide platforms, slow enemies, generous checkpoints, forgiving physics",
	"medium-balanced":
		"fair challenge, moderate speed, balanced risk-reward",
	"hard-intense":
		"tight gaps, fast enemies, punishing falls, demanding precision",
};

const ATMOSPHERE_FLAVORS: Record<string, string> = {
	"fireflies-warm": "ambient firefly particles, warm golden light",
	"embers-dark": "floating embers, smoky haze, dim warm glow",
	"dust-serene": "gentle dust motes, calm drifting particles, peaceful",
	"pollen-bright": "floating pollen specks, bright sunlit air, cheerful",
	"snow-cold": "falling snowflakes, cold blue tint, crisp winter air",
	"rain-moody": "rain droplets, dark clouds, splashing puddles, dramatic",
};

const ENEMY_FLAVORS: Record<string, string> = {
	"patrol-simple":
		"enemies walk set routes, predictable patterns, fair to dodge",
	"chase-aggressive":
		"enemies pursue the player, faster reaction, keep moving",
	"ranged-tactical":
		"enemies shoot projectiles, require timing and positioning",
	"swarm-overwhelming":
		"many small fast enemies, crowd control, avoid clusters",
};

const SPECIAL_MECHANIC_FLAVORS: Record<string, string> = {
	"double-jump": "extra air jump for height and distance, opens vertical play",
	"wall-slide":
		"slide down walls and wall-jump, enables vertical traversal",
	dash: "quick burst of horizontal speed, dodge through danger",
	"gravity-flip": "reverse gravity on command, ceiling becomes floor",
	"teleport-portals":
		"portal pairs that teleport the player, spatial puzzles",
	"time-slow": "slow-motion ability for precise platforming through danger",
};

// ===== Types =====

export type SubGenre = "platformer" | "runner" | "puzzle" | "shooter" | "rpg" | "topdown-adventure" | "twin-stick";

export interface CreativeBrief {
	seed: number;
	subGenre: SubGenre;
	theme: string;
	mechanicEmphasis: string;
	layoutStyle: string;
	difficultyProfile: string;
	atmosphere: string;
	enemyBehavior: string;
	levelShape: string;
	collectiblePattern: string;
	specialMechanic: string;
	artStyleDirection: string;
	// Derived numeric parameters (platformer-focused, adapted per genre)
	gravity: number;
	moveSpeed: number;
	jumpForce: number;
	worldWidth: number;
	worldHeight?: number;
	platformCount: number;
	enemyCount: number;
	coinCount: number;
	// Runner-specific
	startSpeed: number;
	maxSpeed: number;
	spawnInterval: number;
	// Puzzle-specific
	gridCols: number;
	gridRows: number;
	gemColorCount: number;
	// Shooter-specific
	fireRate: number;
	enemySpawnRate: number;
	waveCount: number;
	// World blueprint
	worldBlueprint: string;
}

// ===== Helper =====

function pick<T>(arr: readonly T[], rng: () => number): T {
	return arr[Math.floor(rng() * arr.length)];
}

function lerp(min: number, max: number, t: number): number {
	return Math.round(min + (max - min) * t);
}

// ===== Core expansion function =====

export function expandSeed(seed: number, subGenre: SubGenre): CreativeBrief {
	const rng = mulberry32(seed);

	// Pick from pools — order matters for determinism
	const theme = pick(THEMES, rng);
	const mechanicEmphasis = pick(MECHANIC_EMPHASIS, rng);
	const layoutStyle = pick(LAYOUT_STYLES, rng);
	const difficultyProfile = pick(DIFFICULTY_PROFILES, rng);
	const atmosphere = pick(ATMOSPHERES, rng);
	const enemyBehavior = pick(ENEMY_BEHAVIORS, rng);
	const levelShape = pick(LEVEL_SHAPES, rng);
	const collectiblePattern = pick(COLLECTIBLE_PATTERNS, rng);
	const specialMechanic = pick(SPECIAL_MECHANICS, rng);
	const artStyleDirection = pick(ART_STYLE_DIRECTIONS, rng);

	// Difficulty scaling factor: 0.0 = easy, 0.5 = medium, 1.0 = hard
	const diffScale =
		difficultyProfile === "casual-easy"
			? 0.0
			: difficultyProfile === "medium-balanced"
				? 0.5
				: 1.0;

	// Add per-seed jitter so same difficulty doesn't always give identical numbers
	const jitter = rng() * 0.2 - 0.1; // -0.1 to +0.1
	const d = Math.max(0, Math.min(1, diffScale + jitter));

	// Platformer params
	const gravity = lerp(750, 1350, d);
	const moveSpeed = lerp(220, 380, d);
	const jumpForce = lerp(430, 680, d);
	const worldWidth = lerp(3000, 6000, rng());
	const platformCount = lerp(7, 16, rng());
	const enemyCount = lerp(3, 12, d * 0.5 + rng() * 0.5);
	const coinCount = lerp(15, 40, rng());

	// Runner params
	const startSpeed = lerp(220, 350, d);
	const maxSpeed = lerp(450, 700, d);
	const spawnInterval = Number((2.2 - d * 1.0).toFixed(2)); // easier = more spacing

	// Puzzle params
	const gridCols = lerp(6, 9, rng());
	const gridRows = lerp(5, 8, rng());
	const gemColorCount = lerp(5, 7, rng());

	// Shooter params
	const fireRate = Number((0.16 - d * 0.06).toFixed(2)); // harder = faster fire
	const enemySpawnRate = Number((1.6 - d * 0.6).toFixed(2)); // harder = more enemies
	const waveCount = lerp(5, 15, d);

	// World blueprint — derived from subGenre + layout + atmosphere
	let worldBlueprint = 'outdoor-scroll';
	if (subGenre === 'runner') {
		worldBlueprint = 'endless-runner';
	} else if (subGenre === 'shooter') {
		worldBlueprint = 'arena';
	} else if (subGenre === 'rpg' || subGenre === 'topdown-adventure') {
		worldBlueprint = 'dungeon-topdown';
	} else if (subGenre === 'twin-stick') {
		worldBlueprint = 'open-field';
	} else if (subGenre === 'platformer') {
		if (layoutStyle === 'vertical-challenge') worldBlueprint = 'vertical-tower';
		else if (atmosphere === 'embers-dark') worldBlueprint = 'cave-system';
		else if (atmosphere === 'rain-moody') worldBlueprint = 'city-rooftops';
		else if (atmosphere === 'pollen-bright') worldBlueprint = 'forest-canopy';
		else if (theme === 'ocean') worldBlueprint = 'underwater';
		else if (theme === 'space') worldBlueprint = 'floating-islands';
		else if (theme === 'dark') worldBlueprint = 'dungeon-rooms';
		else {
			// Weighted random among remaining blueprints
			const bpPool = ['outdoor-scroll', 'outdoor-scroll', 'cave-system', 'floating-islands', 'forest-canopy', 'city-rooftops'];
			worldBlueprint = pick(bpPool, rng);
		}
	}

	return {
		seed,
		subGenre,
		theme,
		mechanicEmphasis,
		layoutStyle,
		difficultyProfile,
		atmosphere,
		enemyBehavior,
		levelShape,
		collectiblePattern,
		specialMechanic,
		artStyleDirection,
		gravity,
		moveSpeed,
		jumpForce,
		worldWidth,
		platformCount,
		enemyCount,
		coinCount,
		startSpeed,
		maxSpeed,
		spawnInterval,
		gridCols,
		gridRows,
		gemColorCount,
		fireRate,
		enemySpawnRate,
		waveCount,
		worldBlueprint,
	};
}

// ===== Creative brief prompt builder =====

export function buildCreativeBriefPrompt(brief: CreativeBrief): string {
	const themeFlavor = THEME_FLAVORS[brief.theme] || brief.theme;
	const mechanicFlavor =
		MECHANIC_FLAVORS[brief.mechanicEmphasis] || brief.mechanicEmphasis;
	const layoutFlavor =
		LAYOUT_FLAVORS[brief.layoutStyle] || brief.layoutStyle;
	const diffFlavor =
		DIFFICULTY_FLAVORS[brief.difficultyProfile] || brief.difficultyProfile;
	const atmosFlavor =
		ATMOSPHERE_FLAVORS[brief.atmosphere] || brief.atmosphere;
	const enemyFlavor =
		ENEMY_FLAVORS[brief.enemyBehavior] || brief.enemyBehavior;
	const specialFlavor =
		SPECIAL_MECHANIC_FLAVORS[brief.specialMechanic] ||
		brief.specialMechanic;

	let prompt = `## Creative Direction (Seed: ${brief.seed})

**Theme**: ${capitalize(brief.theme)} palette -- ${themeFlavor}
**Mechanic Focus**: ${formatLabel(brief.mechanicEmphasis)} -- ${mechanicFlavor}
**Layout**: ${formatLabel(brief.layoutStyle)} -- ${layoutFlavor}
**Difficulty**: ${formatLabel(brief.difficultyProfile)} -- ${diffFlavor}
**Atmosphere**: ${formatLabel(brief.atmosphere)} -- ${atmosFlavor}
**Enemy Style**: ${formatLabel(brief.enemyBehavior)} -- ${enemyFlavor}
**Level Shape**: ${formatLabel(brief.levelShape)}
**Collectibles**: ${formatLabel(brief.collectiblePattern)}
**Special Mechanic**: ${formatLabel(brief.specialMechanic)} -- ${specialFlavor}
**Art Direction**: ${formatLabel(brief.artStyleDirection)}
**World Blueprint**: ${brief.worldBlueprint} (this determines the world STRUCTURE -- cave, tower, islands, arena, etc.)
`;

	// Genre-specific numeric parameters
	if (brief.subGenre === "platformer") {
		prompt += `
### Numeric Parameters (use as CONFIG starting values)
- Gravity: ${brief.gravity} px/s^2
- Move Speed: ${brief.moveSpeed} px/s
- Jump Force: ${brief.jumpForce} px/s
- World Width: ${brief.worldWidth} px
- Platform Count: ${brief.platformCount}
- Enemy Count: ${brief.enemyCount}
- Coin Count: ${brief.coinCount}
- World Blueprint: ${brief.worldBlueprint} (already set in CONFIG.worldBlueprint — do NOT override unless user explicitly asks for a different world type)
`;
	} else if (brief.subGenre === "runner") {
		prompt += `
### Numeric Parameters (use as CONFIG starting values)
- Gravity: ${brief.gravity} px/s^2
- Start Speed: ${brief.startSpeed} px/s
- Max Speed: ${brief.maxSpeed} px/s
- Obstacle Spawn Interval: ${brief.spawnInterval}s
- Jump Force: ${brief.jumpForce} px/s
`;
	} else if (brief.subGenre === "puzzle") {
		prompt += `
### Numeric Parameters (use as CONFIG starting values)
- Grid: ${brief.gridCols} columns x ${brief.gridRows} rows
- Gem Colors: ${brief.gemColorCount}
`;
	} else if (brief.subGenre === "shooter") {
		prompt += `
### Numeric Parameters (use as CONFIG starting values)
- Fire Rate: ${brief.fireRate}s between shots
- Enemy Spawn Rate: ${brief.enemySpawnRate}s
- Wave Count: ${brief.waveCount}
- Move Speed: ${brief.moveSpeed} px/s
`;
	} else if (brief.subGenre === "rpg" || brief.subGenre === "topdown-adventure" || brief.subGenre === "twin-stick") {
		prompt += `
### Top-Down Game — 8-Directional Movement
**Genre**: 'top-down' (SET CONFIG.genre = 'top-down')
**Movement**: Player moves in ALL 8 directions (WASD/arrows). No gravity. No jumping.
**World Blueprint**: ${brief.worldBlueprint}
- Move Speed: ${brief.moveSpeed || 200} px/s
- World: ${brief.worldWidth || 1200} x ${brief.worldHeight || 900}
- Use Feature Bank feature 'player-topdown' instead of 'player-platformer'
`;
	}

	prompt += `
**IMPORTANT**: Use these parameters as your starting CONFIG values. Use \`var THEME = '${brief.theme}'\` for the palette. Make the game feel like this creative brief -- the theme, atmosphere, difficulty, and special mechanic should all be reflected in the code you write. Do NOT default to sunset/space/candy -- use the theme specified above.
`;

	return prompt;
}

// ===== String helpers =====

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatLabel(s: string): string {
	return s
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}
