/**
 * Webhook Retry — Up to 3 attempts with exponential backoff
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { builderAppWebhooks } from "@/db/schema";
import {
	executeWebhook,
	type WebhookRecord,
	type WebhookPayload,
} from "./executor";

const RETRY_DELAYS = [0, 2_000, 8_000]; // 0s, 2s, 8s

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a webhook with up to 3 retry attempts.
 * After final attempt, updates the webhook's delivery stats.
 */
export async function executeWithRetry(
	webhook: WebhookRecord,
	eventType: string,
	payload: WebhookPayload,
): Promise<void> {
	let lastSuccess = false;

	for (let i = 0; i < RETRY_DELAYS.length; i++) {
		if (i > 0) {
			await sleep(RETRY_DELAYS[i]);
		}

		const result = await executeWebhook(webhook, eventType, payload, i + 1);
		if (result.success) {
			lastSuccess = true;
			break;
		}
		lastSuccess = false;
	}

	// Update webhook stats
	try {
		if (lastSuccess) {
			await db
				.update(builderAppWebhooks)
				.set({
					lastDeliveryAt: new Date(),
					lastDeliveryOk: true,
					deliverySuccessCount: sql`COALESCE(${builderAppWebhooks.deliverySuccessCount}, 0) + 1`,
				})
				.where(eq(builderAppWebhooks.dbId, webhook.dbId));
		} else {
			await db
				.update(builderAppWebhooks)
				.set({
					lastDeliveryAt: new Date(),
					lastDeliveryOk: false,
					deliveryFailureCount: sql`COALESCE(${builderAppWebhooks.deliveryFailureCount}, 0) + 1`,
				})
				.where(eq(builderAppWebhooks.dbId, webhook.dbId));
		}
	} catch (e) {
		console.error("[Webhook] Failed to update stats:", e);
	}
}
