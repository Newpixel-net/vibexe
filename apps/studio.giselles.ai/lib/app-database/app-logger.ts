/**
 * App Logger — Runtime Event Logging
 *
 * Helper to log events to an app's _app_logs table.
 * All calls are fire-and-forget safe: logging errors
 * never crash the main operation.
 */

import { executeQuery } from "./pool-manager";

export async function logAppEvent(
	databaseName: string,
	entry: {
		level: "info" | "warning" | "error" | "debug";
		category: "api" | "auth" | "entity" | "system";
		eventType: string;
		message: string;
		userId?: number;
		userEmail?: string;
		metadata?: Record<string, unknown>;
	},
): Promise<void> {
	try {
		await executeQuery(
			databaseName,
			`INSERT INTO _app_logs (level, category, event_type, message, user_id, user_email, metadata)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[
				entry.level,
				entry.category,
				entry.eventType,
				entry.message,
				entry.userId ?? null,
				entry.userEmail ?? null,
				JSON.stringify(entry.metadata ?? {}),
			],
		);
	} catch (error) {
		// Don't let logging errors crash the main operation
		console.error("[App Logger] Failed to log event:", error);
	}
}
