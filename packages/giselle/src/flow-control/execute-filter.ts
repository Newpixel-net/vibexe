import type { FilterNodeContent } from "@giselles-ai/protocol";
import { evaluateConditionGroup } from "../expressions/evaluate";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a Filter node: apply conditions to each item in an array.
 * Two output ports: "kept" and "discarded".
 */
export async function executeFilter(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as FilterNodeContent;

	// Find the array data from inputs
	const items = extractArray(inputData);

	const kept: unknown[] = [];
	const discarded: unknown[] = [];

	for (const item of items) {
		if (evaluateConditionGroup(content.conditionGroup, item)) {
			kept.push(item);
		} else {
			discarded.push(item);
		}
	}

	return {
		outputs: new Map([
			["kept", kept],
			["discarded", discarded],
			["data", kept], // default output is the kept items
		]),
	};
}

function extractArray(inputData: Map<string, unknown>): unknown[] {
	for (const [, value] of inputData) {
		if (Array.isArray(value)) return value;
	}
	// If no array found, treat the first input as a single-item array
	const firstEntry = inputData.entries().next();
	if (!firstEntry.done) {
		const [, value] = firstEntry.value;
		return [value];
	}
	return [];
}
