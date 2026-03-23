/**
 * Hugging Face Sprite Generator
 *
 * Calls the HF Inference API with gokaygokay/Flux-2D-Game-Assets-LoRA
 * to generate 2D game asset PNGs from text prompts. FREE via HF Spaces.
 *
 * Returns a PNG Buffer on success, null on failure (non-fatal).
 */

const HF_MODEL = "gokaygokay/Flux-2D-Game-Assets-LoRA";

/**
 * Generate a single 2D game sprite from a text prompt.
 * Returns PNG buffer or null if generation fails.
 */
export async function generateSprite(
	prompt: string,
): Promise<Buffer | null> {
	const hfToken = process.env.HF_TOKEN;
	if (!hfToken) {
		return null;
	}

	const enhancedPrompt = `${prompt}, high detailed, complete object, not cut off, white solid background`;

	try {
		const start = Date.now();

		// Use the HF Inference API directly via fetch
		const response = await fetch(
			`https://api-inference.huggingface.co/models/${HF_MODEL}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${hfToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					inputs: enhancedPrompt,
					parameters: { num_inference_steps: 30 },
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
