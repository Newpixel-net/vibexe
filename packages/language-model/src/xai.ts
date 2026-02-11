import * as z from "zod/v4";
import { Capability, LanguageModelBase, Tier } from "./base";

const XaiLanguageModelConfigurations = z.object({
	temperature: z.number(),
	topP: z.number(),
	frequencyPenalty: z.number().optional().default(0),
	presencePenalty: z.number().optional().default(0),
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

export const XaiLanguageModelId = z
	.enum([
		"grok-4-0709",
		"grok-4-1-fast-reasoning",
		"grok-4-1-fast-non-reasoning",
		"grok-4-fast-reasoning",
		"grok-4-fast-non-reasoning",
		"grok-code-fast-1",
		"grok-3",
		"grok-3-mini",
		"grok-2-vision-1212",
	])
	.catch("grok-4-1-fast-reasoning");

const XaiLanguageModel = LanguageModelBase.extend({
	id: XaiLanguageModelId,
	provider: z.literal("xai"),
	configurations: XaiLanguageModelConfigurations,
});
type XaiLanguageModel = z.infer<typeof XaiLanguageModel>;

const grok4: XaiLanguageModel = {
	provider: "xai",
	id: "grok-4-0709",
	capabilities: Capability.TextGeneration,
	tier: Tier.enum.pro,
	configurations: defaultConfigurations,
};

const grok41FastReasoning: XaiLanguageModel = {
	provider: "xai",
	id: "grok-4-1-fast-reasoning",
	capabilities: Capability.TextGeneration,
	tier: Tier.enum.free,
	configurations: defaultConfigurations,
};

const grok41FastNonReasoning: XaiLanguageModel = {
	provider: "xai",
	id: "grok-4-1-fast-non-reasoning",
	capabilities: Capability.TextGeneration,
	tier: Tier.enum.free,
	configurations: defaultConfigurations,
};

const grok4FastReasoning: XaiLanguageModel = {
	provider: "xai",
	id: "grok-4-fast-reasoning",
	capabilities: Capability.TextGeneration,
	tier: Tier.enum.free,
	configurations: defaultConfigurations,
};

const grok4FastNonReasoning: XaiLanguageModel = {
	provider: "xai",
	id: "grok-4-fast-non-reasoning",
	capabilities: Capability.TextGeneration,
	tier: Tier.enum.free,
	configurations: defaultConfigurations,
};

const grokCodeFast1: XaiLanguageModel = {
	provider: "xai",
	id: "grok-code-fast-1",
	capabilities: Capability.TextGeneration,
	tier: Tier.enum.free,
	configurations: defaultConfigurations,
};

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

const grok2Vision: XaiLanguageModel = {
	provider: "xai",
	id: "grok-2-vision-1212",
	capabilities: Capability.TextGeneration,
	tier: Tier.enum.pro,
	configurations: defaultConfigurations,
};

export const models = [
	grok4,
	grok41FastReasoning,
	grok41FastNonReasoning,
	grok4FastReasoning,
	grok4FastNonReasoning,
	grokCodeFast1,
	grok3,
	grok3Mini,
	grok2Vision,
];

export const LanguageModel = XaiLanguageModel;
export type LanguageModel = XaiLanguageModel;
