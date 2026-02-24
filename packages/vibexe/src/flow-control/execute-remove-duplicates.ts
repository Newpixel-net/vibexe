import type { RemoveDuplicatesNodeContent } from "@vibexe-ai/protocol";
import { navigatePath } from "../expressions/evaluate";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

export async function executeRemoveDuplicates(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as RemoveDuplicatesNodeContent;
	const items = extractArray(inputData);

	if (items.length === 0) {
		return { outputs: new Map([["output", []], ["data", []]]) };
	}

	const seen = new Set<string>();
	const result: unknown[] = [];

	// If keepFirst is false, iterate in reverse then reverse back
	const iterItems = content.keepFirst ? items : [...items].reverse();

	for (const item of iterItems) {
		const key = buildKey(item, content.fields);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(item);
		}
	}

	const finalResult = content.keepFirst ? result : result.reverse();

	return {
		outputs: new Map([
			["output", finalResult],
			["data", finalResult],
		]),
	};
}

function buildKey(item: unknown, fields: string[]): string {
	if (item == null || typeof item !== "object") {
		return JSON.stringify(item);
	}
	const obj = item as Record<string, unknown>;
	if (fields.length === 0) {
		// Compare all fields
		return JSON.stringify(obj);
	}
	return fields.map((f) => JSON.stringify(navigatePath(obj, f))).join("\x00");
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
