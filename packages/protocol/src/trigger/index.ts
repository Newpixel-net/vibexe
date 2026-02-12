import { createIdGenerator } from "@giselles-ai/utils";
import * as z from "zod/v4";
import { NodeId } from "../node/base";
import { WorkspaceId } from "../workspace/id";
import { AppEventTrigger } from "./app-event";
import { ChatTrigger } from "./chat";
import { GitHubEventConfiguration } from "./github";
import { ManualTrigger } from "./manual";
import { ScheduleTrigger } from "./schedule";
import { WebhookTrigger } from "./webhook";

export {
	ManualParameterType as ParameterType,
	ManualTrigger,
	ManualTriggerEvent,
	ManualTriggerParameter,
	ManualTriggerParameterId,
} from "./manual";

export {
	ScheduleTrigger,
	ScheduleTriggerEvent,
} from "./schedule";

export {
	WebhookTrigger,
	WebhookTriggerEvent,
	WebhookPathId,
} from "./webhook";

export {
	ChatTrigger,
	ChatTriggerEvent,
	ChatTriggerWidgetConfig,
} from "./chat";

export {
	AppEventTrigger,
	AppEventTriggerEvent,
} from "./app-event";

export const TriggerId = createIdGenerator("fltg");
export type TriggerId = z.infer<typeof TriggerId.schema>;

export const Trigger = z.object({
	id: TriggerId.schema,
	workspaceId: WorkspaceId.schema,
	nodeId: NodeId.schema,
	enable: z.boolean().default(true),
	configuration: z.discriminatedUnion("provider", [
		GitHubEventConfiguration,
		ManualTrigger,
		ScheduleTrigger,
		WebhookTrigger,
		ChatTrigger,
		AppEventTrigger,
	]),
});
export type Trigger = z.infer<typeof Trigger>;

export * from "./github";
