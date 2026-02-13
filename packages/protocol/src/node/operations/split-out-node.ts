import * as z from "zod/v4";

export const SplitOutNodeContent = z.object({
	type: z.literal("splitOut"),
	fieldToSplit: z.string().default(""),
	includeOtherFields: z.boolean().default(true),
});
export type SplitOutNodeContent = z.infer<typeof SplitOutNodeContent>;

export const SplitOutNodeContentReference = z.object({
	type: SplitOutNodeContent.shape.type,
});
export type SplitOutNodeContentReference = z.infer<
	typeof SplitOutNodeContentReference
>;
