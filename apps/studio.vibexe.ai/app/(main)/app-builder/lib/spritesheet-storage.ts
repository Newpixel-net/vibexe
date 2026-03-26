/**
 * Spritesheet Storage — Upload and list generated spritesheets.
 *
 * Uses the existing /api/apps/{appId}/storage endpoint.
 * Spritesheets are stored under: spritesheets/{model}/{anim}/sheet.png + sheet.json
 */

import type { SpritesheetJSON } from "./spritesheet-packer";

export interface StoredSpritesheet {
	name: string;
	atlasUrl: string;
	metadataUrl: string;
	/** Model name extracted from storage path (e.g. "warrior") */
	modelName?: string;
	/** Animation name extracted from storage path (e.g. "idle") */
	animName?: string;
}

/**
 * Upload a generated spritesheet (atlas PNG + metadata JSON) to app storage.
 * Each animation gets its own subfolder: spritesheets/{model}/{anim}/
 */
export async function uploadSpritesheet(
	appId: string,
	modelName: string,
	animName: string,
	atlasBlob: Blob,
	metadata: SpritesheetJSON,
): Promise<StoredSpritesheet> {
	const safeModel = modelName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
	const safeAnim = animName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
	const basePath = `spritesheets/${safeModel}/${safeAnim}`;

	// Upload atlas PNG
	const atlasForm = new FormData();
	atlasForm.append(
		"file",
		new File([atlasBlob], "sheet.png", { type: "image/png" }),
	);
	atlasForm.append("path", `${basePath}/sheet.png`);

	const atlasRes = await fetch(`/api/apps/${appId}/storage`, {
		method: "POST",
		body: atlasForm,
	});
	if (!atlasRes.ok) {
		throw new Error(`Failed to upload atlas: ${atlasRes.status}`);
	}
	const atlasData = await atlasRes.json();

	// Upload metadata JSON (use text/plain since storage endpoint only allows text/*)
	const metaBlob = new Blob([JSON.stringify(metadata, null, 2)], {
		type: "text/plain",
	});
	const metaForm = new FormData();
	metaForm.append(
		"file",
		new File([metaBlob], "sheet.json", { type: "text/plain" }),
	);
	metaForm.append("path", `${basePath}/sheet.json`);

	const metaRes = await fetch(`/api/apps/${appId}/storage`, {
		method: "POST",
		body: metaForm,
	});
	if (!metaRes.ok) {
		throw new Error(`Failed to upload metadata: ${metaRes.status}`);
	}
	const metaData = await metaRes.json();

	// Append cache-buster so regenerated sheets always show fresh content
	const cb = `_t=${Date.now()}`;
	const bustUrl = (u: string) => u + (u.includes("?") ? "&" : "?") + cb;
	return {
		name: `${safeModel}_${safeAnim}`,
		atlasUrl: bustUrl(atlasData.url),
		metadataUrl: bustUrl(metaData.url),
	};
}

/**
 * List all spritesheets stored for an app.
 * Matches path: spritesheets/{model}/{anim}/sheet.png|sheet.json
 */
export async function listSpritesheets(
	appId: string,
): Promise<StoredSpritesheet[]> {
	const res = await fetch(
		`/api/apps/${appId}/storage?prefix=spritesheets/&limit=200`,
	);
	if (!res.ok) return [];

	const data = await res.json();
	const files: Array<{ path: string; url: string }> = data.files || [];

	// Group by model+anim name
	const sheets = new Map<
		string,
		{ atlasUrl?: string; metadataUrl?: string; modelName?: string; animName?: string }
	>();

	for (const file of files) {
		// Match both old format (spritesheets/{name}/sheet.png) and new (spritesheets/{model}/{anim}/sheet.png)
		const match = file.path.match(
			/^spritesheets\/([^/]+)\/([^/]+)\/(sheet\.png|sheet\.json)$/,
		);
		if (match) {
			const name = `${match[1]}_${match[2]}`;
			const type = match[3];
			if (!sheets.has(name)) sheets.set(name, { modelName: match[1], animName: match[2] });
			const entry = sheets.get(name)!;
			if (type === "sheet.png") entry.atlasUrl = file.url;
			if (type === "sheet.json") entry.metadataUrl = file.url;
			continue;
		}
		// Old format fallback
		const oldMatch = file.path.match(
			/^spritesheets\/([^/]+)\/(sheet\.png|sheet\.json)$/,
		);
		if (oldMatch) {
			const name = oldMatch[1];
			const type = oldMatch[2];
			if (!sheets.has(name)) sheets.set(name, { modelName: name, animName: "" });
			const entry = sheets.get(name)!;
			if (type === "sheet.png") entry.atlasUrl = file.url;
			if (type === "sheet.json") entry.metadataUrl = file.url;
		}
	}

	const result: StoredSpritesheet[] = [];
	sheets.forEach((entry, name) => {
		if (entry.atlasUrl && entry.metadataUrl) {
			result.push({
				name,
				atlasUrl: entry.atlasUrl,
				metadataUrl: entry.metadataUrl,
				modelName: entry.modelName,
				animName: entry.animName,
			});
		}
	});

	return result;
}

/**
 * Delete a spritesheet (atlas PNG + metadata JSON) from app storage.
 * Uses the model/anim path structure: spritesheets/{model}/{anim}/
 */
export async function deleteSpritesheet(
	appId: string,
	modelName: string,
	animName: string,
): Promise<boolean> {
	const basePath = animName
		? `spritesheets/${modelName}/${animName}`
		: `spritesheets/${modelName}`;

	const [pngRes, jsonRes] = await Promise.all([
		fetch(`/api/apps/${appId}/storage/${basePath}/sheet.png`, { method: "DELETE" }),
		fetch(`/api/apps/${appId}/storage/${basePath}/sheet.json`, { method: "DELETE" }),
	]);

	return pngRes.ok && jsonRes.ok;
}
