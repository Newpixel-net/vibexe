import type { WaitNodeContent } from "@vibexe-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";
import type { VibexeContext } from "../types";

/**
 * Execute a Wait node.
 * - fixedTime: Wait for delaySeconds then pass through
 * - webhook: Register a real webhook endpoint in DB, poll for incoming request
 * - approval: Same as webhook but uses an approval-specific path
 */
export async function executeWait(
	node: DagNode,
	inputData: Map<string, unknown>,
	helpers?: VibexeContext["waitWebhookHelpers"],
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
			const webhookId = `wh-wait-${node.nodeId}-${Date.now()}`;
			const webhookPath = `wait-${webhookId}`;
			const timeoutMs = Math.min(content.timeoutSeconds, 3600) * 1000;
			const pollInterval = 2000;
			const startTime = Date.now();

			// If no DB helpers available, fall back to simple timeout
			if (!helpers) {
				await new Promise((resolve) => setTimeout(resolve, timeoutMs));
				return {
					outputs: new Map([
						["output", { ...data, webhookId, timedOut: true }],
						["data", { ...data, webhookId, timedOut: true }],
						["waitMode", "webhook"],
						["webhookId", webhookId],
						["webhookPath", `/api/webhooks/${webhookPath}`],
						["timedOut", true],
						["waitedSeconds", (Date.now() - startTime) / 1000],
					]),
				};
			}

			// Register webhook endpoint in DB
			let endpointDbId: number;
			try {
				endpointDbId = await helpers.register(
					webhookPath,
					"", // workspaceId resolved inside the helper via context
					node.nodeId,
				);
			} catch (err) {
				// If registration fails, fall back to timeout
				await new Promise((resolve) => setTimeout(resolve, timeoutMs));
				return {
					outputs: new Map([
						["output", { ...data, webhookId, timedOut: true, error: "Failed to register webhook" }],
						["data", { ...data, webhookId, timedOut: true }],
						["waitMode", "webhook"],
						["timedOut", true],
						["waitedSeconds", (Date.now() - startTime) / 1000],
					]),
				};
			}

			// Poll for incoming webhook request
			try {
				while (Date.now() - startTime < timeoutMs) {
					const payload = await helpers.poll(endpointDbId);
					if (payload !== null) {
						const elapsed = (Date.now() - startTime) / 1000;
						// Cleanup the temp endpoint
						await helpers.cleanup(endpointDbId).catch(() => {});
						return {
							outputs: new Map([
								["output", { ...data, ...payload }],
								["data", { ...data, ...payload }],
								["webhookPayload", payload],
								["waitMode", "webhook"],
								["webhookId", webhookId],
								["webhookPath", `/api/webhooks/${webhookPath}`],
								["timedOut", false],
								["waitedSeconds", elapsed],
							]),
						};
					}
					await new Promise((resolve) => setTimeout(resolve, pollInterval));
				}
			} finally {
				// Always cleanup
				await helpers.cleanup(endpointDbId).catch(() => {});
			}

			const elapsed = (Date.now() - startTime) / 1000;
			return {
				outputs: new Map([
					["output", { ...data, webhookId, timedOut: true }],
					["data", { ...data, webhookId, timedOut: true }],
					["waitMode", "webhook"],
					["webhookId", webhookId],
					["webhookPath", `/api/webhooks/${webhookPath}`],
					["timedOut", true],
					["waitedSeconds", elapsed],
				]),
			};
		}

		case "approval": {
			const approvalId = `appr-${node.nodeId}-${Date.now()}`;
			const approvalPath = `approval-${approvalId}`;
			const timeoutMs = Math.min(content.timeoutSeconds, 3600) * 1000;
			const pollInterval = 2000;
			const startTime = Date.now();

			// If no DB helpers, fall back to timeout
			if (!helpers) {
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

			// Register an approval webhook endpoint
			let endpointDbId: number;
			try {
				endpointDbId = await helpers.register(
					approvalPath,
					"",
					node.nodeId,
				);
			} catch {
				await new Promise((resolve) => setTimeout(resolve, timeoutMs));
				return {
					outputs: new Map([
						["output", { ...data, approvalId, approved: false, timedOut: true }],
						["data", { ...data, approvalId, approved: false, timedOut: true }],
						["waitMode", "approval"],
						["approved", false],
						["timedOut", true],
					]),
				};
			}

			// Poll for approval signal (sent as a webhook POST with {"approved": true/false})
			try {
				while (Date.now() - startTime < timeoutMs) {
					const payload = await helpers.poll(endpointDbId);
					if (payload !== null) {
						const approved = payload.approved === true;
						await helpers.cleanup(endpointDbId).catch(() => {});
						return {
							outputs: new Map([
								["output", { ...data, approvalId, approved, timedOut: false }],
								["data", { ...data, approvalId, approved, timedOut: false }],
								["waitMode", "approval"],
								["approvalId", approvalId],
								["approvalPath", `/api/webhooks/${approvalPath}`],
								["approved", approved],
								["timedOut", false],
							]),
						};
					}
					await new Promise((resolve) => setTimeout(resolve, pollInterval));
				}
			} finally {
				await helpers.cleanup(endpointDbId).catch(() => {});
			}

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
