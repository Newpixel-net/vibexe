// giselle-integration/lib/queries.ts
// Database queries for App Builder operations
//
// This file provides CRUD operations for builder_apps, builder_files,
// builder_chats, and builder_versions tables.
//
// Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/lib/queries.ts

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
	type BuilderAppId,
	type BuilderChatId,
	type BuilderFileId,
	type BuilderVersionId,
	builderApps,
	builderChats,
	builderFiles,
	builderVersions,
} from "@/db/schema";

// ============================================================================
// App Queries
// ============================================================================

/**
 * Get an app by ID with ownership verification
 * @param appId - The builder app ID (bldr_xxx)
 * @param userId - The user ID to verify ownership (via team membership)
 */
export async function getAppById(appId: string, _userId: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		with: {
			team: true,
		},
	});

	if (!app) return null;

	// TODO: Verify user is member of app.team
	// For now, return app if found (ownership check in API layer)
	return app;
}

/**
 * Get app by ID with files (internal, no ownership check)
 */
export async function getAppWithFiles(appId: string) {
	return await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		with: {
			files: true,
		},
	});
}

/**
 * Get all apps for a team by team dbId
 * Used by the app builder list page
 * @param teamDbId - The team's database ID (serial)
 */
export async function getAppsForTeam(teamDbId: number) {
	return await db.query.builderApps.findMany({
		where: eq(builderApps.teamDbId, teamDbId),
		orderBy: (apps, { desc }) => [desc(apps.updatedAt)],
	});
}

/**
 * Create a new builder app
 */
export async function createApp(
	teamDbId: number,
	userDbId: number,
	name: string,
	description?: string,
) {
	const id = `bldr_${nanoid()}` as BuilderAppId;

	const [app] = await db
		.insert(builderApps)
		.values({
			id,
			teamDbId,
			createdByUserDbId: userDbId,
			name,
			description,
		})
		.returning();

	return app;
}

/**
 * Delete a builder app and all its related data (files, chats, versions)
 */
export async function deleteApp(appId: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});

	if (!app) {
		throw new Error(`App not found: ${appId}`);
	}

	// Delete related data first (files, chats, versions)
	await db.delete(builderFiles).where(eq(builderFiles.appDbId, app.dbId));
	await db.delete(builderChats).where(eq(builderChats.appDbId, app.dbId));
	await db.delete(builderVersions).where(eq(builderVersions.appDbId, app.dbId));

	// Delete the app itself
	const [deleted] = await db
		.delete(builderApps)
		.where(eq(builderApps.id, appId as BuilderAppId))
		.returning();

	return deleted;
}

/**
 * Duplicate a builder app with all its files
 */
export async function duplicateApp(
	appId: string,
	teamDbId: number,
	userDbId: number,
) {
	const original = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
	});

	if (!original) {
		throw new Error(`App not found: ${appId}`);
	}

	// Create the new app
	const newId = `bldr_${nanoid()}` as BuilderAppId;
	const [newApp] = await db
		.insert(builderApps)
		.values({
			id: newId,
			teamDbId,
			createdByUserDbId: userDbId,
			name: `${original.name} (Copy)`,
			description: original.description,
			projectDbId: original.projectDbId,
		})
		.returning();

	// Copy files
	{
		const files = await db.query.builderFiles.findMany({
			where: eq(builderFiles.appDbId, original.dbId),
		});

		for (const file of files) {
			const fileId = `bldf_${nanoid()}` as BuilderFileId;
			await db.insert(builderFiles).values({
				id: fileId,
				appDbId: newApp.dbId,
				path: file.path,
				content: file.content,
				language: file.language,
			});
		}
	}

	return newApp;
}

// ============================================================================
// Share Queries
// ============================================================================

/**
 * Get an app by its share token (public, no auth required)
 */
export async function getAppByShareToken(token: string) {
	return await db.query.builderApps.findFirst({
		where: eq(builderApps.shareToken, token),
	});
}

/**
 * Get files for a shared app by share token (public, no auth required)
 */
export async function getFilesForSharedApp(token: string) {
	const app = await getAppByShareToken(token);
	if (!app) return null;

	const files = await db.query.builderFiles.findMany({
		where: eq(builderFiles.appDbId, app.dbId),
		orderBy: (files, { asc }) => [asc(files.path)],
	});

	return { app, files };
}

/**
 * Generate a share token for an app (or return existing one)
 */
export async function enableShare(appId: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
	});

	if (!app) throw new Error(`App not found: ${appId}`);

	if (app.shareToken) return app.shareToken;

	const token = nanoid(12);
	await db
		.update(builderApps)
		.set({ shareToken: token })
		.where(eq(builderApps.id, appId as BuilderAppId));

	return token;
}

/**
 * Revoke share access for an app
 */
export async function disableShare(appId: string) {
	await db
		.update(builderApps)
		.set({ shareToken: null })
		.where(eq(builderApps.id, appId as BuilderAppId));
}

// ============================================================================
// File Queries
// ============================================================================

/**
 * Get all files for an app
 */
export async function getFilesForApp(appId: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});

	if (!app) return [];

	return db.query.builderFiles.findMany({
		where: eq(builderFiles.appDbId, app.dbId),
		orderBy: (files, { asc }) => [asc(files.path)],
	});
}

/**
 * Get a single file by app ID and path
 */
export async function getFileByPath(appId: string, path: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});

	if (!app) return null;

	return db.query.builderFiles.findFirst({
		where: and(eq(builderFiles.appDbId, app.dbId), eq(builderFiles.path, path)),
	});
}

/**
 * Save a file (create or update)
 * Uses upsert pattern - creates if not exists, updates if exists
 */
export async function saveFile(
	appId: string,
	path: string,
	content: string,
	language?: string,
) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});

	if (!app) {
		throw new Error(`App not found: ${appId}`);
	}

	// Check if file exists
	const existing = await db.query.builderFiles.findFirst({
		where: and(eq(builderFiles.appDbId, app.dbId), eq(builderFiles.path, path)),
	});

	if (existing) {
		// Update existing file
		const [updated] = await db
			.update(builderFiles)
			.set({
				content,
				language: language || existing.language,
			})
			.where(eq(builderFiles.dbId, existing.dbId))
			.returning();
		return updated;
	} else {
		// Create new file
		const id = `bldf_${nanoid()}` as BuilderFileId;
		const [created] = await db
			.insert(builderFiles)
			.values({
				id,
				appDbId: app.dbId,
				path,
				content,
				language,
			})
			.returning();
		return created;
	}
}

/**
 * Delete a file by app ID and path
 */
export async function deleteFile(appId: string, path: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});

	if (!app) {
		throw new Error(`App not found: ${appId}`);
	}

	const [deleted] = await db
		.delete(builderFiles)
		.where(and(eq(builderFiles.appDbId, app.dbId), eq(builderFiles.path, path)))
		.returning();

	if (!deleted) {
		throw new Error(`File not found: ${path}`);
	}

	return deleted;
}

// ============================================================================
// Chat Queries
// ============================================================================

/**
 * Get chat for an app (creates if not exists)
 */
export async function getChatForApp(appId: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});

	if (!app) {
		throw new Error(`App not found: ${appId}`);
	}

	// Check for existing chat
	const existing = await db.query.builderChats.findFirst({
		where: eq(builderChats.appDbId, app.dbId),
	});

	if (existing) return existing;

	// Create new chat
	const id = `bldc_${nanoid()}` as BuilderChatId;
	const [chat] = await db
		.insert(builderChats)
		.values({
			id,
			appDbId: app.dbId,
			messages: [],
		})
		.returning();

	return chat;
}

/**
 * Save chat messages
 */
export async function saveChatMessages(chatId: string, messages: unknown[]) {
	const [updated] = await db
		.update(builderChats)
		.set({ messages })
		.where(eq(builderChats.id, chatId as BuilderChatId))
		.returning();

	return updated;
}

// ============================================================================
// Version Queries
// ============================================================================

/**
 * Create a version snapshot of current files
 */
export async function createVersion(appId: string, message: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});

	if (!app) {
		throw new Error(`App not found: ${appId}`);
	}

	// Get current files
	const files = await db.query.builderFiles.findMany({
		where: eq(builderFiles.appDbId, app.dbId),
		columns: {
			path: true,
			content: true,
			language: true,
		},
	});

	// Get latest version number
	const latestVersion = await db.query.builderVersions.findFirst({
		where: eq(builderVersions.appDbId, app.dbId),
		orderBy: (v, { desc }) => [desc(v.versionNumber)],
		columns: { versionNumber: true },
	});

	const nextVersionNumber = String(
		(Number(latestVersion?.versionNumber) || 0) + 1,
	);

	// Create version
	const id = `bldv_${nanoid()}` as BuilderVersionId;
	const [version] = await db
		.insert(builderVersions)
		.values({
			id,
			appDbId: app.dbId,
			versionNumber: nextVersionNumber,
			message,
			files: files.map((f) => ({
				path: f.path,
				content: f.content || "",
				language: f.language || "plaintext",
			})),
		})
		.returning();

	return version;
}

/**
 * Get versions for an app
 */
export async function getVersionsForApp(appId: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});

	if (!app) return [];

	return db.query.builderVersions.findMany({
		where: eq(builderVersions.appDbId, app.dbId),
		orderBy: (v, { desc }) => [desc(v.versionNumber)],
	});
}
