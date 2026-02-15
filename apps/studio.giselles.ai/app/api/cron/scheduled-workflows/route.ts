import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NodeId, type TaskId, WorkspaceId } from "@giselles-ai/protocol";
import { db } from "@/db";
import { agents, scheduledWorkflows } from "@/db/schema";
import { giselle } from "@/app/giselle";
import { and, eq, isNotNull, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bearerPrefix = "Bearer ";

const digest = (value: string) =>
	createHash("sha256").update(value, "utf8").digest();

const isAuthorized = (authHeader: string | null, secret: string) => {
	if (!authHeader?.startsWith(bearerPrefix)) {
		return false;
	}
	const providedSecret = authHeader.slice(bearerPrefix.length).trim();
	if (providedSecret.length === 0) {
		return false;
	}
	return timingSafeEqual(digest(secret), digest(providedSecret));
};

/**
 * GET /api/cron/scheduled-workflows
 *
 * Called by an external cron service (e.g., cron-job.org) every minute.
 * Finds all enabled scheduled workflows where nextRunAt <= now,
 * triggers their generation, and updates the next run time.
 */
export async function GET(request: NextRequest) {
	const cronSecret = process.env.CRON_SECRET ?? "";

	if (!cronSecret) {
		console.error("CRON_SECRET environment variable is not set");
		return new Response("Server misconfigured", { status: 500 });
	}

	const authHeader = request.headers.get("authorization");
	if (!isAuthorized(authHeader, cronSecret)) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const now = new Date();

		// Find all enabled schedules where nextRunAt <= now and agent is published
		const dueSchedules = await db
			.select({
				dbId: scheduledWorkflows.dbId,
				sdkWorkspaceId: scheduledWorkflows.sdkWorkspaceId,
				agentNodeId: scheduledWorkflows.agentNodeId,
				cronExpression: scheduledWorkflows.cronExpression,
				timezone: scheduledWorkflows.timezone,
				enabled: scheduledWorkflows.enabled,
				lastRunAt: scheduledWorkflows.lastRunAt,
				nextRunAt: scheduledWorkflows.nextRunAt,
			})
			.from(scheduledWorkflows)
			.innerJoin(agents, eq(agents.workspaceId, scheduledWorkflows.sdkWorkspaceId))
			.where(
				and(
					eq(scheduledWorkflows.enabled, true),
					lte(scheduledWorkflows.nextRunAt, now),
					eq(agents.isPublished, true),
				),
			);

		if (dueSchedules.length === 0) {
			return Response.json({ triggered: 0, message: "No schedules due" });
		}

		const results: Array<{
			dbId: number;
			workspaceId: string;
			status: "triggered" | "error";
			error?: string;
		}> = [];

		for (const schedule of dueSchedules) {
			try {
				// Calculate next run time based on cron expression
				const nextRun = calculateNextRun(
					schedule.cronExpression,
					schedule.timezone,
				);

				// Update last_run_at and next_run_at
				await db
					.update(scheduledWorkflows)
					.set({
						lastRunAt: now,
						nextRunAt: nextRun,
					})
					.where(eq(scheduledWorkflows.dbId, schedule.dbId));

				// Trigger the actual workflow generation
				const workspaceId = WorkspaceId.parse(schedule.sdkWorkspaceId);
				const nodeId = NodeId.parse(schedule.agentNodeId);
				await giselle.createAndStartTask({
					workspaceId,
					nodeId,
					inputs: [],
					generationOriginType: "api",
				});
				console.log(
					`[Scheduled Workflow] Triggered: workspace=${schedule.sdkWorkspaceId}, agent=${schedule.agentNodeId}, cron=${schedule.cronExpression}`,
				);

				results.push({
					dbId: schedule.dbId,
					workspaceId: schedule.sdkWorkspaceId,
					status: "triggered",
				});
			} catch (err) {
				console.error(
					`[Scheduled Workflow] Error triggering schedule ${schedule.dbId}:`,
					err,
				);
				results.push({
					dbId: schedule.dbId,
					workspaceId: schedule.sdkWorkspaceId,
					status: "error",
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		// --- Cleanup stuck "inProgress" tasks (>15 minutes old) ---
		let cleanedUp = 0;
		try {
			const STUCK_THRESHOLD_MS = 35 * 60 * 1000; // 35 minutes (waitUntilGenerationFinishes allows 30min)
			// Get all distinct workspace IDs from agents table
			const workspaces = await db
				.selectDistinct({ workspaceId: agents.workspaceId })
				.from(agents)
				.where(isNotNull(agents.workspaceId));

			for (const ws of workspaces) {
				if (!ws.workspaceId) continue;
				try {
					const tasks = await giselle.getWorkspaceTasks({
						workspaceId: ws.workspaceId,
					});
					for (const task of tasks) {
						if (
							task.status === "inProgress" &&
							Date.now() - task.createdAt > STUCK_THRESHOLD_MS
						) {
							await giselle.patchTask({
								taskId: task.id as TaskId,
								patches: [
									{ path: "status", set: "failed" },
									{
										path: "error",
										set: {
											name: "StuckTaskCleanup",
											message: `Task was stuck inProgress for >15 minutes and was auto-cancelled by cleanup cron`,
										},
									},
								],
							});
							cleanedUp++;
							console.log(
								`[Cleanup] Force-failed stuck task ${task.id} in workspace ${ws.workspaceId}`,
							);
						}
					}
				} catch (e) {
					// Skip workspaces that fail to load
				}
			}
		} catch (e) {
			console.error("[Cleanup] Error during stuck task cleanup:", e);
		}

		return Response.json({
			triggered: results.filter((r) => r.status === "triggered").length,
			errors: results.filter((r) => r.status === "error").length,
			cleanedUp,
			results,
		});
	} catch (err) {
		console.error("[Scheduled Workflow] Fatal error:", err);
		return new Response("Internal Server Error", { status: 500 });
	}
}

/**
 * Parse a cron field into a set of matching values.
 * Supports: *, N, N-M, N/step, star/step, comma-separated, and 0-based day-of-week.
 */
function parseCronField(
	field: string,
	min: number,
	max: number,
): Set<number> | null {
	if (field === "*") return null; // null means "any"
	const values = new Set<number>();
	for (const part of field.split(",")) {
		const trimmed = part.trim();
		// */N or N/step
		if (trimmed.includes("/")) {
			const [rangeStr, stepStr] = trimmed.split("/");
			const step = Number.parseInt(stepStr, 10);
			if (Number.isNaN(step) || step <= 0) continue;
			let start = min;
			let end = max;
			if (rangeStr !== "*") {
				if (rangeStr.includes("-")) {
					const [a, b] = rangeStr.split("-");
					start = Number.parseInt(a, 10);
					end = Number.parseInt(b, 10);
				} else {
					start = Number.parseInt(rangeStr, 10);
				}
			}
			for (let i = start; i <= end; i += step) values.add(i);
		} else if (trimmed.includes("-")) {
			// N-M range
			const [a, b] = trimmed.split("-");
			const rangeStart = Number.parseInt(a, 10);
			const rangeEnd = Number.parseInt(b, 10);
			for (let i = rangeStart; i <= rangeEnd; i++) values.add(i);
		} else {
			// Single value
			const v = Number.parseInt(trimmed, 10);
			if (!Number.isNaN(v)) values.add(v);
		}
	}
	return values.size > 0 ? values : null;
}

/**
 * Calculate the next run time from a standard 5-field cron expression.
 * Fields: minute hour dayOfMonth month dayOfWeek
 * Supports *, N, N-M, N/step, comma-separated values for all fields.
 * Timezone is not yet applied (all times are server-local / UTC).
 */
function calculateNextRun(cronExpression: string, _timezone: string): Date {
	const now = new Date();
	const parts = cronExpression.split(" ");

	if (parts.length !== 5) {
		// Invalid — fallback to 1 hour from now
		return new Date(now.getTime() + 3600_000);
	}

	const minuteSet = parseCronField(parts[0], 0, 59);
	const hourSet = parseCronField(parts[1], 0, 23);
	const domSet = parseCronField(parts[2], 1, 31);
	const monthSet = parseCronField(parts[3], 1, 12);
	const dowSet = parseCronField(parts[4], 0, 6); // 0=Sunday

	// Brute-force search starting from next minute, up to 400 days ahead
	const candidate = new Date(now);
	candidate.setSeconds(0);
	candidate.setMilliseconds(0);
	candidate.setMinutes(candidate.getMinutes() + 1);

	const maxIterations = 400 * 24 * 60; // ~400 days of minutes
	for (let i = 0; i < maxIterations; i++) {
		const m = candidate.getMinutes();
		const h = candidate.getHours();
		const dom = candidate.getDate();
		const month = candidate.getMonth() + 1; // 1-based
		const dow = candidate.getDay(); // 0=Sunday

		if (
			(minuteSet === null || minuteSet.has(m)) &&
			(hourSet === null || hourSet.has(h)) &&
			(domSet === null || domSet.has(dom)) &&
			(monthSet === null || monthSet.has(month)) &&
			(dowSet === null || dowSet.has(dow))
		) {
			return candidate;
		}

		candidate.setMinutes(candidate.getMinutes() + 1);
	}

	// Fallback if no match found within ~400 days
	return new Date(now.getTime() + 3600_000);
}
