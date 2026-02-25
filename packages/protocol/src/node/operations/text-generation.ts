import {
	AnthropicLanguageModel,
	FireworksLanguageModel,
	GoogleLanguageModel,
	NvidiaLanguageModel,
	OpenAILanguageModel,
	PerplexityLanguageModel,
	XaiLanguageModel,
} from "@vibexe-ai/language-model";
import * as z from "zod/v4";
import { SecretId } from "../../secret";

export const AnthropicLanguageModelData = AnthropicLanguageModel.pick({
	provider: true,
	id: true,
	configurations: true,
});
export type AnthropicLanguageModelData = z.infer<
	typeof AnthropicLanguageModelData
>;
export const GoogleLanguageModelData = GoogleLanguageModel.pick({
	provider: true,
	id: true,
	configurations: true,
});
export type GoogleLanguageModelData = z.infer<typeof GoogleLanguageModelData>;
export const OpenAILanguageModelData = OpenAILanguageModel.pick({
	provider: true,
	id: true,
	configurations: true,
});
export type OpenAILanguageModelData = z.infer<typeof OpenAILanguageModelData>;

export const PerplexityLanguageModelData = PerplexityLanguageModel.pick({
	provider: true,
	id: true,
	configurations: true,
});
export type PerplexityLanguageModelData = z.infer<
	typeof PerplexityLanguageModelData
>;

export const FireworksLanguageModelData = FireworksLanguageModel.pick({
	provider: true,
	id: true,
	configurations: true,
});
export type FireworksLanguageModelData = z.infer<
	typeof FireworksLanguageModelData
>;

export const NvidiaLanguageModelData = NvidiaLanguageModel.pick({
	provider: true,
	id: true,
	configurations: true,
});
export type NvidiaLanguageModelData = z.infer<typeof NvidiaLanguageModelData>;

export const XaiLanguageModelData = XaiLanguageModel.pick({
	provider: true,
	id: true,
	configurations: true,
});
export type XaiLanguageModelData = z.infer<typeof XaiLanguageModelData>;

export const TextGenerationLanguageModelProvider = z.enum([
	AnthropicLanguageModelData.shape.provider.value,
	FireworksLanguageModelData.shape.provider.value,
	GoogleLanguageModelData.shape.provider.value,
	NvidiaLanguageModelData.shape.provider.value,
	OpenAILanguageModelData.shape.provider.value,
	PerplexityLanguageModelData.shape.provider.value,
	XaiLanguageModelData.shape.provider.value,
]);
export type TextGenerationLanguageModelProvider = z.infer<
	typeof TextGenerationLanguageModelProvider
>;

export const TextGenerationLanguageModelData = z.discriminatedUnion(
	"provider",
	[
		AnthropicLanguageModelData,
		FireworksLanguageModelData,
		GoogleLanguageModelData,
		NvidiaLanguageModelData,
		OpenAILanguageModelData,
		PerplexityLanguageModelData,
		XaiLanguageModelData,
	],
);
export type TextGenerationLanguageModelData = z.infer<
	typeof TextGenerationLanguageModelData
>;
export function isTextGenerationLanguageModelData(
	data: unknown,
): data is TextGenerationLanguageModelData {
	return TextGenerationLanguageModelData.safeParse(data).success;
}

export const ToolAuthPat = z.object({
	type: z.literal("pat"),
	token: z.string(),
	userId: z.optional(z.string()),
});
const ToolAuthSecret = z.object({
	type: z.literal("secret"),
	secretId: SecretId.schema,
	userId: z.optional(z.string()),
});
export const GitHubTool = z.object({
	tools: z.string().array(),
	auth: z.discriminatedUnion("type", [ToolAuthPat, ToolAuthSecret]),
});
export type GitHubTool = z.infer<typeof GitHubTool>;

export const PostgresTool = z.object({
	tools: z.string().array(),
	secretId: SecretId.schema,
});
export type PostgresTool = z.infer<typeof PostgresTool>;

export const OpenAIWebSearchTool = z.object({
	searchContextSize: z.enum(["low", "medium", "high"]).default("medium"),
	userLocation: z
		.object({
			type: z.literal("approximate"),
			country: z.string().optional(),
			city: z.string().optional(),
			region: z.string().optional(),
			timezone: z.string().optional(),
		})
		.optional(),
});
export type OpenAIWebSearchTool = z.infer<typeof OpenAIWebSearchTool>;

export const AnthropicWebSearchTool = z.object({
	maxUses: z.number(),
	allowedDomains: z.string().array().optional(),
	blockedDomains: z.string().array().optional(),
});
export type AnthropicWebSearchTool = z.infer<typeof AnthropicWebSearchTool>;

export const ToolSet = z.object({
	github: z.optional(GitHubTool),
	postgres: z.optional(PostgresTool),
	openaiWebSearch: z.optional(OpenAIWebSearchTool),
	anthropicWebSearch: z.optional(AnthropicWebSearchTool),
});
export type ToolSet = z.infer<typeof ToolSet>;

export const TextGenerationContent = z.object({
	type: z.literal("textGeneration"),
	llm: TextGenerationLanguageModelData,
	prompt: z.string().optional(),
	tools: z.optional(ToolSet),
});
export type TextGenerationContent = z.infer<typeof TextGenerationContent>;

export const TextGenerationContentReference = z.object({
	type: TextGenerationContent.shape.type,
});
export type TextGenerationContentReference = z.infer<
	typeof TextGenerationContentReference
>;
