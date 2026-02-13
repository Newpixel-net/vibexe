import * as z from "zod/v4";

export const AggregateOperation = z.object({
	field: z.string(),
	operation: z.enum(["sum", "avg", "min", "max", "count", "countDistinct", "concatenate"]),
	resultField: z.string(),
	separator: z.string().optional(),
});
export type AggregateOperation = z.infer<typeof AggregateOperation>;

export const AggregateNodeContent = z.object({
	type: z.literal("aggregate"),
	operations: z.array(AggregateOperation).default([]),
	groupBy: z.array(z.string()).default([]),
});
export type AggregateNodeContent = z.infer<typeof AggregateNodeContent>;

export const AggregateNodeContentReference = z.object({
	type: AggregateNodeContent.shape.type,
});
export type AggregateNodeContentReference = z.infer<
	typeof AggregateNodeContentReference
>;
