/**
 * Webhook Dispatcher — Match events to webhooks and fire-and-forget
 *
 * Event types:
 *   entity.created:{entity}   entity.updated:{entity}   entity.deleted:{entity}
 *   user.signup               user.signin
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { builderAppWebhooks } from "@/db/schema";
import { executeWithRetry } from "./retry";
import type { WebhookPayload } from "./executor";

/**
 * Dispatch webhooks for a given event — fire-and-forget.
 *
 * @param appDbId   - The builder app's database ID (serial PK)
 * @param appId     - The builder app's public ID (bldr_xxx)
 * @param eventType - e.g. "entity.created", "user.signup"
 * @param entityName - Entity name for entity events, null for auth events
 * @param data      - The event payload data
 */
export function dispatchWebhooks(
	appDbId: number,
	appId: string,
	eventType: string,
	entityName: string | null,
	data: unknown,
): void {
	// Full event: "entity.created:tasks" or just "user.signup"
	const fullEvent = entityName ? `${eventType}:${entityName}` : eventType;

	const payload: WebhookPayload = {
		event: fullEvent,
		timestamp: new Date().toISOString(),
		app_id: appId,
		data: entityName
			? { entity: entityName, record: data }
			: { user: data },
	};

	// Fire-and-forget — never throws
	_dispatch(appDbId, fullEvent, eventType, payload).catch((e) =>
		console.error("[Webhook Dispatch] Error:", e),
	);
}

async function _dispatch(
	appDbId: number,
	fullEvent: string,
	baseEvent: string,
	payload: WebhookPayload,
): Promise<void> {
	// Fetch all enabled webhooks for this app
	const webhooks = await db.query.builderAppWebhooks.findMany({
		where: and(
			eq(builderAppWebhooks.appDbId, appDbId),
			eq(builderAppWebhooks.enabled, true),
		),
	});

	if (webhooks.length === 0) return;

	// Match: webhook subscribes to either the full event ("entity.created:tasks")
	// or the base event ("entity.created") as a wildcard
	const matched = webhooks.filter((wh) => {
		const events = wh.events as string[];
		return events.includes(fullEvent) || events.includes(baseEvent);
	});

	if (matched.length === 0) return;

	// Fire all matched webhooks concurrently (fire-and-forget per webhook)
	for (const wh of matched) {
		executeWithRetry(
			{
				dbId: wh.dbId,
				url: wh.url,
				secret: wh.secret,
				headers: wh.headers as Record<string, string> | null,
				timeoutMs: wh.timeoutMs ?? 10_000,
			},
			fullEvent,
			payload,
		).catch((e) =>
			console.error(`[Webhook] Delivery error for webhook ${wh.dbId}:`, e),
		);
	}
}
