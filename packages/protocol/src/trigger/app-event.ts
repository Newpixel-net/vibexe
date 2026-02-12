import * as z from "zod/v4";

const Provider = z.literal("appEvent");

export const AppEventTriggerEvent = z.object({
	id: z.string(),
	webhookPath: z.string(),
	pieceName: z.string(),
	triggerName: z.string(),
});
export type AppEventTriggerEvent = z.infer<typeof AppEventTriggerEvent>;

export const AppEventTrigger = z.object({
	provider: Provider,
	event: AppEventTriggerEvent,
	enabled: z.boolean().default(true),
});
export type AppEventTrigger = z.infer<typeof AppEventTrigger>;
