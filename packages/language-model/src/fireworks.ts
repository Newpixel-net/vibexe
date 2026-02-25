import * as z from "zod/v4";
import { Capability, LanguageModelBase, Tier } from "./base";

const FireworksLanguageModelConfigurations = z.object({
	temperature: z.number(),
	topP: z.number(),
});
type FireworksLanguageModelConfigurations = z.infer<
	typeof FireworksLanguageModelConfigurations
>;

const defaultConfigurations: FireworksLanguageModelConfigurations = {
	temperature: 0.7,
	topP: 1.0,
};

export const FireworksLanguageModelId = z
	.enum(["accounts/fireworks/models/kimi-k2p5"])
	.catch("accounts/fireworks/models/kimi-k2p5");

const FireworksLanguageModel = LanguageModelBase.extend({
	id: FireworksLanguageModelId,
	provider: z.literal("fireworks"),
	configurations: FireworksLanguageModelConfigurations,
});
type FireworksLanguageModel = z.infer<typeof FireworksLanguageModel>;

const kimiK25: FireworksLanguageModel = {
	provider: "fireworks",
	id: "accounts/fireworks/models/kimi-k2p5",
	capabilities: Capability.TextGeneration,
	tier: Tier.enum.free,
	configurations: defaultConfigurations,
};

export const models = [kimiK25];

export const LanguageModel = FireworksLanguageModel;
export type LanguageModel = FireworksLanguageModel;
