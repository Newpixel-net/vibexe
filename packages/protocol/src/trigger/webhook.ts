import { createIdGenerator } from "@vibexe-ai/utils";
import * as z from "zod/v4";

export const WebhookPathId = createIdGenerator("whk");

export const WebhookTriggerEvent = z.object({
	id: z.literal("webhook.http.received"),
	webhookPath: z.string(),
	method: z.enum(["GET", "POST"]).default("POST"),
});
export type WebhookTriggerEvent = z.infer<typeof WebhookTriggerEvent>;

export const WebhookTrigger = z.object({
	provider: z.literal("webhook"),
	event: WebhookTriggerEvent,
	enabled: z.boolean().default(true),
});
export type WebhookTrigger = z.infer<typeof WebhookTrigger>;
