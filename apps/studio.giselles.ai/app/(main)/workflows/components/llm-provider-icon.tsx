import {
	AnthropicIcon,
	GoogleWhiteIcon,
	NvidiaIcon,
	OpenaiIcon,
	PerplexityIcon,
	XaiIcon,
} from "../../../../../../internal-packages/workflow-designer-ui/src/icons";

export function LLMProviderIcon({
	provider,
	className,
}: {
	provider: string;
	className?: string;
}) {
	switch (provider) {
		case "openai":
			return <OpenaiIcon className={className} />;
		case "anthropic":
			return <AnthropicIcon className={className} />;
		case "google":
			return <GoogleWhiteIcon className={className} />;
		case "perplexity":
			return <PerplexityIcon className={className} />;
		case "nvidia":
			return <NvidiaIcon className={className} />;
		case "xai":
			return <XaiIcon className={className} />;
		default:
			return null;
	}
}
