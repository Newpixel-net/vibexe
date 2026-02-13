import type { AggregateNodeContent } from "@giselles-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

export async function executeAggregate(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as AggregateNodeContent;
	const items = extractArray(inputData);

	if (items.length === 0 || content.operations.length === 0) {
		return { outputs: new Map([["output", []], ["data", []]]) };
	}

	// Group items
	const groups = groupItems(items, content.groupBy);

	// Apply aggregate operations to each group
	const results: Record<string, unknown>[] = [];
	for (const [groupKey, groupItems] of groups) {
		const row: Record<string, unknown> = {};

		// Add group-by fields
		if (content.groupBy.length > 0 && groupItems.length > 0) {
			const first = groupItems[0] as Record<string, unknown>;
			for (const field of content.groupBy) {
				row[field] = first[field];
			}
		}

		// Apply each operation
		for (const op of content.operations) {
			const values = groupItems
				.map((item) => getField(item, op.field))
				.filter((v) => v !== undefined && v !== null);

			const resultField = op.resultField || `${op.operation}_${op.field}`;

			switch (op.operation) {
				case "sum":
					row[resultField] = values.reduce((a, b) => toNumber(a) + toNumber(b), 0);
					break;
				case "avg":
					row[resultField] = values.length > 0
						? (values.reduce((a, b) => toNumber(a) + toNumber(b), 0) as number) / values.length
						: 0;
					break;
				case "min":
					row[resultField] = values.length > 0
						? Math.min(...values.map(toNumber))
						: null;
					break;
				case "max":
					row[resultField] = values.length > 0
						? Math.max(...values.map(toNumber))
						: null;
					break;
				case "count":
					row[resultField] = values.length;
					break;
				case "countDistinct":
					row[resultField] = new Set(values.map(String)).size;
					break;
				case "concatenate":
					row[resultField] = values.map(String).join(op.separator ?? ", ");
					break;
			}
		}

		results.push(row);
	}

	return {
		outputs: new Map([
			["output", results],
			["data", results],
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

function getField(item: unknown, field: string): unknown {
	if (item == null || typeof item !== "object") return undefined;
	return (item as Record<string, unknown>)[field];
}

function toNumber(v: unknown): number {
	if (typeof v === "number") return v;
	const n = Number(v);
	return Number.isNaN(n) ? 0 : n;
}

function groupItems(
	items: unknown[],
	groupBy: string[],
): Map<string, unknown[]> {
	if (groupBy.length === 0) {
		return new Map([["__all__", items]]);
	}

	const groups = new Map<string, unknown[]>();
	for (const item of items) {
		const key = groupBy
			.map((field) => String(getField(item, field) ?? ""))
			.join("||");
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(item);
	}
	return groups;
}
