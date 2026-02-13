import * as z from "zod/v4";

export const SummarizeNodeContent = z.object({
	type: z.literal("summarize"),
	fields: z.array(z.string()).default([]),
	operations: z.array(z.enum(["count", "sum", "avg", "min", "max", "median", "mode", "stddev"])).default(["count", "sum", "avg", "min", "max"]),
});
export type SummarizeNodeContent = z.infer<typeof SummarizeNodeContent>;

export const SummarizeNodeContentReference = z.object({
	type: SummarizeNodeContent.shape.type,
});
export type SummarizeNodeContentReference = z.infer<
	typeof SummarizeNodeContentReference
>;
