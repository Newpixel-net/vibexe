import * as z from "zod/v4";

export const LimitNodeContent = z.object({
	type: z.literal("limit"),
	maxItems: z.number().int().min(0).default(10),
	keep: z.enum(["first", "last"]).default("first"),
});
export type LimitNodeContent = z.infer<typeof LimitNodeContent>;

export const LimitNodeContentReference = z.object({
	type: LimitNodeContent.shape.type,
});
export type LimitNodeContentReference = z.infer<
	typeof LimitNodeContentReference
>;
