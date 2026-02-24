import type { SummarizeNodeContent } from "@vibexe-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

export async function executeSummarize(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as SummarizeNodeContent;
	const items = extractArray(inputData);

	if (items.length === 0) {
		return { outputs: new Map([["output", {}], ["data", {}]]) };
	}

	const result: Record<string, unknown> = {
		totalCount: items.length,
	};

	// If no specific fields, summarize all numeric fields from first item
	const fields =
		content.fields.length > 0
			? content.fields
			: detectNumericFields(items);

	for (const field of fields) {
		const values = items
			.map((item) => getField(item, field))
			.filter((v) => v !== undefined && v !== null)
			.map(toNumber)
			.filter((v) => !Number.isNaN(v));

		const stats: Record<string, unknown> = {};

		for (const op of content.operations) {
			switch (op) {
				case "count":
					stats.count = values.length;
					break;
				case "sum":
					stats.sum = values.reduce((a, b) => a + b, 0);
					break;
				case "avg":
					stats.avg = values.length > 0
						? values.reduce((a, b) => a + b, 0) / values.length
						: 0;
					break;
				case "min":
					stats.min = values.length > 0 ? Math.min(...values) : null;
					break;
				case "max":
					stats.max = values.length > 0 ? Math.max(...values) : null;
					break;
				case "median": {
					const sorted = [...values].sort((a, b) => a - b);
					const mid = Math.floor(sorted.length / 2);
					stats.median = sorted.length > 0
						? sorted.length % 2 === 0
							? (sorted[mid - 1] + sorted[mid]) / 2
							: sorted[mid]
						: null;
					break;
				}
				case "mode": {
					const freq = new Map<number, number>();
					for (const v of values) {
						freq.set(v, (freq.get(v) ?? 0) + 1);
					}
					let maxFreq = 0;
					let modeVal: number | null = null;
					for (const [val, count] of freq) {
						if (count > maxFreq) {
							maxFreq = count;
							modeVal = val;
						}
					}
					stats.mode = modeVal;
					break;
				}
				case "stddev": {
					if (values.length < 2) {
						stats.stddev = 0;
					} else {
						const mean = values.reduce((a, b) => a + b, 0) / values.length;
						const variance =
							values.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
							(values.length - 1);
						stats.stddev = Math.sqrt(variance);
					}
					break;
				}
			}
		}

		result[field] = stats;
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

function getField(item: unknown, field: string): unknown {
	if (item == null || typeof item !== "object") return undefined;
	return (item as Record<string, unknown>)[field];
}

function toNumber(v: unknown): number {
	if (typeof v === "number") return v;
	return Number(v);
}

function detectNumericFields(items: unknown[]): string[] {
	if (items.length === 0) return [];
	const first = items[0];
	if (first == null || typeof first !== "object") return [];
	const fields: string[] = [];
	for (const [key, value] of Object.entries(first as Record<string, unknown>)) {
		if (typeof value === "number" || (typeof value === "string" && !Number.isNaN(Number(value)))) {
			fields.push(key);
		}
	}
	return fields;
}
