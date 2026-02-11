import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { scheduledWorkflows } from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";

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

		// Find all enabled schedules where nextRunAt <= now
		const dueSchedules = await db
			.select()
			.from(scheduledWorkflows)
			.where(
				and(
					eq(scheduledWorkflows.enabled, true),
					lte(scheduledWorkflows.nextRunAt, now),
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

				// TODO: Trigger the actual workflow generation
				// This would call giselle.runTask() or similar
				// For now, we just log and mark as triggered
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

		return Response.json({
			triggered: results.filter((r) => r.status === "triggered").length,
			errors: results.filter((r) => r.status === "error").length,
			results,
		});
	} catch (err) {
		console.error("[Scheduled Workflow] Fatal error:", err);
		return new Response("Internal Server Error", { status: 500 });
	}
}

/**
 * Calculate the next run time from a cron expression.
 * Simple implementation supporting standard 5-field cron.
 */
function calculateNextRun(cronExpression: string, _timezone: string): Date {
	// Simple next-minute calculation for common patterns
	const now = new Date();
	const parts = cronExpression.split(" ");

	if (parts.length !== 5) {
		// Default: next hour
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
		const targetMinute = Number.parseInt(minute, 10);
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
		const targetMinute = Number.parseInt(minute, 10);
		const targetHour = Number.parseInt(hour, 10);
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
