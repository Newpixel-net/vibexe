import type { SplitOutNodeContent } from "@vibexe-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

export async function executeSplitOut(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as SplitOutNodeContent;
	const items = extractArray(inputData);

	if (items.length === 0 || !content.fieldToSplit) {
		return {
			outputs: new Map([
				["output", items],
				["data", items],
			]),
		};
	}

	const result: unknown[] = [];

	for (const item of items) {
		if (item == null || typeof item !== "object") {
			result.push(item);
			continue;
		}

		const obj = item as Record<string, unknown>;
		const arrayValue = obj[content.fieldToSplit];

		if (!Array.isArray(arrayValue)) {
			result.push(item);
			continue;
		}

		for (const element of arrayValue) {
			if (content.includeOtherFields) {
				const newObj = { ...obj };
				newObj[content.fieldToSplit] = element;
				result.push(newObj);
			} else {
				result.push(element);
			}
		}
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
