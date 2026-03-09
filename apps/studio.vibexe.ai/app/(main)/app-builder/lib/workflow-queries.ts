import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
	type BuilderAppId,
	type BuilderAppWorkflowId,
	builderAppWorkflows,
	builderApps,
	workspaces,
} from "@/db/schema";

/**
 * Get all workflows linked to a builder app
 */
export async function getWorkflowsForApp(appId: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});

	if (!app) return [];

	return db.query.builderAppWorkflows.findMany({
		where: eq(builderAppWorkflows.appDbId, app.dbId),
		with: {
			workspace: {
				columns: { id: true, name: true, updatedAt: true },
			},
		},
		orderBy: (links, { desc }) => [desc(links.createdAt)],
	});
}

/**
 * Attach a workflow (workspace) to a builder app
 */
export async function attachWorkflowToApp(
	appId: string,
	workspaceId: string,
	purpose?: string,
	label?: string,
) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});

	if (!app) throw new Error(`App not found: ${appId}`);

	// Verify workspace exists
	const workspace = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId as any),
		columns: { id: true },
	});

	if (!workspace) throw new Error(`Workflow not found: ${workspaceId}`);

	const id = `bawf_${nanoid()}` as BuilderAppWorkflowId;
	const [link] = await db
		.insert(builderAppWorkflows)
		.values({
			id,
			appDbId: app.dbId,
			workspaceId: workspaceId as any,
			purpose,
			label,
		})
		.returning();

	return link;
}

/**
 * Detach a workflow from a builder app.
 * Scopes the delete to the given app to prevent cross-app IDOR.
 */
export async function detachWorkflowFromApp(linkId: string, appId?: string) {
	// If appId provided, scope the delete to that app for safety
	if (appId) {
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) return null;

		const [deleted] = await db
			.delete(builderAppWorkflows)
			.where(
				and(
					eq(builderAppWorkflows.id, linkId as BuilderAppWorkflowId),
					eq(builderAppWorkflows.appDbId, app.dbId),
				),
			)
			.returning();
		return deleted;
	}

	const [deleted] = await db
		.delete(builderAppWorkflows)
		.where(eq(builderAppWorkflows.id, linkId as BuilderAppWorkflowId))
		.returning();

	return deleted;
}

/**
 * Get available workflows for a team (to show in "attach workflow" dialog)
 */
export async function getAvailableWorkflows(teamDbId: number) {
	return db.query.workspaces.findMany({
		where: eq(workspaces.teamDbId, teamDbId),
		columns: {
			id: true,
			name: true,
			updatedAt: true,
			createdAt: true,
		},
		orderBy: (w, { desc }) => [desc(w.updatedAt)],
	});
}
