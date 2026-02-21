/**
 * Template Queries
 *
 * Database operations for the app template system.
 * Handles publishing, updating, listing, and cloning templates.
 */

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
	type BuilderAppId,
	type BuilderAppTemplateId,
	type BuilderFileId,
	builderAppDatabases,
	builderApps,
	builderAppTemplates,
	builderFiles,
	users,
} from "@/db/schema";

export { TEMPLATE_CATEGORIES } from "./template-constants";
export type { TemplateCategory } from "./template-constants";

// ============================================================================
// Publish / Update / Delete
// ============================================================================

export async function publishTemplate(
	appId: string,
	teamDbId: number,
	userDbId: number,
	metadata: {
		name: string;
		description?: string;
		category?: string;
		tags?: string[];
		visibility?: string;
	},
) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true, visibility: true, requireLogin: true },
	});
	if (!app) throw new Error(`App not found: ${appId}`);

	// Check if already published
	const existing = await db.query.builderAppTemplates.findFirst({
		where: eq(builderAppTemplates.sourceAppDbId, app.dbId),
	});
	if (existing) throw new Error("App already published as template");

	// Snapshot current files
	const files = await db.query.builderFiles.findMany({
		where: eq(builderFiles.appDbId, app.dbId),
		columns: { path: true, content: true, language: true },
	});

	// Snapshot schema if app has a database
	const appDb = await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, app.dbId),
	});
	const schemaSnapshot = appDb?.schemaJson ?? null;
	const entityCount =
		schemaSnapshot &&
		typeof schemaSnapshot === "object" &&
		"entities" in schemaSnapshot &&
		Array.isArray((schemaSnapshot as { entities: unknown[] }).entities)
			? (schemaSnapshot as { entities: unknown[] }).entities.length
			: 0;

	const id = `btpl_${nanoid()}` as BuilderAppTemplateId;

	const [template] = await db
		.insert(builderAppTemplates)
		.values({
			id,
			sourceAppDbId: app.dbId,
			authorUserDbId: userDbId,
			teamDbId,
			name: metadata.name,
			description: metadata.description ?? null,
			category: metadata.category ?? "Other",
			tags: metadata.tags ?? [],
			filesSnapshot: files.map((f) => ({
				path: f.path,
				content: f.content ?? "",
				language: f.language ?? "plaintext",
			})),
			schemaSnapshot,
			appConfig: {
				visibility: app.visibility,
				requireLogin: app.requireLogin,
			},
			visibility: metadata.visibility ?? "public",
			fileCount: files.length,
			entityCount,
		})
		.returning();

	return template;
}

export async function updateTemplate(
	templateId: string,
	data: {
		name?: string;
		description?: string;
		category?: string;
		tags?: string[];
		visibility?: string;
	},
) {
	const updateData: Record<string, unknown> = {};
	if (data.name !== undefined) updateData.name = data.name;
	if (data.description !== undefined) updateData.description = data.description;
	if (data.category !== undefined) updateData.category = data.category;
	if (data.tags !== undefined) updateData.tags = data.tags;
	if (data.visibility !== undefined) updateData.visibility = data.visibility;

	if (Object.keys(updateData).length === 0) return null;

	const [updated] = await db
		.update(builderAppTemplates)
		.set(updateData)
		.where(eq(builderAppTemplates.id, templateId as BuilderAppTemplateId))
		.returning();

	return updated;
}

export async function deleteTemplate(templateId: string) {
	const [deleted] = await db
		.delete(builderAppTemplates)
		.where(eq(builderAppTemplates.id, templateId as BuilderAppTemplateId))
		.returning();
	return deleted;
}

export async function refreshTemplateSnapshot(
	templateId: string,
	appId: string,
) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true, visibility: true, requireLogin: true },
	});
	if (!app) throw new Error(`App not found: ${appId}`);

	const files = await db.query.builderFiles.findMany({
		where: eq(builderFiles.appDbId, app.dbId),
		columns: { path: true, content: true, language: true },
	});

	const appDb = await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, app.dbId),
	});
	const schemaSnapshot = appDb?.schemaJson ?? null;
	const entityCount =
		schemaSnapshot &&
		typeof schemaSnapshot === "object" &&
		"entities" in schemaSnapshot &&
		Array.isArray((schemaSnapshot as { entities: unknown[] }).entities)
			? (schemaSnapshot as { entities: unknown[] }).entities.length
			: 0;

	const [updated] = await db
		.update(builderAppTemplates)
		.set({
			filesSnapshot: files.map((f) => ({
				path: f.path,
				content: f.content ?? "",
				language: f.language ?? "plaintext",
			})),
			schemaSnapshot,
			appConfig: {
				visibility: app.visibility,
				requireLogin: app.requireLogin,
			},
			fileCount: files.length,
			entityCount,
		})
		.where(eq(builderAppTemplates.id, templateId as BuilderAppTemplateId))
		.returning();

	return updated;
}

// ============================================================================
// Read Queries
// ============================================================================

export async function getTemplateBySourceApp(appDbId: number) {
	return db.query.builderAppTemplates.findFirst({
		where: eq(builderAppTemplates.sourceAppDbId, appDbId),
	});
}

export async function getTemplateById(templateId: string) {
	return db.query.builderAppTemplates.findFirst({
		where: eq(builderAppTemplates.id, templateId as BuilderAppTemplateId),
	});
}

export async function getTemplateWithAuthor(templateId: string) {
	const template = await db.query.builderAppTemplates.findFirst({
		where: eq(builderAppTemplates.id, templateId as BuilderAppTemplateId),
	});
	if (!template) return null;

	let authorName: string | null = null;
	if (template.authorUserDbId) {
		const author = await db.query.users.findFirst({
			where: eq(users.dbId, template.authorUserDbId),
			columns: { displayName: true, email: true },
		});
		authorName = author?.displayName ?? author?.email ?? null;
	}

	return { ...template, authorName };
}

export async function listTemplates(filters: {
	category?: string;
	search?: string;
	teamDbId?: number;
	limit?: number;
	offset?: number;
}) {
	const conditions = [];

	// Visibility: public or same team
	if (filters.teamDbId) {
		conditions.push(
			or(
				eq(builderAppTemplates.visibility, "public"),
				eq(builderAppTemplates.teamDbId, filters.teamDbId),
			),
		);
	} else {
		conditions.push(eq(builderAppTemplates.visibility, "public"));
	}

	if (filters.category) {
		conditions.push(eq(builderAppTemplates.category, filters.category));
	}

	if (filters.search) {
		const searchPattern = `%${filters.search}%`;
		conditions.push(
			or(
				ilike(builderAppTemplates.name, searchPattern),
				ilike(builderAppTemplates.description, searchPattern),
			),
		);
	}

	const limit = filters.limit ?? 20;
	const offset = filters.offset ?? 0;

	const whereClause =
		conditions.length > 0 ? and(...conditions) : undefined;

	const templates = await db
		.select({
			dbId: builderAppTemplates.dbId,
			id: builderAppTemplates.id,
			name: builderAppTemplates.name,
			description: builderAppTemplates.description,
			category: builderAppTemplates.category,
			tags: builderAppTemplates.tags,
			visibility: builderAppTemplates.visibility,
			useCount: builderAppTemplates.useCount,
			fileCount: builderAppTemplates.fileCount,
			entityCount: builderAppTemplates.entityCount,
			authorUserDbId: builderAppTemplates.authorUserDbId,
			createdAt: builderAppTemplates.createdAt,
		})
		.from(builderAppTemplates)
		.where(whereClause)
		.orderBy(desc(builderAppTemplates.useCount))
		.limit(limit)
		.offset(offset);

	const [countResult] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(builderAppTemplates)
		.where(whereClause);

	return { templates, total: countResult?.count ?? 0 };
}

export async function incrementUseCount(templateDbId: number) {
	await db
		.update(builderAppTemplates)
		.set({ useCount: sql`${builderAppTemplates.useCount} + 1` })
		.where(eq(builderAppTemplates.dbId, templateDbId));
}

// ============================================================================
// Clone
// ============================================================================

export async function cloneTemplateToApp(
	templateDbId: number,
	teamDbId: number,
	userDbId: number,
	appName: string,
) {
	const template = await db.query.builderAppTemplates.findFirst({
		where: eq(builderAppTemplates.dbId, templateDbId),
	});
	if (!template) throw new Error("Template not found");

	// Create new app
	const newId = `bldr_${nanoid()}` as BuilderAppId;
	const [newApp] = await db
		.insert(builderApps)
		.values({
			id: newId,
			teamDbId,
			createdByUserDbId: userDbId,
			name: appName,
			description: template.description,
		})
		.returning();

	// Bulk-insert files from snapshot
	const filesSnapshot = template.filesSnapshot as Array<{
		path: string;
		content: string;
		language: string;
	}>;

	for (const file of filesSnapshot) {
		const fileId = `bldf_${nanoid()}` as BuilderFileId;
		await db.insert(builderFiles).values({
			id: fileId,
			appDbId: newApp.dbId,
			path: file.path,
			content: file.content,
			language: file.language,
		});
	}

	// Apply app config
	const appConfig = template.appConfig as {
		visibility?: string;
		requireLogin?: boolean;
	} | null;
	if (appConfig) {
		const configUpdate: Record<string, unknown> = {};
		if (appConfig.visibility) configUpdate.visibility = appConfig.visibility;
		if (appConfig.requireLogin !== undefined)
			configUpdate.requireLogin = appConfig.requireLogin;
		if (Object.keys(configUpdate).length > 0) {
			await db
				.update(builderApps)
				.set(configUpdate)
				.where(eq(builderApps.dbId, newApp.dbId));
		}
	}

	// Increment use count
	await incrementUseCount(template.dbId);

	return {
		app: newApp,
		schemaSnapshot: template.schemaSnapshot,
	};
}
