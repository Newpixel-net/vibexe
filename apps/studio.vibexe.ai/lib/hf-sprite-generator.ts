/**
 * Hugging Face Sprite Generator
 *
 * Calls FLUX.1-schnell via HF Inference API (FREE, ~4s per image)
 * to generate 2D game asset PNGs from text prompts.
 *
 * Returns a PNG/JPEG Buffer on success, null on failure (non-fatal).
 */

// FLUX.1-schnell: free, fast (~4s), good quality for game assets.
const HF_MODEL = "black-forest-labs/FLUX.1-schnell";

/**
 * Generate a single 2D game sprite from a text prompt.
 * Returns image buffer or null if generation fails.
 */
export async function generateSprite(
	prompt: string,
): Promise<Buffer | null> {
	const hfToken = process.env.HF_TOKEN;
	if (!hfToken) {
		return null;
	}

	// Enhance prompt for game asset quality
	const enhancedPrompt = `2D game asset sprite, ${prompt}, high detail, complete object centered, isolated on plain white background, clean edges, digital art style`;

	try {
		const start = Date.now();

		const response = await fetch(
			`https://router.huggingface.co/hf-inference/models/${HF_MODEL}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${hfToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					inputs: enhancedPrompt,
					parameters: { num_inference_steps: 4 },
				}),
			},
		);

		if (!response.ok) {
			const errText = await response.text().catch(() => "");
			console.warn(
				`[HF Sprite] Generation failed (${response.status}): ${errText.slice(0, 200)}`,
			);
			return null;
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const elapsed = Date.now() - start;
		console.log(
			`[HF Sprite] Generated "${prompt.slice(0, 50)}..." (${buffer.length} bytes, ${elapsed}ms)`,
		);

		return buffer;
	} catch (error) {
		console.warn(
			`[HF Sprite] Error generating sprite:`,
			error instanceof Error ? error.message : error,
		);
		return null;
	}
}
