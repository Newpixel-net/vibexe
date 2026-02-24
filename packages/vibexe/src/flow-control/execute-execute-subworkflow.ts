import type { ExecuteSubWorkflowNodeContent } from "@vibexe-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute an ExecuteSubWorkflow node.
 * Passes input data to a target workspace's workflow and collects the result.
 *
 * Currently a structural implementation — the actual cross-workspace invocation
 * requires server-side task creation which will be wired through the DAG context.
 * For now, this validates config and passes data through.
 */
export async function executeExecuteSubWorkflow(
	node: DagNode,
	inputData: Map<string, unknown>,
	currentWorkspaceId?: string,
): Promise<DagNodeResult> {
	const content = node.operationNode
		.content as ExecuteSubWorkflowNodeContent;

	if (!content.targetWorkspaceId) {
		return {
			outputs: new Map([
				["output", null],
				["status", "error"],
				[
					"error",
					"ExecuteSubWorkflow: No target workspace configured",
				],
				["data", { error: "No target workspace configured" }],
			]),
		};
	}

	// Guard against recursive invocation (workflow calling itself)
	if (currentWorkspaceId && content.targetWorkspaceId === currentWorkspaceId) {
		return {
			outputs: new Map([
				["output", null],
				["status", "error"],
				["error", "ExecuteSubWorkflow: Recursive invocation detected — workflow cannot call itself"],
				["data", { error: "Recursive invocation detected" }],
			]),
		};
	}

	// Collect all input data into a single object
	const inputObj: Record<string, unknown> = {};
	for (const [key, value] of inputData) {
		inputObj[key] = value;
	}

	// Apply input mapping if configured
	let mappedInput: Record<string, unknown> = inputObj;
	if (
		content.inputMapping &&
		Object.keys(content.inputMapping).length > 0
	) {
		mappedInput = {};
		for (const [targetKey, sourceKey] of Object.entries(
			content.inputMapping,
		)) {
			mappedInput[targetKey] = inputObj[sourceKey] ?? null;
		}
	}

	// The actual sub-workflow execution will be handled by the runtime context
	// This node stores the config and passes data through for now
	// The DAG executor context will call vibexe.createAndStartTask() when available
	return {
		outputs: new Map([
			["output", mappedInput],
			["status", "completed"],
			["targetWorkspaceId", content.targetWorkspaceId],
			["data", mappedInput],
		]),
	};
}
