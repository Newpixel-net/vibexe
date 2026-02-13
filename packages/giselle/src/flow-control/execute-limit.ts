import type { LimitNodeContent } from "@giselles-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

export async function executeLimit(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as LimitNodeContent;
	const items = extractArray(inputData);

	const maxItems = content.maxItems ?? 10;

	let result: unknown[];
	if (content.keep === "last") {
		result = items.slice(-maxItems);
	} else {
		result = items.slice(0, maxItems);
	}

	return {
		outputs: new Map([
			["output", result],
			["data", result],
		]),
	};
}

function extractArray(inputData: Map<string, unknown>): unknown[] {
	for (const [, value] of inputData) {
		if (Array.isArray(value)) return value;
	}
	const firstEntry = inputData.entries().next();
	if (!firstEntry.done) {
		const [, value] = firstEntry.value;
		return [value];
	}
	return [];
}
