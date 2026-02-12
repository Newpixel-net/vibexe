import { Background } from "@giselle-internal/workflow-designer-ui";
import { type Workspace, WorkspaceId } from "@giselles-ai/protocol";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { giselle } from "@/app/giselle";
import {
	agents,
	db,
	flowTriggers,
	scheduledWorkflows,
	webhookEndpoints,
	workspaces,
} from "@/db";
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

				// Persist schedule trigger to scheduled_workflows table
				if (flowTrigger.configuration.provider === "schedule") {
					const { cronExpression, timezone } =
						flowTrigger.configuration.event;
					const enabled = flowTrigger.configuration.enabled ?? false;
					const nextRunAt = enabled
						? calculateNextRun(cronExpression, timezone)
						: null;

					// Check if a schedule already exists for this workspace + node
					const [existing] = await db
						.select()
						.from(scheduledWorkflows)
						.where(
							and(
								eq(
									scheduledWorkflows.sdkWorkspaceId,
									flowTrigger.workspaceId,
								),
								eq(
									scheduledWorkflows.agentNodeId,
									flowTrigger.nodeId,
								),
							),
						)
						.limit(1);

					if (existing) {
						await db
							.update(scheduledWorkflows)
							.set({
								cronExpression,
								timezone,
								enabled,
								nextRunAt,
								sdkFlowTriggerId: flowTrigger.id,
							})
							.where(eq(scheduledWorkflows.dbId, existing.dbId));
					} else {
						await db.insert(scheduledWorkflows).values({
							teamDbId: workspace.teamDbId,
							sdkWorkspaceId: flowTrigger.workspaceId,
							agentNodeId: flowTrigger.nodeId,
							sdkFlowTriggerId: flowTrigger.id,
							cronExpression,
							timezone,
							enabled,
							nextRunAt,
						});
					}
					logger.info(
						`[Trigger] Schedule ${enabled ? "enabled" : "saved"}: workspace=${flowTrigger.workspaceId}, cron=${cronExpression}`,
					);
				}

				// Persist webhook trigger to webhook_endpoints table
				if (flowTrigger.configuration.provider === "webhook") {
					const { webhookPath, method } =
						flowTrigger.configuration.event;
					const enabled = flowTrigger.configuration.enabled ?? true;

					const [existing] = await db
						.select()
						.from(webhookEndpoints)
						.where(
							and(
								eq(
									webhookEndpoints.sdkWorkspaceId,
									flowTrigger.workspaceId,
								),
								eq(
									webhookEndpoints.agentNodeId,
									flowTrigger.nodeId,
								),
							),
						)
						.limit(1);

					if (existing) {
						await db
							.update(webhookEndpoints)
							.set({
								webhookPath,
								method,
								enabled,
								sdkFlowTriggerId: flowTrigger.id,
							})
							.where(eq(webhookEndpoints.dbId, existing.dbId));
					} else {
						await db.insert(webhookEndpoints).values({
							teamDbId: workspace.teamDbId,
							sdkWorkspaceId: flowTrigger.workspaceId,
							agentNodeId: flowTrigger.nodeId,
							sdkFlowTriggerId: flowTrigger.id,
							webhookPath,
							method,
							enabled,
						});
					}
					logger.info(
						`[Trigger] Webhook ${enabled ? "enabled" : "saved"}: workspace=${flowTrigger.workspaceId}, path=${webhookPath}`,
					);
				}

				// Persist app event trigger to webhook_endpoints table (reuses webhook infra)
				if (flowTrigger.configuration.provider === "appEvent") {
					const { webhookPath } =
						flowTrigger.configuration.event;
					const enabled = flowTrigger.configuration.enabled ?? true;

					const [existing] = await db
						.select()
						.from(webhookEndpoints)
						.where(
							and(
								eq(
									webhookEndpoints.sdkWorkspaceId,
									flowTrigger.workspaceId,
								),
								eq(
									webhookEndpoints.agentNodeId,
									flowTrigger.nodeId,
								),
							),
						)
						.limit(1);

					if (existing) {
						await db
							.update(webhookEndpoints)
							.set({
								webhookPath,
								method: "POST",
								enabled,
								sdkFlowTriggerId: flowTrigger.id,
							})
							.where(eq(webhookEndpoints.dbId, existing.dbId));
					} else {
						await db.insert(webhookEndpoints).values({
							teamDbId: workspace.teamDbId,
							sdkWorkspaceId: flowTrigger.workspaceId,
							agentNodeId: flowTrigger.nodeId,
							sdkFlowTriggerId: flowTrigger.id,
							webhookPath,
							method: "POST",
							enabled,
						});
					}
					logger.info(
						`[Trigger] App Event ${enabled ? "enabled" : "saved"}: workspace=${flowTrigger.workspaceId}, path=${webhookPath}`,
					);
				}
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

/**
 * Calculate the next run time from a cron expression.
 * Simple implementation supporting standard 5-field cron.
 */
function calculateNextRun(cronExpression: string, _timezone: string): Date {
	const now = new Date();
	const parts = cronExpression.split(" ");

	if (parts.length !== 5) {
		const next = new Date(now);
		next.setMinutes(0);
		next.setSeconds(0);
		next.setHours(next.getHours() + 1);
		return next;
	}

	const [minute, hour] = parts;

	// Every minute: * * * * *
	if (minute === "*" && hour === "*") {
		return new Date(now.getTime() + 60_000);
	}

	// Every N minutes: */N * * * *
	if (minute?.startsWith("*/") && hour === "*") {
		const interval = Number.parseInt(minute.slice(2), 10);
		if (!Number.isNaN(interval) && interval > 0) {
			return new Date(now.getTime() + interval * 60_000);
		}
	}

	// Fixed minute, every hour: N * * * *
	if (minute !== "*" && hour === "*") {
		const targetMinute = Number.parseInt(minute!, 10);
		const next = new Date(now);
		next.setSeconds(0);
		next.setMilliseconds(0);
		if (now.getMinutes() >= targetMinute) {
			next.setHours(next.getHours() + 1);
		}
		next.setMinutes(targetMinute);
		return next;
	}

	// Fixed time: M H * * *
	if (minute !== "*" && hour !== "*") {
		const targetMinute = Number.parseInt(minute!, 10);
		const targetHour = Number.parseInt(hour!, 10);
		const next = new Date(now);
		next.setSeconds(0);
		next.setMilliseconds(0);
		next.setMinutes(targetMinute);
		next.setHours(targetHour);
		if (next <= now) {
			next.setDate(next.getDate() + 1);
		}
		return next;
	}

	// Default fallback: 1 hour from now
	return new Date(now.getTime() + 3600_000);
}
