/**
 * HF Sprite Batch Generator
 *
 * Generates a batch of 2D game sprites from a CreativeBrief using the
 * Hugging Face Inference API (Flux-2D-Game-Assets-LoRA). Saves results
 * to app storage via S3 and returns a map of category → accessible URL.
 *
 * Non-fatal: failures skip individual sprites silently. If HF_TOKEN is
 * not set or all generations fail, returns an empty map.
 */

import { buildAssetPrompts } from "@vibexe-ai/vibexe-engine";
import type { CreativeBrief } from "@vibexe-ai/vibexe-engine";
import { generateSprite } from "./hf-sprite-generator";
import { uploadFile } from "./app-storage/storage-manager";

// Generate only the most critical sprites to keep latency reasonable
const PRIORITY_CATEGORIES = [
	"player",
	"enemy_basic",
	"platform_default",
	"coin",
	"tree",
	"background_far",
] as const;

/**
 * Generate sprites for a 2D game based on its CreativeBrief.
 * Returns a map of { category: url } for successfully generated sprites.
 */
export async function generateSpritesBatch(
	brief: CreativeBrief,
	appId: string,
): Promise<Record<string, string>> {
	if (!process.env.HF_TOKEN) {
		return {};
	}

	const allPrompts = buildAssetPrompts(brief);
	const results: Record<string, string> = {};

	const start = Date.now();
	console.log(
		`[HF Batch] Generating ${PRIORITY_CATEGORIES.length} sprites for seed=${brief.seed}, theme=${brief.theme}`,
	);

	// Generate all sprites in parallel
	const tasks = PRIORITY_CATEGORIES.map(async (category) => {
		const prompt = allPrompts[category];
		if (!prompt) return;

		try {
			const buffer = await generateSprite(prompt);
			if (!buffer || buffer.length < 100) return; // Skip empty/invalid results

			const storagePath = `sprites/generated/${category}.png`;
			const result = await uploadFile(
				appId,
				storagePath,
				buffer,
				"image/png",
				{ generator: "hf-flux-lora", seed: String(brief.seed) },
			);

			results[category] = result.url;
		} catch (error) {
			console.warn(
				`[HF Batch] Failed to generate/save ${category}:`,
				error instanceof Error ? error.message : error,
			);
		}
	});

	await Promise.allSettled(tasks);

	const elapsed = Date.now() - start;
	console.log(
		`[HF Batch] Completed: ${Object.keys(results).length}/${PRIORITY_CATEGORIES.length} sprites in ${elapsed}ms`,
	);

	return results;
}
