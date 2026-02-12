import * as z from "zod/v4";

export const MergeNodeContent = z.object({
	type: z.literal("merge"),
	mode: z.enum(["waitAll", "waitAny", "append", "chooseBranch"]).default("chooseBranch"),
});
export type MergeNodeContent = z.infer<typeof MergeNodeContent>;

export const MergeNodeContentReference = z.object({
	type: MergeNodeContent.shape.type,
});
export type MergeNodeContentReference = z.infer<
	typeof MergeNodeContentReference
>;
