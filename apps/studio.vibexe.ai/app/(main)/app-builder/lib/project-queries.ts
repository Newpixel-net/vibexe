import { eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
	type BuilderApp,
	type BuilderAppId,
	type BuilderProjectId,
	builderApps,
	builderAppDatabases,
	builderFiles,
	builderProjects,
} from "@/db/schema";

export type EnrichedBuilderApp = BuilderApp & {
	project: { id: string; name: string } | null;
	fileCount: number;
	entityCount: number;
};

export async function getProjectsForTeam(teamDbId: number) {
	return await db.query.builderProjects.findMany({
		where: eq(builderProjects.teamDbId, teamDbId),
		orderBy: (projects, { desc }) => [desc(projects.updatedAt)],
		with: {
			apps: {
				columns: { id: true },
			},
		},
	});
}

export async function createProject(
	teamDbId: number,
	userDbId: number,
	name: string,
	description?: string,
) {
	const id = `bprj_${nanoid()}` as BuilderProjectId;
	const [project] = await db
		.insert(builderProjects)
		.values({
			id,
			teamDbId,
			createdByUserDbId: userDbId,
			name,
			description,
		})
		.returning();
	return project;
}

export async function renameProject(projectId: string, name: string) {
	const [updated] = await db
		.update(builderProjects)
		.set({ name })
		.where(eq(builderProjects.id, projectId as BuilderProjectId))
		.returning();
	return updated;
}

export async function deleteProject(projectId: string) {
	// First unlink all apps from this project
	const project = await db.query.builderProjects.findFirst({
		where: eq(builderProjects.id, projectId as BuilderProjectId),
		columns: { dbId: true },
	});
	if (project) {
		await db
			.update(builderApps)
			.set({ projectDbId: null })
			.where(eq(builderApps.projectDbId, project.dbId));
	}
	const [deleted] = await db
		.delete(builderProjects)
		.where(eq(builderProjects.id, projectId as BuilderProjectId))
		.returning();
	return deleted;
}

export async function moveAppToProject(
	appId: string,
	projectDbId: number | null,
) {
	const [updated] = await db
		.update(builderApps)
		.set({ projectDbId })
		.where(eq(builderApps.id, appId as BuilderAppId))
		.returning();
	return updated;
}

export async function getAppsForTeamGrouped(teamDbId: number) {
	const [projects, apps] = await Promise.all([
		db.query.builderProjects.findMany({
			where: eq(builderProjects.teamDbId, teamDbId),
			orderBy: (projects, { desc }) => [desc(projects.updatedAt)],
		}),
		db.query.builderApps.findMany({
			where: eq(builderApps.teamDbId, teamDbId),
			orderBy: (apps, { desc }) => [desc(apps.updatedAt)],
			with: {
				project: {
					columns: { id: true, name: true },
				},
			},
		}),
	]);

	// Batch-fetch file counts and entity counts for enriched cards
	const appDbIds = apps.map((a) => a.dbId);
	let fileCountMap = new Map<number, number>();
	let entityCountMap = new Map<number, number>();

	if (appDbIds.length > 0) {
		const [fileCounts, entityCounts] = await Promise.all([
			db
				.select({
					appDbId: builderFiles.appDbId,
					count: sql<number>`count(*)::int`,
				})
				.from(builderFiles)
				.where(inArray(builderFiles.appDbId, appDbIds))
				.groupBy(builderFiles.appDbId),
			db
				.select({
					appDbId: builderAppDatabases.appDbId,
					count: sql<number>`coalesce(jsonb_array_length(${builderAppDatabases.schemaJson}->'entities'), 0)::int`,
				})
				.from(builderAppDatabases)
				.where(inArray(builderAppDatabases.appDbId, appDbIds)),
		]);

		fileCountMap = new Map(fileCounts.map((r) => [r.appDbId, r.count]));
		entityCountMap = new Map(entityCounts.map((r) => [r.appDbId, r.count]));
	}

	// Enrich apps with counts
	const enrichedApps: EnrichedBuilderApp[] = apps.map((app) => ({
		...app,
		fileCount: fileCountMap.get(app.dbId) ?? 0,
		entityCount: entityCountMap.get(app.dbId) ?? 0,
	}));

	const projectApps = new Map<number, EnrichedBuilderApp[]>();
	const unorganizedApps: EnrichedBuilderApp[] = [];

	for (const app of enrichedApps) {
		if (app.projectDbId) {
			const existing = projectApps.get(app.projectDbId) || [];
			existing.push(app);
			projectApps.set(app.projectDbId, existing);
		} else {
			unorganizedApps.push(app);
		}
	}

	return {
		projects: projects.map((project) => ({
			...project,
			apps: projectApps.get(project.dbId) || [],
		})),
		unorganizedApps,
	};
}
