import type { GenerationId } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { getGeneration as getGenerationInternal } from "./utils";

export async function getGeneration(args: {
	context: VibexeContext;
	generationId: GenerationId;
}) {
	return await getGenerationInternal({
		storage: args.context.storage,
		generationId: args.generationId,
	});
}
