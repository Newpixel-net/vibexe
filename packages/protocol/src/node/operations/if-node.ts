import * as z from "zod/v4";

export const ConditionOperator = z.enum([
	"equals",
	"notEquals",
	"contains",
	"notContains",
	"greaterThan",
	"lessThan",
	"greaterThanOrEqual",
	"lessThanOrEqual",
	"isEmpty",
	"isNotEmpty",
	"isTrue",
	"isFalse",
	"regex",
	"startsWith",
	"endsWith",
]);
export type ConditionOperator = z.infer<typeof ConditionOperator>;

export const Condition = z.object({
	field: z.string(),
	operator: ConditionOperator,
	value: z.string().optional(),
});
export type Condition = z.infer<typeof Condition>;

export const ConditionGroup = z.object({
	conditions: z.array(Condition),
	combineWith: z.enum(["and", "or"]).default("and"),
});
export type ConditionGroup = z.infer<typeof ConditionGroup>;

export const IfNodeContent = z.object({
	type: z.literal("if"),
	conditionGroup: ConditionGroup.default({
		conditions: [],
		combineWith: "and",
	}),
});
export type IfNodeContent = z.infer<typeof IfNodeContent>;

export const IfNodeContentReference = z.object({
	type: IfNodeContent.shape.type,
});
export type IfNodeContentReference = z.infer<typeof IfNodeContentReference>;
