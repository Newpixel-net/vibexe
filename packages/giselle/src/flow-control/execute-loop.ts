import type { LoopNodeContent } from "@giselles-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a Loop node. Modes:
 * - forEach: Iterate over array items, yielding each one
 * - nTimes: Run N times with index
 *
 * NOTE: The actual looping of sub-DAGs is handled by the DAG executor.
 * This handler just determines the iteration data.
 */
export async function executeLoop(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as LoopNodeContent;

	if (content.mode === "forEach") {
		const items = extractArray(inputData);
		const capped = items.slice(0, content.maxIterations);
		return {
			outputs: new Map([
				["items", capped],
				["totalItems", capped.length],
				["data", capped],
			]),
		};
	}

	// nTimes mode
	const n = Math.min(content.nTimes ?? 1, content.maxIterations);
	const indices = Array.from({ length: n }, (_, i) => i);
	return {
		outputs: new Map([
			["items", indices],
			["totalItems", n],
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
