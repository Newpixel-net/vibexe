import type { RespondToWebhookNodeContent } from "@giselles-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a RespondToWebhook node.
 * Formats the HTTP response data (status code, headers, body) for the webhook caller.
 * The actual HTTP response is sent by the webhook trigger handler.
 */
export async function executeRespondToWebhook(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode
		.content as RespondToWebhookNodeContent;

	// Collect input data
	const input =
		inputData.size === 1
			? Array.from(inputData.values())[0]
			: Object.fromEntries(inputData);

	// Build response body
	let responseBody: unknown = input;
	if (content.responseBody) {
		try {
			if (
				content.responseBody.startsWith("{") ||
				content.responseBody.startsWith("[")
			) {
				responseBody = JSON.parse(content.responseBody);
			} else {
				responseBody = content.responseBody;
			}
		} catch {
			responseBody = content.responseBody;
		}
	}

	return {
		outputs: new Map([
			["statusCode", content.statusCode],
			["headers", content.headers ?? {}],
			["body", responseBody],
			["contentType", content.contentType],
			["_webhookResponse", true],
			["data", { statusCode: content.statusCode, body: responseBody }],
		]),
	};
}
