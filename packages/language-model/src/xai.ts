import * as z from "zod/v4";
import { Capability, LanguageModelBase, Tier } from "./base";

const XaiLanguageModelConfigurations = z.object({
	temperature: z.number(),
	topP: z.number(),
	frequencyPenalty: z.number(),
	presencePenalty: z.number(),
});
type XaiLanguageModelConfigurations = z.infer<
	typeof XaiLanguageModelConfigurations
>;

const defaultConfigurations: XaiLanguageModelConfigurations = {
	temperature: 0.7,
	topP: 1.0,
	frequencyPenalty: 0.0,
	presencePenalty: 0.0,
};

export const XaiLanguageModelId = z.enum(["grok-3", "grok-3-mini"]).catch("grok-3");

const XaiLanguageModel = LanguageModelBase.extend({
	id: XaiLanguageModelId,
	provider: z.literal("xai"),
	configurations: XaiLanguageModelConfigurations,
});
type XaiLanguageModel = z.infer<typeof XaiLanguageModel>;

const grok3: XaiLanguageModel = {
	provider: "xai",
	id: "grok-3",
	capabilities: Capability.TextGeneration,
	tier: Tier.enum.pro,
	configurations: defaultConfigurations,
};

const grok3Mini: XaiLanguageModel = {
	provider: "xai",
	id: "grok-3-mini",
	capabilities: Capability.TextGeneration,
	tier: Tier.enum.free,
	configurations: defaultConfigurations,
};

export const models = [grok3, grok3Mini];

export const LanguageModel = XaiLanguageModel;
export type LanguageModel = XaiLanguageModel;
