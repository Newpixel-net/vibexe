import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute an Error Trigger node.
 * This fires when any other node in the workflow fails.
 * It receives error context from the DAG executor.
 */
export async function executeErrorTrigger(
	_node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	// The error context is passed as input by the DAG executor
	const errorMessage = inputData.get("errorMessage") ?? "Unknown error";
	const failedNodeId = inputData.get("failedNodeId") ?? "";
	const failedNodeName = inputData.get("failedNodeName") ?? "";
	const timestamp = inputData.get("timestamp") ?? new Date().toISOString();

	return {
		outputs: new Map([
			["errorMessage", errorMessage],
			["failedNodeId", failedNodeId],
			["failedNodeName", failedNodeName],
			["timestamp", timestamp],
			[
				"data",
				{
					errorMessage,
					failedNodeId,
					failedNodeName,
					timestamp,
				},
			],
		]),
	};
}
