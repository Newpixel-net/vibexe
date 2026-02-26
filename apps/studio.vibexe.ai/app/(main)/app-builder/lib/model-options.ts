/**
 * Model Options — Client-safe model metadata
 *
 * This file contains ONLY types, constants, and pure functions.
 * No AI SDK imports — safe for "use client" components.
 *
 * Server-only AI SDK resolution lives in model-resolver.ts.
 */

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
