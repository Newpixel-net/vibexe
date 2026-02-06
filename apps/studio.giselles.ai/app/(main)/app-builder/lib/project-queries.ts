import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
	type BuilderAppId,
	type BuilderProjectId,
	builderApps,
	builderProjects,
} from "@/db/schema";

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

	const projectApps = new Map<number, typeof apps>();
	const unorganizedApps: typeof apps = [];

	for (const app of apps) {
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
