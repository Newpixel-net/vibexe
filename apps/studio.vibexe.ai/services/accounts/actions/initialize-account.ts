"use server";

import { App, AppId, NodeId } from "@vibexe-ai/protocol";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { vibexe } from "@/app/vibexe";
import type { UserId } from "@/db";
import {
	agents,
	apps,
	db,
	teamMemberships,
	teams,
	users,
	workspaces,
} from "@/db";
import { isEmailFromRoute06 } from "@/lib/utils";
import { createTeamId } from "@/services/teams/utils";

export const initializeAccount = async (
	userId: UserId,
	email: string | null | undefined,
	avatarUrl?: string | null,
) => {
	const result = await db.transaction(async (tx) => {
		// Look up the existing user
		const [user] = await tx
			.select({ dbId: users.dbId, id: users.id })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		if (!user) {
			throw new Error(`User not found: ${userId}`);
		}

		const internalAccount = isEmailFromRoute06(email ?? "");
		const [team] = await tx
			.insert(teams)
			.values({
				id: createTeamId(),
				name: "My Project",
				plan: internalAccount ? "internal" : "free",
			})
			.returning({
				id: teams.dbId,
			});

		await tx.insert(teamMemberships).values({
			userDbId: user.dbId,
			teamDbId: team.id,
			role: "admin",
		});

		// create sample apps
		const sampleWorkspaceResults = await vibexe.createSampleWorkspaces();

		// Fetch template apps to copy their entry node information
		const templateWorkspaceIds = sampleWorkspaceResults.map(
			(result) => result.templateWorkspaceId,
		);
		const templateWorkspacesWithApps = await db.query.workspaces.findMany({
			where: (workspaces, { inArray }) =>
				inArray(workspaces.id, templateWorkspaceIds),
			with: {
				app: {
					columns: {
						id: true,
						appEntryNodeId: true,
						endNodeId: true,
					},
				},
			},
		});

		// Create a map from templateWorkspaceId to its app info
		const templateAppMap = new Map(
			templateWorkspacesWithApps
				.filter((w) => w.app !== null)
				.map((w) => [w.id, w.app]),
		);

		for (const result of sampleWorkspaceResults) {
			const { workspace, templateWorkspaceId, idMap } = result;
			const agentId = `agnt_${createId()}` as const;
			await tx.insert(agents).values({
				id: agentId,
				name: workspace.name,
				teamDbId: team.id,
				creatorDbId: user.dbId,
				workspaceId: workspace.id,
				metadata: { sample: true },
			});
			const [insertedWorkspace] = await tx
				.insert(workspaces)
				.values({
					id: workspace.id,
					name: workspace.name,
					teamDbId: team.id,
					creatorDbId: user.dbId,
					metadata: { sample: true },
				})
				.returning({ dbId: workspaces.dbId });

			// Create app record and JSON file if template has an app
			const templateAppInfo = templateAppMap.get(templateWorkspaceId);
			if (templateAppInfo) {
				const newEntryNodeId = idMap[templateAppInfo.appEntryNodeId];
				const newEndNodeId = templateAppInfo.endNodeId
					? (idMap[templateAppInfo.endNodeId] ?? null)
					: null;

				if (newEntryNodeId) {
					const newAppId = AppId.generate();

					// Insert DB record
					await tx.insert(apps).values({
						id: newAppId,
						appEntryNodeId: NodeId.parse(newEntryNodeId),
						endNodeId: newEndNodeId ? NodeId.parse(newEndNodeId) : null,
						teamDbId: team.id,
						workspaceDbId: insertedWorkspace.dbId,
					});

					// Get template app JSON and create new app JSON with mapped IDs
					const templateAppJson = await vibexe.getApp({
						appId: templateAppInfo.id,
					});

					// Create new app JSON with mapped node IDs and save directly to storage
					// (not using vibexe.saveApp() because it triggers appCreate callback which inserts DB record)
					const storage = vibexe.getContext().storage;
					const appPath = `apps/${newAppId}.json` as const;

					if (templateAppJson.state === "connected" && newEndNodeId) {
						await storage.setJson({
							path: appPath,
							schema: App,
							data: {
								id: newAppId,
								version: "v1",
								state: "connected",
								description: templateAppJson.description,
								parameters: templateAppJson.parameters,
								entryNodeId: NodeId.parse(newEntryNodeId),
								endNodeId: NodeId.parse(newEndNodeId),
								workspaceId: workspace.id,
							},
						});
					} else {
						await storage.setJson({
							path: appPath,
							schema: App,
							data: {
								id: newAppId,
								version: "v1",
								state: "disconnected",
								description: templateAppJson.description,
								parameters: templateAppJson.parameters,
								entryNodeId: NodeId.parse(newEntryNodeId),
								workspaceId: workspace.id,
							},
						});
					}
				}
			}
		}

		return { id: user.id };
	});
	return result;
};
