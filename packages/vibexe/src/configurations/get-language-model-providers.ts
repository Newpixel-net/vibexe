import type { VibexeContext } from "../types";

export function getLanguageModelProviders(args: { context: VibexeContext }) {
	return args.context.llmProviders;
}
