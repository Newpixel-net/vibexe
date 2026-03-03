import { type NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Animation Name Overrides API
 * Stores user-corrected animation clip names per model.
 * Keyed by model filename (e.g., "Warrior_figure_Animations").
 *
 * GET  → returns all overrides
 * POST → saves overrides for a model { model: string, overrides: Record<string, string> }
 *
 * Storage: JSON file at /opt/vibexe/data/animation-overrides.json
 */

const DATA_DIR = "/opt/vibexe/data";
const OVERRIDES_FILE = path.join(DATA_DIR, "animation-overrides.json");

async function loadOverrides(): Promise<Record<string, Record<string, string>>> {
	try {
		const raw = await readFile(OVERRIDES_FILE, "utf-8");
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

async function saveOverrides(data: Record<string, Record<string, string>>): Promise<void> {
	await mkdir(DATA_DIR, { recursive: true });
	await writeFile(OVERRIDES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET(request: NextRequest) {
	const model = request.nextUrl.searchParams.get("model");
	const all = await loadOverrides();

	if (model) {
		return NextResponse.json({ model, overrides: all[model] || {} });
	}
	return NextResponse.json(all);
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { model, overrides } = body as { model: string; overrides: Record<string, string> };

		if (!model || typeof model !== "string") {
			return NextResponse.json({ error: "model is required" }, { status: 400 });
		}
		if (!overrides || typeof overrides !== "object") {
			return NextResponse.json({ error: "overrides must be an object" }, { status: 400 });
		}

		const all = await loadOverrides();

		// Merge: remove entries where override === original (no-op), keep the rest
		const cleaned: Record<string, string> = {};
		for (const [original, display] of Object.entries(overrides)) {
			if (display && display !== original) {
				cleaned[original] = display;
			}
		}

		if (Object.keys(cleaned).length === 0) {
			delete all[model];
		} else {
			all[model] = cleaned;
		}

		await saveOverrides(all);
		return NextResponse.json({ ok: true, model, overrides: cleaned });
	} catch (err) {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}
}
