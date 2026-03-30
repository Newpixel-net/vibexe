import {
	getEntry,
	type LanguageModelId,
} from "@vibexe-ai/language-model-registry";
import { AnthropicIcon, GoogleWhiteIcon, NvidiaIcon, OpenaiIcon, XaiIcon } from "../components";

interface ProviderIconProps {
	modelId: LanguageModelId;
	className?: string;
}

export function ProviderIcon({
	modelId,
	className = "w-[18px] h-[18px]",
}: ProviderIconProps) {
	const languageModel = getEntry(modelId);
	switch (languageModel.providerId) {
		case "anthropic":
			return <AnthropicIcon className={className} data-icon />;
		case "openai":
			return <OpenaiIcon className={className} data-icon />;
		case "google":
			return <GoogleWhiteIcon className={className} data-icon />;
		case "nvidia":
			return <NvidiaIcon className={className} data-icon />;
		case "xai":
			return <XaiIcon className={className} data-icon />;
		default: {
			return null;
		}
	}
}
