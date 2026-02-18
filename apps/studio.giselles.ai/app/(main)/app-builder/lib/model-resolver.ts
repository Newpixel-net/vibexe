/**
 * Model Resolver for App Builder
 *
 * Maps model ID strings to AI SDK provider instances.
 * Supports Anthropic Claude (default), OpenAI, and xAI Grok.
 */

import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI, openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export interface ModelOption {
	id: string;
	name: string;
	provider: string;
	tier: "opus" | "sonnet" | "haiku" | "standard";
}

export const MODEL_OPTIONS: ModelOption[] = [
	{
		id: "claude-sonnet-4-5",
		name: "Claude Sonnet 4.5",
		provider: "anthropic",
		tier: "sonnet",
	},
	{
		id: "claude-opus-4-6",
		name: "Claude Opus 4.6",
		provider: "anthropic",
		tier: "opus",
	},
	{
		id: "claude-haiku-4-5",
		name: "Claude Haiku 4.5",
		provider: "anthropic",
		tier: "haiku",
	},
	{
		id: "gpt-4o",
		name: "GPT-4o",
		provider: "openai",
		tier: "standard",
	},
	{
		id: "grok-4-1-fast",
		name: "Grok 4.1 Fast",
		provider: "xai",
		tier: "standard",
	},
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-5";

const modelMap: Record<string, () => LanguageModel> = {
	"claude-sonnet-4-5": () =>
		anthropic("claude-sonnet-4-5-20250929"),
	"claude-opus-4-6": () =>
		anthropic("claude-opus-4-6"),
	"claude-haiku-4-5": () =>
		anthropic("claude-haiku-4-5-20251001"),
	"gpt-4o": () => openai("gpt-4o"),
	"grok-4-1-fast": () => {
		const xai = createOpenAI({
			baseURL: "https://api.x.ai/v1",
			apiKey: process.env.XAI_API_KEY ?? "",
		});
		return xai("grok-4-1-fast-reasoning");
	},
};

/**
 * Resolve a model ID string to an AI SDK LanguageModel instance.
 * Falls back to Claude Sonnet 4.5 if the model ID is unknown.
 */
export function resolveModel(modelId?: string): LanguageModel {
	const id = modelId || DEFAULT_MODEL_ID;
	const factory = modelMap[id];
	if (factory) {
		return factory();
	}
	// Fallback to default
	return modelMap[DEFAULT_MODEL_ID]();
}

/**
 * Resolve a model by tier (used by orchestration engine for agent model selection).
 */
export function resolveModelByTier(
	tier: "opus" | "sonnet" | "haiku",
): LanguageModel {
	switch (tier) {
		case "opus":
			return modelMap["claude-opus-4-6"]();
		case "sonnet":
			return modelMap["claude-sonnet-4-5"]();
		case "haiku":
			return modelMap["claude-haiku-4-5"]();
	}
}
