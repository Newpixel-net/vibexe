import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { LanguageModelV2CallOptions } from "@ai-sdk/provider";
import {
	getEntry,
	parseConfiguration,
} from "@vibexe-ai/language-model-registry";
import type {
	AiAgentContent,
	ContentGenerationContent,
} from "@vibexe-ai/protocol";

export function transformVibexeLanguageModelToAiSdkLanguageModelCallOptions(
	content: ContentGenerationContent | AiAgentContent,
): Pick<
	LanguageModelV2CallOptions,
	"temperature" | "maxOutputTokens" | "topP" | "providerOptions"
> {
	const languageModel = getEntry(content.languageModel.id);
	switch (languageModel.id) {
		case "openai/gpt-5":
		case "openai/gpt-5-codex":
		case "openai/gpt-5-mini":
		case "openai/gpt-5-nano":
		case "openai/gpt-5.1-codex":
		case "openai/gpt-5.1-thinking":
		case "openai/gpt-5.2":
		case "openai/gpt-5.2-codex": {
			const config = parseConfiguration(
				languageModel,
				content.languageModel.configuration,
			);
			return {
				maxOutputTokens: config.maxTokens,
				providerOptions: {
					openai: {
						reasoningEffort: config.reasoningEffort,
						textVerbosity: config.textVerbosity,
					} satisfies OpenAIResponsesProviderOptions,
				},
			} satisfies Partial<LanguageModelV2CallOptions>;
		}
		case "anthropic/claude-haiku-4.5":
		case "anthropic/claude-opus-4.5":
		case "anthropic/claude-sonnet-4.5": {
			const config = parseConfiguration(
				languageModel,
				content.languageModel.configuration,
			);
			// Anthropic API does not allow both temperature and top_p simultaneously.
			// Send only temperature (the more commonly used parameter).
			if (config.thinking) {
				return {
					temperature: config.temperature,
					maxOutputTokens: config.maxTokens,
					providerOptions: {
						anthropic: {
							thinking: {
								type: "enabled",
								budgetTokens: 12000,
							},
						} satisfies AnthropicProviderOptions,
					},
				} satisfies Partial<LanguageModelV2CallOptions>;
			}
			return {
				temperature: config.temperature,
				maxOutputTokens: config.maxTokens,
				providerOptions: {
					anthropic: {
						thinking: {
							type: "disabled",
						},
					} satisfies AnthropicProviderOptions,
				},
			} as Partial<LanguageModelV2CallOptions>;
		}
		case "google/gemini-3-pro-preview":
		case "google/gemini-3-flash": {
			const config = parseConfiguration(
				languageModel,
				content.languageModel.configuration,
			);
			return {
				temperature: config.temperature,
				maxOutputTokens: config.maxTokens,
				topP: config.topP,
				providerOptions: {
					google: {
						thinkingConfig: {
							thinkingLevel: config.thinkingLevel,
						},
					} satisfies GoogleGenerativeAIProviderOptions,
				},
			} satisfies Partial<LanguageModelV2CallOptions>;
		}
		case "google/gemini-2.5-flash":
		case "google/gemini-2.5-flash-lite":
		case "google/gemini-2.5-pro": {
			const config = parseConfiguration(
				languageModel,
				content.languageModel.configuration,
			);
			return {
				temperature: config.temperature,
				maxOutputTokens: config.maxTokens,
				topP: config.topP,
				providerOptions: {
					google: {
						thinkingConfig: {
							// You can disable thinking by setting thinkingBudget to 0. Setting the thinkingBudget to -1 turns on dynamic thinking, meaning the model will adjust the budget based on the complexity of the request.
							// https://ai.google.dev/gemini-api/docs/thinking#set-budget
							thinkingBudget: config.thinking ? -1 : 0,
						},
					} satisfies GoogleGenerativeAIProviderOptions,
				},
			} satisfies Partial<LanguageModelV2CallOptions>;
		}
		case "nvidia/moonshotai/kimi-k2.5": {
			const config = parseConfiguration(
				languageModel,
				content.languageModel.configuration,
			);
			return {
				temperature: config.temperature,
				maxOutputTokens: config.maxTokens,
				topP: config.topP,
			} satisfies Partial<LanguageModelV2CallOptions>;
		}
		case "xai/grok-4-0709":
		case "xai/grok-4-1-fast-reasoning":
		case "xai/grok-4-1-fast-non-reasoning":
		case "xai/grok-4-fast-reasoning":
		case "xai/grok-4-fast-non-reasoning":
		case "xai/grok-code-fast-1":
		case "xai/grok-3":
		case "xai/grok-3-mini":
		case "xai/grok-2-vision-1212": {
			const config = parseConfiguration(
				languageModel,
				content.languageModel.configuration,
			);
			return {
				temperature: config.temperature,
				maxOutputTokens: config.maxTokens,
				topP: config.topP,
			} satisfies Partial<LanguageModelV2CallOptions>;
		}
		default: {
			const _exhaustiveCheck: never = languageModel;
			throw new Error(`Unsupported language model: ${_exhaustiveCheck}`);
		}
	}
}
