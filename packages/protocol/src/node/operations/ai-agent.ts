import {
	isLanguageModelId,
	isLanguageModelProvider,
	isLanguageModelToolName,
	type LanguageModelId,
	type LanguageModelProvider,
	type LanguageModelToolName,
} from "@giselles-ai/language-model-registry";
import * as z from "zod/v4";

export const AiAgentContent = z.object({
	type: z.literal("aiAgent"),
	version: z.literal("v1"),
	languageModel: z.object({
		provider: z.custom<LanguageModelProvider>((v) =>
			isLanguageModelProvider(v),
		),
		id: z.custom<LanguageModelId>(isLanguageModelId),
		configuration: z.record(z.string(), z.any()),
	}),
	tools: z.array(
		z.object({
			name: z.custom<LanguageModelToolName>(isLanguageModelToolName),
			configuration: z.record(z.string(), z.any()),
		}),
	),
	systemPrompt: z.string(),
	prompt: z.string(),
	maxSteps: z.number().default(30),
});

export type AiAgentContent = z.infer<typeof AiAgentContent>;

export const AiAgentContentReference = z.object({
	type: AiAgentContent.shape.type,
});
export type AiAgentContentReference = z.infer<typeof AiAgentContentReference>;
