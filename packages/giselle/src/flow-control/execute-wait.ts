import type { WaitNodeContent } from "@giselles-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a Wait node.
 * - fixedTime: Wait for delaySeconds then pass through
 * - webhook: Generate a webhook URL and wait for it to be called (polls for data)
 * - approval: Wait for external approval signal (timeout-based)
 */
export async function executeWait(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as WaitNodeContent;

	// Pass through all input data
	const data: Record<string, unknown> = {};
	for (const [key, value] of inputData) {
		data[key] = value;
	}

	switch (content.mode) {
		case "fixedTime": {
			if (content.delaySeconds > 0) {
				const maxDelay = Math.min(content.delaySeconds, content.timeoutSeconds) * 1000;
				await new Promise((resolve) => setTimeout(resolve, maxDelay));
			}
			return {
				outputs: new Map([
					["output", data],
					["data", data],
					["waitMode", "fixedTime"],
					["waitedSeconds", content.delaySeconds],
				]),
			};
		}

		case "webhook": {
			// Generate a unique webhook ID for this wait node execution
			const webhookId = `wh-wait-${node.nodeId}-${Date.now()}`;
			const webhookPath = `/api/giselle/webhooks/wait/${webhookId}`;

			// Store webhook info so the UI can display it
			// In a full implementation, this would register in the webhook_endpoints DB table
			// and poll/subscribe for the callback. For now, we apply a configurable timeout.
			const timeoutMs = Math.min(content.timeoutSeconds, 300) * 1000; // Cap at 5 minutes for in-process wait
			const startTime = Date.now();

			// Wait for the timeout (in production, this would poll a DB/cache for the webhook callback)
			await new Promise((resolve) => setTimeout(resolve, timeoutMs));

			const elapsed = (Date.now() - startTime) / 1000;
			return {
				outputs: new Map([
					["output", { ...data, webhookId, timedOut: true }],
					["data", { ...data, webhookId, timedOut: true }],
					["waitMode", "webhook"],
					["webhookId", webhookId],
					["webhookPath", webhookPath],
					["timedOut", true],
					["waitedSeconds", elapsed],
				]),
			};
		}

		case "approval": {
			// Approval mode: waits for a configurable timeout
			// In production, this would create an approval request in the DB
			// and poll for the approval/rejection decision
			const approvalId = `appr-${node.nodeId}-${Date.now()}`;
			const timeoutMs = Math.min(content.timeoutSeconds, 300) * 1000; // Cap at 5 minutes

			await new Promise((resolve) => setTimeout(resolve, timeoutMs));

			return {
				outputs: new Map([
					["output", { ...data, approvalId, approved: false, timedOut: true }],
					["data", { ...data, approvalId, approved: false, timedOut: true }],
					["waitMode", "approval"],
					["approvalId", approvalId],
					["approved", false],
					["timedOut", true],
				]),
			};
		}

		default: {
			return {
				outputs: new Map([
					["output", data],
					["data", data],
				]),
			};
		}
	}
}
