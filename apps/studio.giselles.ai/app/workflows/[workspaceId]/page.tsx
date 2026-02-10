import { Background } from "@giselle-internal/workflow-designer-ui";
import { type Workspace, WorkspaceId } from "@giselles-ai/protocol";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { giselle } from "@/app/giselle";
import { agents, db, flowTriggers, workspaces } from "@/db";
import { generateContentNodeFlag } from "@/flags";
import { logger } from "@/lib/logger";
import { getGitHubIntegrationState } from "@/packages/lib/github";
import { dataLoader } from "./data-loader";
import { Page } from "./page.client";

function Loader() {
	return (
		<div className="h-screen w-full">
			<Background />
		</div>
	);
}

async function WorkflowContent({
	workspaceId,
}: { workspaceId: WorkspaceId }) {
	console.log(`[page.tsx] WorkflowContent START for ${workspaceId}`);
	const t0 = Date.now();

	const data = await dataLoader(workspaceId);
	console.log(`[page.tsx] dataLoader complete: ${Date.now() - t0}ms`);

	// Force plain-object serialization to prevent RSC streaming hangs
	// on non-serializable properties (Drizzle ORM records, Date objects, etc.)
	const safeData = JSON.parse(JSON.stringify(data));
	console.log(`[page.tsx] JSON serialization complete: ${Date.now() - t0}ms`);

	console.log(`[page.tsx] Returning <Page> component: ${Date.now() - t0}ms`);
	return (
		<Page
			data={safeData}
			integrationRefreshAction={async () => {
				"use server";

				const agent = await db.query.agents.findFirst({
					where: (agents, { eq }) => eq(agents.workspaceId, workspaceId),
				});
				if (agent === undefined) {
					logger.warn(`Agent not found for workspace ${workspaceId}`);
					return {};
				}
				return { github: await getGitHubIntegrationState(agent.dbId) };
			}}
			triggerUpdateAction={async (flowTrigger) => {
				"use server";

				const workspace = await db.query.workspaces.findFirst({
					where: (workspaces, { eq }) => eq(workspaces.id, workspaceId),
				});
				if (workspace === undefined) {
					logger.warn(`Workspace not found for workspaceId ${workspaceId}`);
					return;
				}
				await db
					.insert(flowTriggers)
					.values({
						teamDbId: workspace.teamDbId,
						sdkFlowTriggerId: flowTrigger.id,
						sdkWorkspaceId: flowTrigger.workspaceId,
						staged:
							flowTrigger.configuration.provider === "manual" &&
							flowTrigger.configuration.staged,
					})
					.onConflictDoUpdate({
						target: flowTriggers.dbId,
						set: {
							staged:
								flowTrigger.configuration.provider === "manual" &&
								flowTrigger.configuration.staged,
						},
					});
			}}
			workspaceNameUpdateAction={async (name: string) => {
				"use server";

				await db
					.update(agents)
					.set({ name })
					.where(eq(agents.workspaceId, workspaceId));
				await db
					.update(workspaces)
					.set({ name })
					.where(eq(workspaces.id, workspaceId));
			}}
			workspaceSaveAction={async (workspace: Workspace) => {
				"use server";

				await giselle.updateWorkspace(workspace);
			}}
		/>
	);
}

export default async function ({
	params,
}: {
	params: Promise<{
		workspaceId: string;
	}>;
}) {
	console.log("[page.tsx] Default export START");
	const { data: workspaceId, success } = WorkspaceId.safeParse(
		(await params).workspaceId,
	);
	if (!success) {
		logger.debug(params);
		return notFound();
	}

	console.log(`[page.tsx] workspaceId parsed: ${workspaceId}`);
	const useNewLanguageModel = await generateContentNodeFlag();
	console.log(
		`[page.tsx] generateContentNodeFlag: ${useNewLanguageModel}`,
	);
	if (useNewLanguageModel) {
		giselle.updateContext({ experimental_contentGenerationNode: true });
	}

	console.log("[page.tsx] Returning Suspense wrapper");
	return (
		<Suspense fallback={<Loader />}>
			<WorkflowContent workspaceId={workspaceId} />
		</Suspense>
	);
}
