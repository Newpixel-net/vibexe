/**
 * Spritesheet Import API
 *
 * GET  /api/app-builder/sprites/import?targetAppId=bldr_xxx
 *   Lists spritesheets from other projects in the same team.
 *
 * POST /api/app-builder/sprites/import
 *   Copies spritesheets from a source project to a target project.
 *
 * Auth: X-Vibexe-Api-Key header (admin) OR builder session (verifyAppAccess).
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps } from "@/db/schema";
import {
	listFiles,
	downloadFile,
	uploadFile,
} from "@/lib/app-storage/storage-manager";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function authenticate(
	req: NextRequest,
	appId: string,
): Promise<{ ok: true; teamDbId: number } | { ok: false; res: NextResponse }> {
	// 1. Admin API key
	const apiKey = req.headers.get("x-vibexe-api-key");
	if (apiKey && apiKey === process.env.VIBEXE_INTERNAL_API_KEY) {
		// Look up the team for the app so we can scope queries
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { teamDbId: true },
		});
		if (!app) {
			return {
				ok: false,
				res: NextResponse.json(
					{ error: "App not found" },
					{ status: 404 },
				),
			};
		}
		return { ok: true, teamDbId: app.teamDbId };
	}

	// 2. Builder session -- verifyAppAccess checks cookies + team membership
	try {
		const { teamDbId } = await verifyAppAccess(appId);
		return { ok: true, teamDbId };
	} catch {
		return {
			ok: false,
			res: NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			),
		};
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SheetInfo {
	name: string;
	modelName: string;
	animName: string;
	atlasUrl: string;
	metadataUrl: string;
}

/**
 * Parse spritesheet file listings into grouped sheet info.
 *
 * Expected storage layout per sheet:
 *   spritesheets/{modelName}/{animName}/sheet.png
 *   spritesheets/{modelName}/{animName}/sheet.json
 *
 * We group by model+anim and only include pairs that have at least the PNG.
 */
function parseSpriteFiles(
	appId: string,
	files: { path: string }[],
): SheetInfo[] {
	const map = new Map<string, { png?: string; json?: string }>();

	for (const f of files) {
		// path looks like "spritesheets/warrior/idle/sheet.png"
		const parts = f.path.split("/");
		if (parts.length < 4 || parts[0] !== "spritesheets") continue;

		const modelName = parts[1];
		const animName = parts[2];
		const fileName = parts[3];
		const key = `${modelName}/${animName}`;

		if (!map.has(key)) map.set(key, {});
		const entry = map.get(key)!;

		if (fileName === "sheet.png") entry.png = f.path;
		else if (fileName === "sheet.json") entry.json = f.path;
	}

	const sheets: SheetInfo[] = [];
	for (const [key, entry] of map) {
		if (!entry.png) continue; // need at least the atlas image

		const [modelName, animName] = key.split("/");
		sheets.push({
			name: `${modelName}_${animName}`,
			modelName,
			animName,
			atlasUrl: `/api/apps/${appId}/storage/${entry.png}`,
			metadataUrl: entry.json
				? `/api/apps/${appId}/storage/${entry.json}`
				: "",
		});
	}

	return sheets;
}

// ---------------------------------------------------------------------------
// GET -- List available spritesheets from sibling projects
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
	try {
		const url = new URL(req.url);
		const targetAppId = url.searchParams.get("targetAppId");

		if (!targetAppId) {
			return NextResponse.json(
				{ error: "Missing targetAppId query parameter" },
				{ status: 400 },
			);
		}

		const auth = await authenticate(req, targetAppId);
		if (!auth.ok) return auth.res;

		// Find all apps owned by the same team (except the target itself)
		const teamApps = await db.query.builderApps.findMany({
			where: eq(builderApps.teamDbId, auth.teamDbId),
			columns: { id: true, name: true },
		});

		const siblingApps = teamApps.filter((a) => a.id !== targetAppId);

		// For each sibling app, list spritesheet files
		const projects: {
			appId: string;
			name: string;
			sheetCount: number;
			sheets: SheetInfo[];
		}[] = [];

		for (const app of siblingApps) {
			try {
				const result = await listFiles(app.id, "spritesheets/", 200);
				if (result.files.length === 0) continue;

				const sheets = parseSpriteFiles(app.id, result.files);
				if (sheets.length === 0) continue;

				projects.push({
					appId: app.id,
					name: app.name,
					sheetCount: sheets.length,
					sheets,
				});
			} catch {
				// Skip apps that error (e.g. no storage configured)
				continue;
			}
		}

		return NextResponse.json({ projects });
	} catch (error) {
		console.error("[Sprites Import API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// ---------------------------------------------------------------------------
// POST -- Copy spritesheets from source to target project
// ---------------------------------------------------------------------------

interface ImportSheet {
	modelName: string;
	animName: string;
}

interface ImportBody {
	sourceAppId: string;
	targetAppId: string;
	sheets: ImportSheet[];
}

export async function POST(req: NextRequest) {
	try {
		const body: ImportBody = await req.json();
		const { sourceAppId, targetAppId, sheets } = body;

		if (!sourceAppId || !targetAppId || !Array.isArray(sheets) || sheets.length === 0) {
			return NextResponse.json(
				{ error: "Missing required fields: sourceAppId, targetAppId, sheets[]" },
				{ status: 400 },
			);
		}

		// Authenticate against the target app first
		const auth = await authenticate(req, targetAppId);
		if (!auth.ok) return auth.res;

		// Verify the source app belongs to the same team
		const sourceApp = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, sourceAppId as BuilderAppId),
			columns: { teamDbId: true },
		});

		if (!sourceApp) {
			return NextResponse.json(
				{ error: "Source app not found" },
				{ status: 404 },
			);
		}

		if (sourceApp.teamDbId !== auth.teamDbId) {
			return NextResponse.json(
				{ error: "Source app does not belong to the same team" },
				{ status: 403 },
			);
		}

		// Copy each requested sheet
		let imported = 0;
		const errors: string[] = [];

		for (const sheet of sheets) {
			const { modelName, animName } = sheet;

			if (!modelName || !animName) {
				errors.push(`Skipped invalid sheet entry (missing modelName or animName)`);
				continue;
			}

			const pngPath = `spritesheets/${modelName}/${animName}/sheet.png`;
			const jsonPath = `spritesheets/${modelName}/${animName}/sheet.json`;

			// Copy the atlas PNG
			try {
				const pngData = await downloadFile(sourceAppId, pngPath);
				await uploadFile(
					targetAppId,
					pngPath,
					pngData.data,
					pngData.contentType || "image/png",
				);
			} catch (err) {
				errors.push(
					`Failed to copy ${modelName}/${animName}/sheet.png: ${err instanceof Error ? err.message : "unknown error"}`,
				);
				continue; // skip the JSON too if PNG failed
			}

			// Copy the metadata JSON (optional -- don't fail the whole sheet if missing)
			try {
				const jsonData = await downloadFile(sourceAppId, jsonPath);
				await uploadFile(
					targetAppId,
					jsonPath,
					jsonData.data,
					jsonData.contentType || "application/json",
				);
			} catch {
				// JSON metadata is optional; the PNG is the important part
			}

			imported++;
		}

		return NextResponse.json({
			imported,
			total: sheets.length,
			errors: errors.length > 0 ? errors : undefined,
		});
	} catch (error) {
		console.error("[Sprites Import API] POST error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
