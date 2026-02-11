import * as z from "zod/v4";
import {
	type AnyLanguageModel,
	defineLanguageModel,
	definePricing,
	type LanguageModelProviderDefinition,
} from "./language-model";

const nvidiaProvider = {
	id: "nvidia",
	title: "NVIDIA NIM",
	metadata: {
		website: "https://build.nvidia.com",
		documentationUrl: "https://docs.api.nvidia.com",
	},
} as const satisfies LanguageModelProviderDefinition<"nvidia">;

export const nvidia = {
	"nvidia/moonshotai/kimi-k2.5": defineLanguageModel({
		provider: nvidiaProvider,
		id: "nvidia/moonshotai/kimi-k2.5",
		name: "Kimi K2.5",
		description:
			"Moonshot AI's flagship MoE model (1T params, 32B activated) with multimodal vision, reasoning, and coding capabilities via NVIDIA NIM.",
		contextWindow: 256_000,
		maxOutputTokens: 16_384,
		knowledgeCutoff: new Date(2026, 0, 26).getTime(),
		pricing: {
			input: definePricing(0.0),
			output: definePricing(0.0),
		},
		requiredTier: "free",
		configurationOptions: {
			temperature: {
				description: "Controls the randomness of the output.",
				schema: z.number().min(0).max(2),
				ui: { min: 0.0, max: 2.0, step: 0.1 },
			},
			maxTokens: {
				description:
					"Maximum number of tokens to generate. Leave at default for full model capability.",
				schema: z.number().min(1).max(16_384),
				ui: {
					label: "Max Tokens",
					min: 1,
					max: 16_384,
					step: 1,
					component: "numberInput",
				},
			},
			topP: {
				description:
					"Nucleus sampling: only consider tokens with cumulative probability up to this value. Lower values make output more focused.",
				schema: z.number().min(0).max(1),
				ui: {
					label: "Top P",
					min: 0.0,
					max: 1.0,
					step: 0.05,
				},
			},
		},
		defaultConfiguration: {
			temperature: 0.7,
			maxTokens: 16_384,
			topP: 1.0,
		},
		url: "https://build.nvidia.com/moonshotai/kimi-k2.5",
	}),
} as const satisfies Record<string, AnyLanguageModel>;
