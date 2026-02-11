import {
	isLanguageModelToolName,
	type LanguageModelToolName,
} from "@giselles-ai/language-model-registry";
import * as z from "zod/v4";

export const ToolNodeContent = z.object({
	type: z.literal("toolNode"),
	toolType: z.enum([
		"integration",
		"webSearch",
		"codeExecution",
		"httpRequest",
		"builtinTool",
	]),
	// For integration tools:
	pieceName: z.string().optional(),
	actionName: z.string().optional(),
	pieceVersion: z.string().optional(),
	// For built-in tools:
	builtinToolName: z
		.custom<LanguageModelToolName>(isLanguageModelToolName)
		.optional(),
	configuration: z.record(z.string(), z.any()),
	// For code execution tools:
	codeToolName: z.string().optional(),
	codeToolDescription: z.string().optional(),
	codeToolInputSchema: z.string().optional(),
	codeToolCode: z.string().optional(),
});

export type ToolNodeContent = z.infer<typeof ToolNodeContent>;

export const ToolNodeContentReference = z.object({
	type: ToolNodeContent.shape.type,
});
export type ToolNodeContentReference = z.infer<typeof ToolNodeContentReference>;
