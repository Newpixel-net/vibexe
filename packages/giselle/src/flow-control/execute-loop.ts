import type { LoopNodeContent } from "@giselles-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a Loop node. Modes:
 * - forEach: Iterate over array items, yielding each one
 * - nTimes: Run N times with index
 *
 * This handler determines the iteration data. The DAG executor's
 * executeLoopIterations() function handles re-executing downstream
 * nodes for each item in the array.
 */
export async function executeLoop(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as LoopNodeContent;

	if (content.mode === "forEach") {
		const items = extractArray(inputData);
		const capped = items.slice(0, Math.max(0, content.maxIterations));
		return {
			outputs: new Map([
				["item", capped],
				["output", capped],
				["done", capped],
				["loop", capped],
				["items", capped],
				["totalItems", capped.length],
				["iterationMode", "forEach"],
				["data", capped],
			]),
		};
	}

	// nTimes mode: generate array of indices [0, 1, ..., n-1]
	const n = Math.max(0, Math.min(content.nTimes ?? 1, content.maxIterations));
	const indices = Array.from({ length: n }, (_, i) => i);
	return {
		outputs: new Map([
			["item", indices],
			["output", indices],
			["done", indices],
			["loop", indices],
			["items", indices],
			["totalItems", n],
			["iterationMode", "nTimes"],
			["data", indices],
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
