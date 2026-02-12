import * as z from "zod/v4";
import { ConditionGroup } from "./if-node";

export const SwitchRule = z.object({
	name: z.string(),
	conditionGroup: ConditionGroup,
	outputPortName: z.string(),
});
export type SwitchRule = z.infer<typeof SwitchRule>;

export const SwitchNodeContent = z.object({
	type: z.literal("switch"),
	mode: z.enum(["rules", "expression"]).default("rules"),
	rules: z.array(SwitchRule).default([]),
	expression: z.string().optional(),
	hasFallback: z.boolean().default(true),
});
export type SwitchNodeContent = z.infer<typeof SwitchNodeContent>;

export const SwitchNodeContentReference = z.object({
	type: SwitchNodeContent.shape.type,
});
export type SwitchNodeContentReference = z.infer<
	typeof SwitchNodeContentReference
>;
