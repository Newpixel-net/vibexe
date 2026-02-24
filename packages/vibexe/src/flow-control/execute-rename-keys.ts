import type { RenameKeysNodeContent } from "@vibexe-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

export async function executeRenameKeys(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as RenameKeysNodeContent;
	const items = extractArray(inputData);

	if (items.length === 0 || content.mappings.length === 0) {
		return {
			outputs: new Map([
				["output", items],
				["data", items],
			]),
		};
	}

	const result = items.map((item) => {
		if (item == null || typeof item !== "object") return item;
		const obj = { ...(item as Record<string, unknown>) };
		for (const mapping of content.mappings) {
			if (mapping.from && mapping.to && mapping.from in obj) {
				obj[mapping.to] = obj[mapping.from];
				if (mapping.from !== mapping.to) {
					delete obj[mapping.from];
				}
			}
		}
		return obj;
	});

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
