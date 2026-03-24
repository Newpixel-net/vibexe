/**
 * Scene Generator — fetches base scene templates from Feature Bank
 * and replaces __PLACEHOLDER__ tokens with Creative Brief params.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { featureBankSnippets } from "@/db/schema";

// All gem color options for puzzle scenes
const ALL_GEM_COLORS = [0xff4466, 0x44aaff, 0x44dd44, 0xffaa22, 0xcc44ff, 0x44ffdd, 0xff8844];

/**
 * Fetch a base scene template from Feature Bank by genre and replace
 * placeholder tokens with actual parameter values.
 */
export async function generateBaseScene(
	genre: string,
	params: Record<string, any>,
	featureFactories?: string,
	featureRegistrations?: string,
	customCode?: string,
): Promise<string> {
	const templateId = `${genre}-base`;

	const [template] = await db
		.select()
		.from(featureBankSnippets)
		.where(eq(featureBankSnippets.id, templateId));

	if (!template) {
		// Fallback to platformer-base
		const [fallback] = await db
			.select()
			.from(featureBankSnippets)
			.where(eq(featureBankSnippets.id, "platformer-base"));
		if (!fallback) throw new Error("No base scene template found in Feature Bank");
		return replaceAllTokens(fallback.code, params, featureFactories, featureRegistrations, customCode);
	}

	return replaceAllTokens(template.code, params, featureFactories, featureRegistrations, customCode);
}

function replaceAllTokens(
	code: string,
	params: Record<string, any>,
	featureFactories?: string,
	featureRegistrations?: string,
	customCode?: string,
): string {
	let result = code;

	// Replace standard parameter tokens
	const tokenMap: Record<string, any> = {
		__THEME__: params.theme ?? "forest",
		__SEED__: params.seed ?? 1234,
		__GRAVITY__: params.gravity ?? 980,
		__MOVE_SPEED__: params.moveSpeed ?? 280,
		__JUMP_FORCE__: params.jumpForce ?? 520,
		__WORLD_WIDTH__: params.worldWidth ?? 4000,
		__ENEMY_SPEED__: params.enemySpeed ?? 60,
		__LIVES__: params.lives ?? 3,
		__PLATFORM_COUNT__: params.platformCount ?? 11,
		__COIN_COUNT__: params.coinCount ?? 27,
		__ENEMY_COUNT__: params.enemyCount ?? 6,
		__LEVEL_SHAPE__: params.levelShape ?? "flat-wide",
		__DOUBLE_JUMP__: params.doubleJump ?? true,
		__WALL_SLIDE__: params.wallSlide ?? false,
		// Runner-specific
		__START_SPEED__: params.startSpeed ?? 220,
		__MAX_SPEED__: params.maxSpeed ?? 550,
		// Puzzle-specific
		__GRID_COLS__: params.gridCols ?? 7,
		__GRID_ROWS__: params.gridRows ?? 7,
		__GEM_COLORS__: JSON.stringify(ALL_GEM_COLORS.slice(0, params.gemColorCount ?? 6)),
		// Shooter-specific
		__FIRE_RATE__: params.fireRate ?? 0.14,
		__ENEMY_SPAWN_RATE__: params.enemySpawnRate ?? 1.4,
	};

	for (const [token, value] of Object.entries(tokenMap)) {
		result = result.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), String(value));
	}

	// Replace Feature Bank injection points
	result = result.replace("__FEATURE_FACTORIES__", featureFactories || "");
	result = result.replace("__FEATURE_REGISTRATIONS__", featureRegistrations ? `    ${featureRegistrations}` : "");
	result = result.replace("__CUSTOM_CODE__", customCode ? `    ${customCode}` : "");

	return result;
}
