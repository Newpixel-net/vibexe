import * as z from "zod/v4";

const Provider = z.literal("chat");

export const ChatTriggerWidgetConfig = z.object({
	title: z.string().default("Chat with AI"),
	placeholder: z.string().default("Type your message..."),
	primaryColor: z.string().default("#6366f1"),
	welcomeMessage: z.string().optional(),
});
export type ChatTriggerWidgetConfig = z.infer<typeof ChatTriggerWidgetConfig>;

export const ChatTriggerEvent = z.object({
	id: z.literal("chat.message"),
	widgetConfig: ChatTriggerWidgetConfig,
});
export type ChatTriggerEvent = z.infer<typeof ChatTriggerEvent>;

export const ChatTrigger = z.object({
	provider: Provider,
	event: ChatTriggerEvent,
	enabled: z.boolean().default(true),
});
export type ChatTrigger = z.infer<typeof ChatTrigger>;
