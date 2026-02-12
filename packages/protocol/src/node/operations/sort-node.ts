import * as z from "zod/v4";

export const SortKey = z.object({
	field: z.string(),
	direction: z.enum(["asc", "desc"]).default("asc"),
});
export type SortKey = z.infer<typeof SortKey>;

export const SortNodeContent = z.object({
	type: z.literal("sort"),
	sortKeys: z.array(SortKey).default([]),
});
export type SortNodeContent = z.infer<typeof SortNodeContent>;

export const SortNodeContentReference = z.object({
	type: SortNodeContent.shape.type,
});
export type SortNodeContentReference = z.infer<
	typeof SortNodeContentReference
>;
