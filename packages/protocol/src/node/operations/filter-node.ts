import * as z from "zod/v4";
import { ConditionGroup } from "./if-node";

export const FilterNodeContent = z.object({
	type: z.literal("filter"),
	conditionGroup: ConditionGroup.default({
		conditions: [],
		combineWith: "and",
	}),
});
export type FilterNodeContent = z.infer<typeof FilterNodeContent>;

export const FilterNodeContentReference = z.object({
	type: FilterNodeContent.shape.type,
});
export type FilterNodeContentReference = z.infer<
	typeof FilterNodeContentReference
>;
