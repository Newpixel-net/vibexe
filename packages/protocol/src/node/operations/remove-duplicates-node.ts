import * as z from "zod/v4";

export const RemoveDuplicatesNodeContent = z.object({
	type: z.literal("removeDuplicates"),
	fields: z.array(z.string()).default([]),
	keepFirst: z.boolean().default(true),
});
export type RemoveDuplicatesNodeContent = z.infer<typeof RemoveDuplicatesNodeContent>;

export const RemoveDuplicatesNodeContentReference = z.object({
	type: RemoveDuplicatesNodeContent.shape.type,
});
export type RemoveDuplicatesNodeContentReference = z.infer<
	typeof RemoveDuplicatesNodeContentReference
>;
