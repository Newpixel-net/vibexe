import type { WaitNodeContent } from "@giselles-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a Wait node.
 * - fixedTime: Wait for delaySeconds then pass through
 * - webhook: (future) Pause and resume on callback
 * - approval: (future) Pause and wait for human approval
 */
export async function executeWait(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as WaitNodeContent;

	if (content.mode === "fixedTime" && content.delaySeconds > 0) {
		const maxDelay = Math.min(content.delaySeconds, content.timeoutSeconds) * 1000;
		await new Promise((resolve) => setTimeout(resolve, maxDelay));
	}

	// For webhook and approval modes, we'll implement the pause/resume mechanism
	// in a future update. For now, pass through immediately.

	// Pass through all input data
	const data: Record<string, unknown> = {};
	for (const [key, value] of inputData) {
		data[key] = value;
	}

	return {
		outputs: new Map([
			["output", data], // matches factory accessor "output"
			["data", data],
		]),
	};
}
