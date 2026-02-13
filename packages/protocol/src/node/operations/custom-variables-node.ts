import * as z from "zod/v4";

export const CustomVariablesNodeContent = z.object({
	type: z.literal("customVariables"),
	/** Which variables to inject (empty = all team variables) */
	variableKeys: z.array(z.string()).default([]),
	/** Prefix for output keys (e.g. "vars" → $vars.MY_KEY) */
	prefix: z.string().default("vars"),
});
export type CustomVariablesNodeContent = z.infer<
	typeof CustomVariablesNodeContent
>;

export const CustomVariablesNodeContentReference = z.object({
	type: CustomVariablesNodeContent.shape.type,
});
export type CustomVariablesNodeContentReference = z.infer<
	typeof CustomVariablesNodeContentReference
>;
