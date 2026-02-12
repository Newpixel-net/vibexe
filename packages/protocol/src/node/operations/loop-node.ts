import * as z from "zod/v4";

export const LoopNodeContent = z.object({
	type: z.literal("loop"),
	mode: z.enum(["forEach", "nTimes"]).default("forEach"),
	maxIterations: z.number().default(100),
	nTimes: z.number().optional(),
});
export type LoopNodeContent = z.infer<typeof LoopNodeContent>;

export const LoopNodeContentReference = z.object({
	type: LoopNodeContent.shape.type,
});
export type LoopNodeContentReference = z.infer<
	typeof LoopNodeContentReference
>;
