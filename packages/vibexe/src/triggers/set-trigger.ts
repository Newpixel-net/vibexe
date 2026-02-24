import type { Trigger } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { setTrigger as setTriggerInternal } from "./utils";

export async function setTrigger(args: {
	context: VibexeContext;
	trigger: Trigger;
}) {
	await setTriggerInternal({
		storage: args.context.storage,
		trigger: args.trigger,
	});
}
