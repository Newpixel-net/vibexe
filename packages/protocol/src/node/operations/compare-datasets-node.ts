import * as z from "zod/v4";

export const CompareDatasetsNodeContent = z.object({
	type: z.literal("compareDatasets"),
	mergeByFields: z.array(z.string()).default([]),
	mode: z.enum(["allMatches", "firstMatchOnly"]).default("allMatches"),
});
export type CompareDatasetsNodeContent = z.infer<typeof CompareDatasetsNodeContent>;

export const CompareDatasetsNodeContentReference = z.object({
	type: CompareDatasetsNodeContent.shape.type,
});
export type CompareDatasetsNodeContentReference = z.infer<
	typeof CompareDatasetsNodeContentReference
>;
