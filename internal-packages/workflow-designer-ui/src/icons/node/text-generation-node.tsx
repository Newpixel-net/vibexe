import type { TextGenerationLanguageModelProvider } from "@giselles-ai/protocol";
import type { SVGProps } from "react";
import { AnthropicIcon } from "../anthropic";
import { GoogleWhiteIcon } from "../google";
import { NvidiaIcon } from "../nvidia";
import { OpenaiIcon } from "../openai";
import { PerplexityIcon } from "../perplexity";
import { XaiIcon } from "../xai";

function _TextGenerationNodeIcon({
	llmProvider,
	...props
}: {
	llmProvider: TextGenerationLanguageModelProvider;
} & SVGProps<SVGSVGElement>) {
	switch (llmProvider) {
		case "openai":
			return <OpenaiIcon {...props} />;
		case "anthropic":
			return <AnthropicIcon {...props} />;
		case "google":
			return <GoogleWhiteIcon {...props} />;
		case "perplexity":
			return <PerplexityIcon {...props} />;
		case "nvidia":
			return <NvidiaIcon {...props} />;
		case "xai":
			return <XaiIcon {...props} />;
		default: {
			const _exhaustiveCheck: never = llmProvider;
			throw new Error(`Unhandled LLMProvider: ${_exhaustiveCheck}`);
		}
	}
}
