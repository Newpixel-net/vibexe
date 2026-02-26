/**
 * Model Resolver — Server-only AI SDK provider resolution
 *
 * Maps model ID strings to AI SDK provider instances.
 * This file imports @ai-sdk/* packages and MUST NOT be imported
 * by "use client" components. Client components should import
 * from model-options.ts instead.
 */

import { createAnthropic, anthropic } from "@ai-sdk/anthropic";
import { createOpenAI, openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { DEFAULT_MODEL_ID, MODEL_OPTIONS } from "./model-options";

// Re-export client-safe types/constants for server-side consumers
export {
	DEFAULT_MODEL_ID,
	MODEL_OPTIONS,
	getModelCapabilities,
	type ModelCapabilities,
	type ModelOption,
} from "./model-options";

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
let _defaultModelMap: ReturnType<typeof createModelMap> | null = null;
function getDefaultModelMap() {
	if (!_defaultModelMap) _defaultModelMap = createModelMap();
	return _defaultModelMap;
}

/**
 * Resolve a model ID string to an AI SDK LanguageModel instance.
 * Falls back to default model if the model ID is unknown.
 */
export function resolveModel(
	modelId?: string,
	apiKeys?: ByokApiKeys,
): LanguageModel {
	const id = modelId || DEFAULT_MODEL_ID;
	const map = apiKeys ? createModelMap(apiKeys) : getDefaultModelMap();
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
	const map = apiKeys ? createModelMap(apiKeys) : getDefaultModelMap();
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

	const provider = model.provider;
	const byokKey = apiKeys?.[provider];
	if (byokKey) return null;

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
