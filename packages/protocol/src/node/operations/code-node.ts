import * as z from "zod/v4";

export const CodeNodeContent = z.object({
	type: z.literal("code"),
	code: z.string().default("// Process items and return result\nreturn items;"),
	language: z.enum(["javascript"]).default("javascript"),
	timeout: z.number().default(10000),
});
export type CodeNodeContent = z.infer<typeof CodeNodeContent>;

export const CodeNodeContentReference = z.object({
	type: CodeNodeContent.shape.type,
});
export type CodeNodeContentReference = z.infer<
	typeof CodeNodeContentReference
>;
