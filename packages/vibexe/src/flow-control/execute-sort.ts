import type { SortNodeContent } from "@vibexe-ai/protocol";
import { navigatePath } from "../expressions/evaluate";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a Sort node: sort array items by one or more sort keys.
 */
export async function executeSort(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as SortNodeContent;

	const items = extractArray(inputData);
	const sorted = [...items];

	if (content.sortKeys.length > 0) {
		sorted.sort((a, b) => {
			for (const sortKey of content.sortKeys) {
				const aVal = navigatePath(a, sortKey.field);
				const bVal = navigatePath(b, sortKey.field);

				const comparison = compareValues(aVal, bVal);
				if (comparison !== 0) {
					return sortKey.direction === "desc" ? -comparison : comparison;
				}
			}
			return 0;
		});
	}

	return {
		outputs: new Map([
			["output", sorted], // matches factory accessor "output"
			["data", sorted],
		]),
	};
}

function compareValues(a: unknown, b: unknown): number {
	// Handle nulls
	if (a === undefined || a === null) return b === undefined || b === null ? 0 : -1;
	if (b === undefined || b === null) return 1;

	// Numbers
	if (typeof a === "number" && typeof b === "number") {
		return a - b;
	}

	// Strings
	const strA = String(a);
	const strB = String(b);

	// Try numeric comparison
	const numA = Number(strA);
	const numB = Number(strB);
	if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
		return numA - numB;
	}

	return strA.localeCompare(strB);
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
