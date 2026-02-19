/**
 * Model Resolver for App Builder
 *
 * Maps model ID strings to AI SDK provider instances.
 * Supports Anthropic Claude (default), OpenAI, and xAI Grok.
 */

import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI, openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export interface ModelCapabilities {
	vision: boolean;
	documents: boolean;
	maxFiles: number;
	maxFileSizeMB: number;
	supportedImageTypes: string[];
	supportedDocTypes: string[];
}

export interface ModelOption {
	id: string;
	name: string;
	provider: string;
	tier: "opus" | "sonnet" | "haiku" | "standard";
	capabilities: ModelCapabilities;
}

const ANTHROPIC_CAPABILITIES: ModelCapabilities = {
	vision: true,
	documents: true,
	maxFiles: 20,
	maxFileSizeMB: 5,
	supportedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
	supportedDocTypes: ["application/pdf"],
};

export const MODEL_OPTIONS: ModelOption[] = [
	{
		id: "claude-sonnet-4-5",
		name: "Claude Sonnet 4.5",
		provider: "anthropic",
		tier: "sonnet",
		capabilities: ANTHROPIC_CAPABILITIES,
	},
	{
		id: "claude-opus-4-6",
		name: "Claude Opus 4.6",
		provider: "anthropic",
		tier: "opus",
		capabilities: ANTHROPIC_CAPABILITIES,
	},
	{
		id: "claude-haiku-4-5",
		name: "Claude Haiku 4.5",
		provider: "anthropic",
		tier: "haiku",
		capabilities: ANTHROPIC_CAPABILITIES,
	},
	{
		id: "gpt-4o",
		name: "GPT-4o",
		provider: "openai",
		tier: "standard",
		capabilities: {
			vision: true,
			documents: true,
			maxFiles: 10,
			maxFileSizeMB: 20,
			supportedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
			supportedDocTypes: ["application/pdf"],
		},
	},
	{
		id: "grok-4-1-fast",
		name: "Grok 4.1 Fast",
		provider: "xai",
		tier: "standard",
		capabilities: {
			vision: true,
			documents: false,
			maxFiles: 1,
			maxFileSizeMB: 10,
			supportedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
			supportedDocTypes: [],
		},
	},
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-5";

/**
 * Get capabilities for a model by ID.
 * Falls back to default model capabilities if ID is unknown.
 */
export function getModelCapabilities(modelId?: string): ModelCapabilities {
	const id = modelId || DEFAULT_MODEL_ID;
	const model = MODEL_OPTIONS.find((m) => m.id === id);
	return model?.capabilities ?? MODEL_OPTIONS[0].capabilities;
}

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
