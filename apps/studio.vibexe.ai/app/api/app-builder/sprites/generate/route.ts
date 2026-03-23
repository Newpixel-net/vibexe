/**
 * On-demand sprite generation API route.
 * POST /api/app-builder/sprites/generate
 *
 * Generates a single 2D game sprite using the Hugging Face Inference API
 * (Flux-2D-Game-Assets-LoRA model, FREE) and saves it to app storage.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { generateSprite } from "@/lib/hf-sprite-generator";
import { uploadFile } from "@/lib/app-storage/storage-manager";

export async function POST(request: NextRequest) {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!process.env.HF_TOKEN) {
		return NextResponse.json(
			{ error: "HF_TOKEN not configured on server" },
			{ status: 503 },
		);
	}

	let body: { appId?: string; prompt?: string; category?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { appId, prompt, category } = body;

	if (!appId || typeof appId !== "string") {
		return NextResponse.json({ error: "Missing appId" }, { status: 400 });
	}
	if (!prompt || typeof prompt !== "string" || prompt.length > 500) {
		return NextResponse.json(
			{ error: "Missing or invalid prompt (max 500 chars)" },
			{ status: 400 },
		);
	}

	try {
		const buffer = await generateSprite(prompt);
		if (!buffer) {
			return NextResponse.json(
				{ error: "Sprite generation failed — HF API may be unavailable" },
				{ status: 502 },
			);
		}

		const fileName = category || `custom_${Date.now()}`;
		const storagePath = `sprites/generated/${fileName}.png`;
		const result = await uploadFile(appId, storagePath, buffer, "image/png", {
			generator: "hf-flux-lora",
			prompt: prompt.slice(0, 200),
		});

		return NextResponse.json({
			url: result.url,
			path: result.path,
			size: result.size,
		});
	} catch (error) {
		console.error(
			"[Sprite API] Error:",
			error instanceof Error ? error.message : error,
		);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
