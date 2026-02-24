import type { Generation } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { internalSetGeneration } from "./internal/set-generation";

export async function setGeneration(args: {
	context: VibexeContext;
	generation: Generation;
}) {
	await internalSetGeneration({
		storage: args.context.storage,
		generation: args.generation,
		logger: args.context.logger,
	});
}
