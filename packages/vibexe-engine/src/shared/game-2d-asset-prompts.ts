/**
 * Game Asset MCP Integration — Maps CreativeBrief to Flux LoRA prompt strings.
 *
 * When the Game Asset MCP server is available (Hugging Face Spaces, FREE),
 * these prompts are used to generate 2D game asset PNGs via the
 * gokaygokay/Flux-2D-Game-Assets-LoRA model.
 *
 * Each prompt combines:
 * - Art style prefix (from brief.artStyleDirection)
 * - Theme prefix (from brief.theme)
 * - Asset-specific description
 *
 * The generated sprites integrate with the existing 3-tier fallback chain:
 * MCP sprites → sprite library → canvas 2D → PIXI.Graphics
 */

import type { CreativeBrief } from "./game-2d-seed";

const ART_STYLE_PREFIXES: Record<string, string> = {
	"cartoon-bold": "cartoon style, bold outlines, vibrant colors, ",
	"pixel-retro": "pixel art style, retro 16-bit, clean pixels, ",
	"painterly-soft": "watercolor style, soft edges, painterly texture, ",
	"neon-glow": "neon glowing, dark background, cyberpunk style, ",
};

const THEME_PREFIXES: Record<string, string> = {
	forest: "enchanted forest theme, green vegetation, ",
	sunset: "sunset theme, warm golden orange colors, ",
	space: "space theme, cosmic dark purple, starfield, ",
	volcanic: "volcanic theme, dark rocks, lava glow, ",
	candy: "candy theme, pastel colors, sugar coated, ",
	arctic: "arctic theme, ice and snow, frozen blue, ",
	dark: "dark gothic theme, shadowy, mysterious, ",
	ocean: "ocean theme, underwater blue-green, coral, ",
};

export interface AssetPromptMap {
	player: string;
	enemy_basic: string;
	enemy_flying: string;
	platform_default: string;
	platform_alt: string;
	coin: string;
	gem: string;
	heart: string;
	tree: string;
	bush: string;
	cloud: string;
	background_far: string;
	background_mid: string;
	rock: string;
	crate: string;
	sign: string;
}

/**
 * Build Flux LoRA prompt strings for each asset category based on the creative brief.
 * These prompts are designed for the gokaygokay/Flux-2D-Game-Assets-LoRA model.
 */
export function buildAssetPrompts(brief: CreativeBrief): AssetPromptMap {
	const style =
		ART_STYLE_PREFIXES[brief.artStyleDirection] ||
		ART_STYLE_PREFIXES["cartoon-bold"];
	const theme = THEME_PREFIXES[brief.theme] || THEME_PREFIXES["forest"];
	const base = `${style}${theme}`;

	return {
		player: `${base}2D game player character, hero, idle pose, side view, game asset, transparent background`,
		enemy_basic: `${base}2D game enemy creature, small monster, angry expression, side view, game asset, transparent background`,
		enemy_flying: `${base}2D game flying enemy, bat or bird creature, wings spread, game asset, transparent background`,
		platform_default: `${base}2D game platform block, ground tile, side view, tileable, game asset, transparent background`,
		platform_alt: `${base}2D game floating platform, mossy stone, side view, game asset, transparent background`,
		coin: `${base}2D game collectible coin, golden, shiny, front view, game asset, transparent background`,
		gem: `${base}2D game gem, crystal, sparkle effect, front view, game asset, transparent background`,
		heart: `${base}2D game heart icon, health pickup, red glowing, front view, game asset, transparent background`,
		tree: `${base}2D game tree, decorative, rounded canopy, game asset, transparent background`,
		bush: `${base}2D game bush, small rounded shrub, decorative, game asset, transparent background`,
		cloud: `${base}2D game cloud, puffy white, soft edges, game asset, transparent background`,
		background_far: `${base}2D game background, far mountains, parallax layer, wide landscape, game asset, transparent background`,
		background_mid: `${base}2D game background, hills, mid-ground parallax layer, game asset, transparent background`,
		rock: `${base}2D game rock, stone boulder, decorative, game asset, transparent background`,
		crate: `${base}2D game wooden crate, breakable box, game asset, transparent background`,
		sign: `${base}2D game wooden sign post, directional, game asset, transparent background`,
	};
}
