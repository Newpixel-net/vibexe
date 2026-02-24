import type { FilterNodeContent } from "@vibexe-ai/protocol";
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
		if (content.conditionGroup && evaluateConditionGroup(content.conditionGroup, item)) {
			kept.push(item);
		} else {
			discarded.push(item);
		}
	}

	// Set activeOutputPort for branch skipping in DAG executor
	if (kept.length > 0 && discarded.length === 0) {
		node.activeOutputPort = "kept";
	} else if (discarded.length > 0 && kept.length === 0) {
		node.activeOutputPort = "discarded";
	} else if (kept.length > 0 && discarded.length > 0) {
		// Both branches have items — use sentinel so DAG executor activates both
		node.activeOutputPort = "__both__";
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
