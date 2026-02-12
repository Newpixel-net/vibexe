import * as z from "zod/v4";

export const ErrorTriggerNodeContent = z.object({
	type: z.literal("errorTrigger"),
});
export type ErrorTriggerNodeContent = z.infer<typeof ErrorTriggerNodeContent>;

export const ErrorTriggerNodeContentReference = z.object({
	type: ErrorTriggerNodeContent.shape.type,
});
export type ErrorTriggerNodeContentReference = z.infer<
	typeof ErrorTriggerNodeContentReference
>;
