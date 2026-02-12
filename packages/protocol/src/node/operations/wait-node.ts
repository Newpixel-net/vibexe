import * as z from "zod/v4";

export const WaitNodeContent = z.object({
	type: z.literal("wait"),
	mode: z.enum(["fixedTime", "webhook", "approval"]).default("fixedTime"),
	delaySeconds: z.number().default(0),
	timeoutSeconds: z.number().default(86400),
});
export type WaitNodeContent = z.infer<typeof WaitNodeContent>;

export const WaitNodeContentReference = z.object({
	type: WaitNodeContent.shape.type,
});
export type WaitNodeContentReference = z.infer<
	typeof WaitNodeContentReference
>;
