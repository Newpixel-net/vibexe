/**
 * Model Resolver for App Builder
 *
 * Maps model ID strings to AI SDK provider instances.
 * Supports Anthropic Claude (default), OpenAI, xAI Grok, and NVIDIA NIM (Kimi K2.5).
 * Supports BYOK (Bring Your Own Key) via optional apiKeys parameter.
 */

import { createAnthropic, anthropic } from "@ai-sdk/anthropic";
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
		id: "kimi-k2-5-fireworks",
		name: "Kimi K2.5 (Fireworks)",
		provider: "fireworks",
		tier: "standard",
		capabilities: {
			vision: true,
			documents: false,
			maxFiles: 5,
			maxFileSizeMB: 5,
			supportedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
			supportedDocTypes: [],
		},
	},
	{
		id: "kimi-k2-5",
		name: "Kimi K2.5 (NVIDIA)",
		provider: "nvidia",
		tier: "standard",
		capabilities: {
			vision: true,
			documents: false,
			maxFiles: 5,
			maxFileSizeMB: 5,
			supportedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
			supportedDocTypes: [],
		},
	},
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

export const DEFAULT_MODEL_ID = "kimi-k2-5-fireworks";

/**
 * Get capabilities for a model by ID.
 * Falls back to default model capabilities if ID is unknown.
 */
export function getModelCapabilities(modelId?: string): ModelCapabilities {
	const id = modelId || DEFAULT_MODEL_ID;
	const model = MODEL_OPTIONS.find((m) => m.id === id);
	return model?.capabilities ?? MODEL_OPTIONS[0].capabilities;
}

/** Optional BYOK keys map: { anthropic: "sk-...", openai: "sk-...", xai: "xai-..." } */
export type ByokApiKeys = Record<string, string>;

function createModelMap(
	apiKeys?: ByokApiKeys,
): Record<string, () => LanguageModel> {
	return {
		"claude-sonnet-4-5": () => {
			if (apiKeys?.anthropic) {
				return createAnthropic({ apiKey: apiKeys.anthropic })(
					"claude-sonnet-4-5-20250929",
				);
			}
			return anthropic("claude-sonnet-4-5-20250929");
		},
		"claude-opus-4-6": () => {
			if (apiKeys?.anthropic) {
				return createAnthropic({ apiKey: apiKeys.anthropic })(
					"claude-opus-4-6",
				);
			}
			return anthropic("claude-opus-4-6");
		},
		"claude-haiku-4-5": () => {
			if (apiKeys?.anthropic) {
				return createAnthropic({ apiKey: apiKeys.anthropic })(
					"claude-haiku-4-5-20251001",
				);
			}
			return anthropic("claude-haiku-4-5-20251001");
		},
		"gpt-4o": () => {
			if (apiKeys?.openai) {
				return createOpenAI({ apiKey: apiKeys.openai })("gpt-4o");
			}
			return openai("gpt-4o");
		},
		"grok-4-1-fast": () => {
			const xai = createOpenAI({
				baseURL: "https://api.x.ai/v1",
				apiKey: apiKeys?.xai ?? process.env.XAI_API_KEY ?? "",
			});
			return xai("grok-4-1-fast-reasoning");
		},
		"kimi-k2-5-fireworks": () => {
			const fireworks = createOpenAI({
				baseURL: "https://api.fireworks.ai/inference/v1",
				apiKey: apiKeys?.fireworks ?? process.env.FIREWORKS_API_KEY ?? "",
			});
			// Fireworks only supports Chat Completions API, not Responses API
			return fireworks.chat("accounts/fireworks/models/kimi-k2p5");
		},
		"kimi-k2-5": () => {
			const nvidia = createOpenAI({
				baseURL: "https://integrate.api.nvidia.com/v1",
				apiKey: apiKeys?.nvidia ?? process.env.NVIDIA_API_KEY ?? "",
			});
			// NVIDIA NIM only supports Chat Completions API, not Responses API
			return nvidia.chat("moonshotai/kimi-k2.5");
		},
	};
}

// Default model map (no BYOK — uses process.env)
const defaultModelMap = createModelMap();

/**
 * Resolve a model ID string to an AI SDK LanguageModel instance.
 * Falls back to Claude Sonnet 4.5 if the model ID is unknown.
 *
 * @param modelId - The model identifier (e.g. "claude-sonnet-4-5")
 * @param apiKeys - Optional BYOK keys. If provided, creates provider with explicit apiKey.
 */
export function resolveModel(
	modelId?: string,
	apiKeys?: ByokApiKeys,
): LanguageModel {
	const id = modelId || DEFAULT_MODEL_ID;
	const map = apiKeys ? createModelMap(apiKeys) : defaultModelMap;
	const factory = map[id];
	if (factory) {
		return factory();
	}
	return map[DEFAULT_MODEL_ID]();
}

/**
 * Resolve a model by tier (used by orchestration engine for agent model selection).
 */
export function resolveModelByTier(
	tier: "opus" | "sonnet" | "haiku",
	apiKeys?: ByokApiKeys,
): LanguageModel {
	const map = apiKeys ? createModelMap(apiKeys) : defaultModelMap;
	switch (tier) {
		case "opus":
			return map["claude-opus-4-6"]();
		case "sonnet":
			return map["claude-sonnet-4-5"]();
		case "haiku":
			return map["claude-haiku-4-5"]();
	}
}

/**
 * Fallback chain: when a model fails, try these alternatives in order.
 * Same-provider alternatives first, then cross-provider.
 */
const FALLBACK_CHAIN: Record<string, string[]> = {
	"kimi-k2-5-fireworks": ["kimi-k2-5", "claude-sonnet-4-5"],
	"kimi-k2-5": ["kimi-k2-5-fireworks", "claude-sonnet-4-5"],
	"claude-sonnet-4-5": ["claude-opus-4-6", "gpt-4o"],
	"claude-opus-4-6": ["claude-sonnet-4-5", "gpt-4o"],
	"claude-haiku-4-5": ["claude-sonnet-4-5", "kimi-k2-5-fireworks"],
	"gpt-4o": ["claude-sonnet-4-5", "kimi-k2-5-fireworks"],
	"grok-4-1-fast": ["claude-sonnet-4-5", "gpt-4o"],
};

/**
 * Get the ordered fallback chain for a model.
 * Returns model IDs to try if the primary model fails.
 */
export function getFallbackChain(modelId: string): string[] {
	return FALLBACK_CHAIN[modelId] || ["claude-sonnet-4-5"];
}

/**
 * Pre-flight validation: check that the resolved model has a valid API key.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateModelConfig(
	modelId?: string,
	apiKeys?: ByokApiKeys,
): string | null {
	const id = modelId || DEFAULT_MODEL_ID;
	const model = MODEL_OPTIONS.find((m) => m.id === id);
	if (!model) return `Unknown model: ${id}`;

	// Check if the provider has an API key configured
	const provider = model.provider;
	const byokKey = apiKeys?.[provider];
	if (byokKey) return null; // BYOK key present — valid

	// Check environment variables for each provider
	const envKeyMap: Record<string, string> = {
		anthropic: "ANTHROPIC_API_KEY",
		openai: "OPENAI_API_KEY",
		fireworks: "FIREWORKS_API_KEY",
		nvidia: "NVIDIA_API_KEY",
		xai: "XAI_API_KEY",
	};

	const envVar = envKeyMap[provider];
	if (envVar && !process.env[envVar]) {
		return `No API key configured for ${model.name}. Set ${envVar} or use a different model.`;
	}

	return null;
}
