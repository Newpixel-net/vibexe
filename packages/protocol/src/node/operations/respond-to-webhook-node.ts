import * as z from "zod/v4";

export const RespondToWebhookNodeContent = z.object({
	type: z.literal("respondToWebhook"),
	statusCode: z.number().default(200),
	headers: z.record(z.string(), z.string()).default({}),
	responseBody: z.string().default(""),
	contentType: z
		.enum(["application/json", "text/plain", "text/html"])
		.default("application/json"),
});
export type RespondToWebhookNodeContent = z.infer<
	typeof RespondToWebhookNodeContent
>;

export const RespondToWebhookNodeContentReference = z.object({
	type: RespondToWebhookNodeContent.shape.type,
});
export type RespondToWebhookNodeContentReference = z.infer<
	typeof RespondToWebhookNodeContentReference
>;
