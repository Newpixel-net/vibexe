import type { IfNodeContent } from "@giselles-ai/protocol";
import { evaluateConditionGroup } from "../expressions/evaluate";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute an If node: evaluate conditions against input data.
 * Sets activeOutputPort on the dag node to "true" or "false".
 * Returns structured-data output with the result boolean.
 */
export async function executeIf(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as IfNodeContent;

	// Merge all input data into a single object for condition evaluation
	const data = inputMapToObject(inputData);

	const result = evaluateConditionGroup(content.conditionGroup, data);

	// Set active port on the node so the DAG executor knows which branch to take
	node.activeOutputPort = result ? "true" : "false";

	// Output data on BOTH port accessor keys ("true" and "false").
	// The DAG executor handles branching via skipBranch() — only the active
	// branch runs, but collectInputData needs the key to match fromOutputPort.
	return {
		outputs: new Map([
			["true", data],
			["false", data],
			["result", result],
			["data", data],
		]),
	};
}

function inputMapToObject(inputData: Map<string, unknown>): unknown {
	if (inputData.size === 1) {
		// If there's only one input, use it directly
		const [, value] = inputData.entries().next().value as [string, unknown];
		if (typeof value === "object" && value !== null) return value;
		return { value };
	}
	// Otherwise, combine into an object
	const obj: Record<string, unknown> = {};
	for (const [key, value] of inputData) {
		obj[key] = value;
	}
	return obj;
}
