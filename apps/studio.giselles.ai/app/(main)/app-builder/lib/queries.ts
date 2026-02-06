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
