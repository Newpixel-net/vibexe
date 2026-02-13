import type { CompareDatasetsNodeContent } from "@giselles-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

export async function executeCompareDatasets(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as CompareDatasetsNodeContent;

	// Get the two input datasets
	const inputA = extractArrayByAccessor(inputData, "inputA");
	const inputB = extractArrayByAccessor(inputData, "inputB");

	const inAOnly: unknown[] = [];
	const inBOnly: unknown[] = [];
	const same: unknown[] = [];
	const different: Array<{ a: unknown; b: unknown }> = [];

	if (content.mergeByFields.length === 0) {
		// No merge fields: compare by full JSON equality
		const setB = new Set(inputB.map((item) => JSON.stringify(item)));
		const setA = new Set(inputA.map((item) => JSON.stringify(item)));

		for (const item of inputA) {
			const key = JSON.stringify(item);
			if (setB.has(key)) {
				same.push(item);
			} else {
				inAOnly.push(item);
			}
		}
		for (const item of inputB) {
			const key = JSON.stringify(item);
			if (!setA.has(key)) {
				inBOnly.push(item);
			}
		}
	} else {
		// Match by merge fields
		const bByKey = new Map<string, unknown[]>();
		for (const item of inputB) {
			const key = buildKey(item, content.mergeByFields);
			if (!bByKey.has(key)) bByKey.set(key, []);
			bByKey.get(key)!.push(item);
		}

		const matchedBKeys = new Set<string>();

		for (const itemA of inputA) {
			const key = buildKey(itemA, content.mergeByFields);
			const bItems = bByKey.get(key);

			if (!bItems || bItems.length === 0) {
				inAOnly.push(itemA);
				continue;
			}

			matchedBKeys.add(key);

			if (content.mode === "firstMatchOnly") {
				const itemB = bItems[0];
				if (JSON.stringify(itemA) === JSON.stringify(itemB)) {
					same.push(itemA);
				} else {
					different.push({ a: itemA, b: itemB });
				}
			} else {
				let foundExact = false;
				for (const itemB of bItems) {
					if (JSON.stringify(itemA) === JSON.stringify(itemB)) {
						same.push(itemA);
						foundExact = true;
						break;
					}
				}
				if (!foundExact) {
					different.push({ a: itemA, b: bItems[0] });
				}
			}
		}

		// Items in B not matched
		for (const item of inputB) {
			const key = buildKey(item, content.mergeByFields);
			if (!matchedBKeys.has(key)) {
				inBOnly.push(item);
			}
		}
	}

	return {
		outputs: new Map([
			["inAOnly", inAOnly],
			["inBOnly", inBOnly],
			["same", same],
			["different", different],
			["data", same], // default output
		]),
	};
}

function buildKey(item: unknown, fields: string[]): string {
	if (item == null || typeof item !== "object") {
		return JSON.stringify(item);
	}
	const obj = item as Record<string, unknown>;
	return fields.map((f) => JSON.stringify(obj[f])).join("||");
}

function extractArrayByAccessor(
	inputData: Map<string, unknown>,
	accessor: string,
): unknown[] {
	const value = inputData.get(accessor);
	if (Array.isArray(value)) return value;
	if (value !== undefined) return [value];

	// Fallback: try first array in inputData
	for (const [, v] of inputData) {
		if (Array.isArray(v)) return v;
	}
	return [];
}
