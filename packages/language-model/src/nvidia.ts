import * as z from "zod/v4";
import { Capability, LanguageModelBase, Tier } from "./base";

const NvidiaLanguageModelConfigurations = z.object({
	temperature: z.number(),
	topP: z.number(),
});
type NvidiaLanguageModelConfigurations = z.infer<
	typeof NvidiaLanguageModelConfigurations
>;

const defaultConfigurations: NvidiaLanguageModelConfigurations = {
	temperature: 0.7,
	topP: 1.0,
};

export const NvidiaLanguageModelId = z
	.enum(["moonshotai/kimi-k2.5"])
	.catch("moonshotai/kimi-k2.5");

const NvidiaLanguageModel = LanguageModelBase.extend({
	id: NvidiaLanguageModelId,
	provider: z.literal("nvidia"),
	configurations: NvidiaLanguageModelConfigurations,
});
type NvidiaLanguageModel = z.infer<typeof NvidiaLanguageModel>;

const kimiK25: NvidiaLanguageModel = {
	provider: "nvidia",
	id: "moonshotai/kimi-k2.5",
	capabilities: Capability.TextGeneration,
	tier: Tier.enum.free,
	configurations: defaultConfigurations,
};

export const models = [kimiK25];

export const LanguageModel = NvidiaLanguageModel;
export type LanguageModel = NvidiaLanguageModel;
