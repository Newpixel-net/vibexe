import type { TriggerId } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { getTrigger as systemGetTrigger } from "./utils";

export async function getTrigger(args: {
	context: VibexeContext;
	triggerId: TriggerId;
}) {
	return await systemGetTrigger({
		triggerId: args.triggerId,
		storage: args.context.storage,
	});
}
