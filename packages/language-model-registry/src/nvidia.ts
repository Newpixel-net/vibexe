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
		},
		defaultConfiguration: {
			temperature: 0.7,
		},
		url: "https://build.nvidia.com/moonshotai/kimi-k2.5",
	}),
} as const satisfies Record<string, AnyLanguageModel>;
