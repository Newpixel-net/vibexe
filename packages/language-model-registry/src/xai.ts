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

const xaiTemperature = {
	description: "Controls the randomness of the output.",
	schema: z.number().min(0).max(2),
	ui: { min: 0.0, max: 2.0, step: 0.1 },
} as const;

const xaiTopP = {
	description:
		"Nucleus sampling: only consider tokens with cumulative probability up to this value. Lower values make output more focused.",
	schema: z.number().min(0).max(1),
	ui: {
		label: "Top P",
		min: 0.0,
		max: 1.0,
		step: 0.05,
	},
} as const;

function xaiMaxTokens(max: number) {
	return {
		description:
			"Maximum number of tokens to generate. Leave at default for full model capability.",
		schema: z.number().min(1).max(max),
		ui: {
			label: "Max Tokens",
			min: 1,
			max,
			step: 1,
			component: "numberInput" as const,
		},
	};
}

export const xai = {
	"xai/grok-4-0709": defineLanguageModel({
		provider: xaiProvider,
		id: "xai/grok-4-0709",
		name: "Grok 4",
		description:
			"xAI's most capable flagship model with superior reasoning, coding, and math performance.",
		contextWindow: 256_000,
		maxOutputTokens: 32_768,
		knowledgeCutoff: new Date(2025, 6, 1).getTime(),
		pricing: {
			input: definePricing(3.0),
			output: definePricing(15.0),
		},
		requiredTier: "pro",
		configurationOptions: {
			temperature: xaiTemperature,
			maxTokens: xaiMaxTokens(32_768),
			topP: xaiTopP,
		},
		defaultConfiguration: {
			temperature: 0.7,
			maxTokens: 32_768,
			topP: 1.0,
		},
		url: "https://docs.x.ai/developers/models",
	}),
	"xai/grok-4-1-fast-reasoning": defineLanguageModel({
		provider: xaiProvider,
		id: "xai/grok-4-1-fast-reasoning",
		name: "Grok 4.1 Fast (Reasoning)",
		description:
			"Fast Grok 4.1 model with reasoning capabilities. 2M context window at extremely low cost.",
		contextWindow: 2_000_000,
		maxOutputTokens: 32_768,
		knowledgeCutoff: new Date(2025, 6, 1).getTime(),
		pricing: {
			input: definePricing(0.2),
			output: definePricing(0.5),
		},
		requiredTier: "free",
		configurationOptions: {
			temperature: xaiTemperature,
			maxTokens: xaiMaxTokens(32_768),
			topP: xaiTopP,
		},
		defaultConfiguration: {
			temperature: 0.7,
			maxTokens: 32_768,
			topP: 1.0,
		},
		url: "https://docs.x.ai/developers/models",
	}),
	"xai/grok-4-1-fast-non-reasoning": defineLanguageModel({
		provider: xaiProvider,
		id: "xai/grok-4-1-fast-non-reasoning",
		name: "Grok 4.1 Fast",
		description:
			"Fast Grok 4.1 model without reasoning overhead. 2M context window at extremely low cost.",
		contextWindow: 2_000_000,
		maxOutputTokens: 32_768,
		knowledgeCutoff: new Date(2025, 6, 1).getTime(),
		pricing: {
			input: definePricing(0.2),
			output: definePricing(0.5),
		},
		requiredTier: "free",
		configurationOptions: {
			temperature: xaiTemperature,
			maxTokens: xaiMaxTokens(32_768),
			topP: xaiTopP,
		},
		defaultConfiguration: {
			temperature: 0.7,
			maxTokens: 32_768,
			topP: 1.0,
		},
		url: "https://docs.x.ai/developers/models",
	}),
	"xai/grok-4-fast-reasoning": defineLanguageModel({
		provider: xaiProvider,
		id: "xai/grok-4-fast-reasoning",
		name: "Grok 4 Fast (Reasoning)",
		description:
			"Fast Grok 4 model with reasoning capabilities. 2M context window.",
		contextWindow: 2_000_000,
		maxOutputTokens: 32_768,
		knowledgeCutoff: new Date(2025, 6, 1).getTime(),
		pricing: {
			input: definePricing(0.2),
			output: definePricing(0.5),
		},
		requiredTier: "free",
		configurationOptions: {
			temperature: xaiTemperature,
			maxTokens: xaiMaxTokens(32_768),
			topP: xaiTopP,
		},
		defaultConfiguration: {
			temperature: 0.7,
			maxTokens: 32_768,
			topP: 1.0,
		},
		url: "https://docs.x.ai/developers/models",
	}),
	"xai/grok-4-fast-non-reasoning": defineLanguageModel({
		provider: xaiProvider,
		id: "xai/grok-4-fast-non-reasoning",
		name: "Grok 4 Fast",
		description:
			"Fast Grok 4 model without reasoning overhead. 2M context window.",
		contextWindow: 2_000_000,
		maxOutputTokens: 32_768,
		knowledgeCutoff: new Date(2025, 6, 1).getTime(),
		pricing: {
			input: definePricing(0.2),
			output: definePricing(0.5),
		},
		requiredTier: "free",
		configurationOptions: {
			temperature: xaiTemperature,
			maxTokens: xaiMaxTokens(32_768),
			topP: xaiTopP,
		},
		defaultConfiguration: {
			temperature: 0.7,
			maxTokens: 32_768,
			topP: 1.0,
		},
		url: "https://docs.x.ai/developers/models",
	}),
	"xai/grok-code-fast-1": defineLanguageModel({
		provider: xaiProvider,
		id: "xai/grok-code-fast-1",
		name: "Grok Code Fast",
		description:
			"Specialized Grok model optimized for code generation and programming tasks.",
		contextWindow: 256_000,
		maxOutputTokens: 32_768,
		knowledgeCutoff: new Date(2025, 6, 1).getTime(),
		pricing: {
			input: definePricing(0.2),
			output: definePricing(1.5),
		},
		requiredTier: "free",
		configurationOptions: {
			temperature: xaiTemperature,
			maxTokens: xaiMaxTokens(32_768),
			topP: xaiTopP,
		},
		defaultConfiguration: {
			temperature: 0.7,
			maxTokens: 32_768,
			topP: 1.0,
		},
		url: "https://docs.x.ai/developers/models",
	}),
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
			temperature: xaiTemperature,
			maxTokens: xaiMaxTokens(32_768),
			topP: xaiTopP,
		},
		defaultConfiguration: {
			temperature: 0.7,
			maxTokens: 32_768,
			topP: 1.0,
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
			temperature: xaiTemperature,
			maxTokens: xaiMaxTokens(32_768),
			topP: xaiTopP,
		},
		defaultConfiguration: {
			temperature: 0.7,
			maxTokens: 32_768,
			topP: 1.0,
		},
		url: "https://docs.x.ai/developers/models",
	}),
	"xai/grok-2-vision-1212": defineLanguageModel({
		provider: xaiProvider,
		id: "xai/grok-2-vision-1212",
		name: "Grok 2 Vision",
		description:
			"Grok 2 model with vision capabilities for understanding images and visual content.",
		contextWindow: 32_768,
		maxOutputTokens: 8_192,
		knowledgeCutoff: new Date(2024, 6, 1).getTime(),
		pricing: {
			input: definePricing(2.0),
			output: definePricing(10.0),
		},
		requiredTier: "pro",
		configurationOptions: {
			temperature: xaiTemperature,
			maxTokens: xaiMaxTokens(8_192),
			topP: xaiTopP,
		},
		defaultConfiguration: {
			temperature: 0.7,
			maxTokens: 8_192,
			topP: 1.0,
		},
		url: "https://docs.x.ai/developers/models",
	}),
} as const satisfies Record<string, AnyLanguageModel>;
