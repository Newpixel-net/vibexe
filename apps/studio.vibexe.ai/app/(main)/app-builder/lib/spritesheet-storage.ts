/**
 * Spritesheet Storage — Upload and list generated spritesheets.
 *
 * Uses the existing /api/apps/{appId}/storage endpoint.
 * Spritesheets are stored under: spritesheets/{name}/sheet.png + sheet.json
 */

import type { SpritesheetJSON } from "./spritesheet-packer";

export interface StoredSpritesheet {
	name: string;
	atlasUrl: string;
	metadataUrl: string;
}

/**
 * Upload a generated spritesheet (atlas PNG + metadata JSON) to app storage.
 */
export async function uploadSpritesheet(
	appId: string,
	name: string,
	atlasBlob: Blob,
	metadata: SpritesheetJSON,
): Promise<StoredSpritesheet> {
	const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
	const basePath = `spritesheets/${safeName}`;

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

	return {
		name: safeName,
		atlasUrl: atlasData.url,
		metadataUrl: metaData.url,
	};
}

/**
 * List all spritesheets stored for an app.
 */
export async function listSpritesheets(
	appId: string,
): Promise<StoredSpritesheet[]> {
	const res = await fetch(
		`/api/apps/${appId}/storage?prefix=spritesheets/&limit=100`,
	);
	if (!res.ok) return [];

	const data = await res.json();
	const files: Array<{ path: string; url: string }> = data.files || [];

	// Group by spritesheet name (files come as spritesheets/{name}/sheet.png etc.)
	const sheets = new Map<
		string,
		{ atlasUrl?: string; metadataUrl?: string }
	>();

	for (const file of files) {
		const match = file.path.match(
			/^spritesheets\/([^/]+)\/(sheet\.png|sheet\.json)$/,
		);
		if (!match) continue;
		const name = match[1];
		const type = match[2];
		if (!sheets.has(name)) sheets.set(name, {});
		const entry = sheets.get(name)!;
		if (type === "sheet.png") entry.atlasUrl = file.url;
		if (type === "sheet.json") entry.metadataUrl = file.url;
	}

	const result: StoredSpritesheet[] = [];
	sheets.forEach((entry, name) => {
		if (entry.atlasUrl && entry.metadataUrl) {
			result.push({
				name,
				atlasUrl: entry.atlasUrl,
				metadataUrl: entry.metadataUrl,
			});
		}
	});

	return result;
}
