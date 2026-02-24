/**
 * Wiki Sync Engine
 *
 * Programmatic wiki page generator that runs after every generation round.
 * Replaces the old appendToDevLog() with a multi-page wiki system.
 *
 * Zero AI token cost — all pages generated programmatically.
 * Pages stored as regular files in builder_files table with docs/ prefix.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import type { AppSchema } from "@/lib/app-database/schema-types";
import { getFileByPath, getFilesForApp, saveFile } from "@/app/(main)/app-builder/lib/queries";
import { buildChangelog, type ChangelogEntry } from "./generators/changelog";
import { generateDataModel } from "./generators/data-model";
import { generateComponents } from "./generators/components";
import { generateArchitecture } from "./generators/architecture";
import { generateApiReference } from "./generators/api-reference";
import { generateReadme } from "./generators/readme";

export interface WikiChangeContext {
	category: string;
	userPrompt: string;
	filesChanged: string[];
	entitiesChanged?: string[];
}

/**
 * Main wiki sync function — called after every generation round.
 *
 * 1. Always updates CHANGELOG (replaces DEVLOG.md behavior)
 * 2. Updates DATA-MODEL.md if entity schema exists
 * 3. Updates COMPONENTS.md from TSX files
 * 4. Updates ARCHITECTURE.md from file structure
 * 5. Updates API-REFERENCE.md from SDK usage patterns
 * 6. Creates README.md on first run (migrates Blueprint.md if present)
 */
export async function syncWiki(
	appId: string,
	context: WikiChangeContext,
): Promise<void> {
	try {
		// Fetch all files for the app
		const allFiles = await getFilesForApp(appId);
		const fileEntries = allFiles.map((f) => ({
			path: f.path,
			content: f.content,
		}));

		// 1. CHANGELOG.md — always update (replaces DEVLOG.md)
		await updateChangelog(appId, context);

		// 2. docs/README.md — create if missing
		await ensureReadme(appId, fileEntries);

		// 3. docs/DATA-MODEL.md — update from entity schema
		await updateDataModel(appId);

		// 4. docs/COMPONENTS.md — update from TSX files
		const componentsContent = generateComponents(fileEntries);
		await saveFile(appId, "docs/COMPONENTS.md", componentsContent, "markdown");

		// 5. docs/ARCHITECTURE.md — update from file structure
		const archContent = generateArchitecture(fileEntries);
		await saveFile(appId, "docs/ARCHITECTURE.md", archContent, "markdown");

		// 6. docs/API-REFERENCE.md — update from SDK usage
		const apiContent = generateApiReference(fileEntries);
		await saveFile(appId, "docs/API-REFERENCE.md", apiContent, "markdown");
	} catch (error) {
		console.error("[Wiki Sync] Failed:", error);
	}
}

/**
 * Update docs/CHANGELOG.md with a new entry.
 */
async function updateChangelog(
	appId: string,
	context: WikiChangeContext,
): Promise<void> {
	const existing = await getFileByPath(appId, "docs/CHANGELOG.md");
	const entry: ChangelogEntry = {
		category: context.category,
		userPrompt: context.userPrompt,
		filesChanged: context.filesChanged,
		entitiesChanged: context.entitiesChanged,
	};
	const content = buildChangelog(existing?.content || null, entry);
	await saveFile(appId, "docs/CHANGELOG.md", content, "markdown");
}

/**
 * Create docs/README.md if it doesn't exist yet.
 * Migrates from Blueprint.md if present.
 */
async function ensureReadme(
	appId: string,
	files: { path: string; content: string | null }[],
): Promise<void> {
	const existingReadme = await getFileByPath(appId, "docs/README.md");
	if (existingReadme?.content) return; // Already exists

	const content = generateReadme(files);
	await saveFile(appId, "docs/README.md", content, "markdown");
}

/**
 * Update docs/DATA-MODEL.md from the app's entity schema.
 */
async function updateDataModel(appId: string): Promise<void> {
	try {
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) return;

		const appDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, app.dbId),
		});

		const schema = (appDb?.schemaJson as AppSchema | null) || null;
		const content = generateDataModel(schema);
		await saveFile(appId, "docs/DATA-MODEL.md", content, "markdown");
	} catch (error) {
		// Best-effort — app may not have a database yet
		console.error("[Wiki Sync] DATA-MODEL update failed:", error);
	}
}
