import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { requireAdmin } from "@/lib/admin-guard";

const CONFIG_PATH = "/opt/vibexe/media-stock/games/admin-config.json";

interface AdminConfig {
	disabledAssets: string[];
	notes: Record<string, string>;
}

async function loadConfig(): Promise<AdminConfig> {
	try {
		const raw = await readFile(CONFIG_PATH, "utf-8");
		return JSON.parse(raw) as AdminConfig;
	} catch {
		return { disabledAssets: [], notes: {} };
	}
}

async function saveConfig(config: AdminConfig): Promise<void> {
	await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export async function GET() {
	try {
		await requireAdmin();
	} catch {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const config = await loadConfig();
	return NextResponse.json(config);
}

export async function PUT(request: Request) {
	try {
		await requireAdmin();
	} catch {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = (await request.json()) as {
			togglePath?: string;
			disabledAssets?: string[];
			setNote?: { path: string; note: string };
		};

		const config = await loadConfig();

		if (body.togglePath) {
			const idx = config.disabledAssets.indexOf(body.togglePath);
			if (idx >= 0) {
				config.disabledAssets.splice(idx, 1);
			} else {
				config.disabledAssets.push(body.togglePath);
			}
		}

		if (body.disabledAssets) {
			config.disabledAssets = body.disabledAssets;
		}

		if (body.setNote) {
			if (body.setNote.note) {
				config.notes[body.setNote.path] = body.setNote.note;
			} else {
				delete config.notes[body.setNote.path];
			}
		}

		await saveConfig(config);
		return NextResponse.json(config);
	} catch {
		return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
	}
}
