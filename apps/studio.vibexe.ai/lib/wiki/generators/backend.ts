/**
 * BACKEND.md Generator
 *
 * Documents backend functions (HTTP endpoints, entity hooks, cron triggers),
 * scheduled jobs, and app secrets (names only).
 */

import type { BuilderAppFunction } from "@/db/schema";

interface JobRow {
	name: string;
	cron_expression: string;
	function_name: string;
	enabled: boolean;
	retry_policy: unknown;
}

/**
 * Generate docs/BACKEND.md from backend functions and jobs data.
 */
export function generateBackend(
	functions: BuilderAppFunction[],
	jobs: JobRow[],
	secretNames: string[],
): string {
	const lines: string[] = [];
	lines.push("# Backend Configuration");
	lines.push("");

	if (functions.length === 0 && jobs.length === 0 && secretNames.length === 0) {
		lines.push("> No backend functions, jobs, or secrets configured yet.");
		return lines.join("\n");
	}

	// --- Backend Functions ---
	if (functions.length > 0) {
		lines.push("## Backend Functions");
		lines.push("");
		lines.push(`${functions.length} function${functions.length === 1 ? "" : "s"} registered.`);
		lines.push("");

		const httpFns = functions.filter((f) => f.triggerType === "http");
		const hookFns = functions.filter((f) => f.triggerType === "entity_hook");
		const cronFns = functions.filter((f) => f.triggerType === "scheduled");

		if (httpFns.length > 0) {
			lines.push("### HTTP Endpoints");
			lines.push("");
			lines.push("| Name | Method | Path | Enabled |");
			lines.push("|------|--------|------|---------|");
			for (const fn of httpFns) {
				const config = fn.triggerConfig as Record<string, unknown> | null;
				const method = (config?.method as string) || "POST";
				const path = (config?.path as string) || `/${fn.name}`;
				lines.push(`| ${fn.name} | ${method.toUpperCase()} | \`${path}\` | ${fn.enabled ? "Yes" : "No"} |`);
			}
			lines.push("");
		}

		if (hookFns.length > 0) {
			lines.push("### Entity Hooks");
			lines.push("");
			lines.push("| Name | Entity | Event | Enabled |");
			lines.push("|------|--------|-------|---------|");
			for (const fn of hookFns) {
				const config = fn.triggerConfig as Record<string, unknown> | null;
				const entity = (config?.entity as string) || "unknown";
				const event = (config?.event as string) || "unknown";
				lines.push(`| ${fn.name} | ${entity} | ${event} | ${fn.enabled ? "Yes" : "No"} |`);
			}
			lines.push("");
		}

		if (cronFns.length > 0) {
			lines.push("### Scheduled (Cron)");
			lines.push("");
			lines.push("| Name | Schedule | Enabled |");
			lines.push("|------|----------|---------|");
			for (const fn of cronFns) {
				const config = fn.triggerConfig as Record<string, unknown> | null;
				const cron = (config?.cron as string) || "—";
				lines.push(`| ${fn.name} | \`${cron}\` | ${fn.enabled ? "Yes" : "No"} |`);
			}
			lines.push("");
		}
	}

	// --- Scheduled Jobs ---
	if (jobs.length > 0) {
		lines.push("## Scheduled Jobs");
		lines.push("");
		lines.push("| Name | Cron | Function | Enabled | Retry Policy |");
		lines.push("|------|------|----------|---------|-------------|");
		for (const job of jobs) {
			const retry = job.retry_policy as Record<string, unknown> | null;
			const retryStr = retry
				? `max ${retry.maxRetries ?? 3}, backoff ${retry.backoffMultiplier ?? 2}x`
				: "default";
			lines.push(`| ${job.name} | \`${job.cron_expression}\` | ${job.function_name} | ${job.enabled ? "Yes" : "No"} | ${retryStr} |`);
		}
		lines.push("");
	}

	// --- Secrets ---
	if (secretNames.length > 0) {
		lines.push("## App Secrets");
		lines.push("");
		lines.push("> Secret values are never exposed. Only names are listed.");
		lines.push("");
		for (const name of secretNames) {
			lines.push(`- \`${name}\``);
		}
		lines.push("");
	}

	return lines.join("\n");
}
