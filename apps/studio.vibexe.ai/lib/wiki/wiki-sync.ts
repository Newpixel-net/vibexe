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
import {
	type BuilderAppId,
	builderApps,
	builderAppDatabases,
	builderAppFunctions,
	builderAppAuthSettings,
	builderAppEntityPolicies,
	builderAppStorageSettings,
	builderAppIntegrations,
	builderDeployments,
	builderAppEnvironments,
	builderAppSecrets,
} from "@/db/schema";
import type { AppSchema } from "@/lib/app-database/schema-types";
import { getFileByPath, getFilesForApp, saveFile } from "@/app/(main)/app-builder/lib/queries";
import { buildChangelog, type ChangelogEntry } from "./generators/changelog";
import { generateDataModel } from "./generators/data-model";
import { generateComponents } from "./generators/components";
import { generateArchitecture } from "./generators/architecture";
import { generateApiReference } from "./generators/api-reference";
import { generateReadme } from "./generators/readme";
import { generateBackend } from "./generators/backend";
import { generateSecurity } from "./generators/security";
import { generateDeployment } from "./generators/deployment";

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
 * 7. Updates BACKEND.md from functions, jobs, and secrets
 * 8. Updates SECURITY.md from auth settings and entity policies
 * 9. Updates DEPLOYMENT.md from deployment, storage, and integrations
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

		// 7. docs/BACKEND.md — functions, jobs, secrets
		await updateBackend(appId);

		// 8. docs/SECURITY.md — auth & access policies
		await updateSecurity(appId);

		// 9. docs/DEPLOYMENT.md — deployment, storage, integrations, environments
		await updateDeployment(appId);
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

/**
 * Update docs/BACKEND.md from functions, jobs, and secrets.
 */
async function updateBackend(appId: string): Promise<void> {
	try {
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) return;

		// Fetch functions
		const functions = await db.query.builderAppFunctions.findMany({
			where: eq(builderAppFunctions.appDbId, app.dbId),
		});

		// Fetch secrets (names only)
		const secrets = await db.query.builderAppSecrets.findMany({
			where: eq(builderAppSecrets.appDbId, app.dbId),
			columns: { key: true },
		});
		const secretNames = secrets.map((s) => s.key);

		// Fetch scheduled jobs from the per-app database (best-effort)
		let jobs: { name: string; cron_expression: string; function_name: string; enabled: boolean; retry_policy: unknown }[] = [];
		try {
			const appDb = await db.query.builderAppDatabases.findFirst({
				where: eq(builderAppDatabases.appDbId, app.dbId),
				columns: { databaseName: true },
			});
			if (appDb?.databaseName) {
				const { queryAppDb } = await import("@/lib/app-database/pool-manager") as any;
				jobs = await queryAppDb(appDb.databaseName,
					`SELECT name, cron_expression, function_name, enabled, retry_policy FROM _app_scheduled_jobs ORDER BY name`,
				);
			}
		} catch {
			// Table may not exist yet — best-effort
		}

		const content = generateBackend(functions, jobs, secretNames);
		await saveFile(appId, "docs/BACKEND.md", content, "markdown");
	} catch (error) {
		console.error("[Wiki Sync] BACKEND update failed:", error);
	}
}

/**
 * Update docs/SECURITY.md from auth settings and entity policies.
 */
async function updateSecurity(appId: string): Promise<void> {
	try {
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) return;

		// Fetch auth settings
		const authRow = await db.query.builderAppAuthSettings.findFirst({
			where: eq(builderAppAuthSettings.appDbId, app.dbId),
		});
		const auth = authRow
			? {
					emailPasswordEnabled: authRow.emailPasswordEnabled,
					googleEnabled: authRow.googleEnabled,
					githubEnabled: authRow.githubEnabled,
					microsoftEnabled: authRow.microsoftEnabled,
					appleEnabled: authRow.appleEnabled,
					requireApproval: authRow.requireApproval,
				}
			: null;

		// Fetch entity policies
		const policyRows = await db.query.builderAppEntityPolicies.findMany({
			where: eq(builderAppEntityPolicies.appDbId, app.dbId),
		});
		const policies = policyRows.map((p) => ({
			entityName: p.entityName,
			readAccess: p.readAccess,
			writeAccess: p.writeAccess,
			deleteAccess: p.deleteAccess,
			ownerField: p.ownerField,
			allowedRoles: p.allowedRoles,
		}));

		const content = generateSecurity(auth, policies);
		await saveFile(appId, "docs/SECURITY.md", content, "markdown");
	} catch (error) {
		console.error("[Wiki Sync] SECURITY update failed:", error);
	}
}

/**
 * Update docs/DEPLOYMENT.md from deployment, storage, integrations, and environments.
 */
async function updateDeployment(appId: string): Promise<void> {
	try {
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) return;

		// Fetch latest deployment
		const deployRow = await db.query.builderDeployments.findFirst({
			where: eq(builderDeployments.appDbId, app.dbId),
		});
		const deployment = deployRow
			? {
					subdomain: deployRow.subdomain,
					customDomain: deployRow.customDomain,
					deployedAt: deployRow.deployedAt,
				}
			: null;

		// Fetch storage settings
		const storageRow = await db.query.builderAppStorageSettings.findFirst({
			where: eq(builderAppStorageSettings.appDbId, app.dbId),
		});
		const storage = storageRow
			? {
					accessLevel: storageRow.accessLevel,
					maxFileSizeMb: storageRow.maxFileSizeMb,
					storageQuotaMb: storageRow.storageQuotaMb,
					allowedTypes: storageRow.allowedTypes,
				}
			: null;

		// Fetch integrations
		const integrationRows = await db.query.builderAppIntegrations.findMany({
			where: eq(builderAppIntegrations.appDbId, app.dbId),
		});
		const integrations = integrationRows.map((i) => ({
			pieceName: i.pieceName,
			displayName: i.displayName,
			status: i.status,
		}));

		// Fetch environments (table may not exist yet — best-effort)
		let environments: { name: string; databaseName: string | null; status: string | null }[] = [];
		try {
			const envRows = await db.query.builderAppEnvironments.findMany({
				where: eq(builderAppEnvironments.appDbId, app.dbId),
			});
			environments = envRows.map((e) => ({
				name: e.environment,
				databaseName: e.databaseName,
				status: e.status,
			}));
		} catch {
			// Table may not exist yet
		}

		const content = generateDeployment(deployment, storage, integrations, environments);
		await saveFile(appId, "docs/DEPLOYMENT.md", content, "markdown");
	} catch (error) {
		console.error("[Wiki Sync] DEPLOYMENT update failed:", error);
	}
}
