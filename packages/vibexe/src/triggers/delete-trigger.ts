import type { TriggerId } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { deleteTrigger as systemDeleteTrigger } from "./utils";

export async function deleteTrigger(args: {
	context: VibexeContext;
	triggerId: TriggerId;
}) {
	await systemDeleteTrigger({
		triggerId: args.triggerId,
		storage: args.context.storage,
	});
}
