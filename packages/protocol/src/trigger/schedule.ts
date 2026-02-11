import * as z from "zod/v4";

const Provider = z.literal("schedule");

export const ScheduleTriggerEvent = z.object({
	id: z.literal("schedule.cron"),
	cronExpression: z.string(),
	timezone: z.string().default("UTC"),
});
export type ScheduleTriggerEvent = z.infer<typeof ScheduleTriggerEvent>;

export const ScheduleTrigger = z.object({
	provider: Provider,
	event: ScheduleTriggerEvent,
	enabled: z.boolean().default(false),
});
export type ScheduleTrigger = z.infer<typeof ScheduleTrigger>;
