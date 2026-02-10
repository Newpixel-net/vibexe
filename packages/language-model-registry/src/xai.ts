import * as z from "zod/v4";
import {
	type AnyLanguageModel,
	defineLanguageModel,
	definePricing,
	type LanguageModelProviderDefinition,
} from "./language-model";

const xaiProvider = {
	id: "xai",
	title: "xAI",
	metadata: {
		website: "https://x.ai",
		documentationUrl: "https://docs.x.ai",
	},
} as const satisfies LanguageModelProviderDefinition<"xai">;

export const xai = {
	"xai/grok-3": defineLanguageModel({
		provider: xaiProvider,
		id: "xai/grok-3",
		name: "Grok 3",
		description:
			"xAI's flagship reasoning model with strong performance across coding, math, and general knowledge tasks.",
		contextWindow: 131_072,
		maxOutputTokens: 32_768,
		knowledgeCutoff: new Date(2024, 10, 30).getTime(),
		pricing: {
			input: definePricing(3.0),
			output: definePricing(15.0),
		},
		requiredTier: "pro",
		configurationOptions: {
			temperature: {
				description: "Controls the randomness of the output.",
				schema: z.number().min(0).max(2),
				ui: { min: 0.0, max: 2.0, step: 0.1 },
			},
		},
		defaultConfiguration: {
			temperature: 0.7,
		},
		url: "https://docs.x.ai/developers/models",
	}),
	"xai/grok-3-mini": defineLanguageModel({
		provider: xaiProvider,
		id: "xai/grok-3-mini",
		name: "Grok 3 Mini",
		description:
			"A fast, lightweight reasoning model from xAI optimized for speed and cost efficiency.",
		contextWindow: 131_072,
		maxOutputTokens: 32_768,
		knowledgeCutoff: new Date(2024, 10, 30).getTime(),
		pricing: {
			input: definePricing(0.3),
			output: definePricing(0.5),
		},
		requiredTier: "free",
		configurationOptions: {
			temperature: {
				description: "Controls the randomness of the output.",
				schema: z.number().min(0).max(2),
				ui: { min: 0.0, max: 2.0, step: 0.1 },
			},
		},
		defaultConfiguration: {
			temperature: 0.7,
		},
		url: "https://docs.x.ai/developers/models",
	}),
} as const satisfies Record<string, AnyLanguageModel>;
