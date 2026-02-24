import type { IfNodeContent } from "@vibexe-ai/protocol";
import { evaluateConditionGroup } from "../expressions/evaluate";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute an If node: evaluate conditions against input data.
 *
 * N8N-style per-item evaluation:
 * - If input is an array, each item is evaluated independently.
 *   Matching items → "true" port, non-matching → "false" port.
 * - If input is a single object, it's evaluated as-is and the
 *   entire object is routed to one branch.
 *
 * Sets activeOutputPort so the DAG executor can skip empty branches.
 */
export async function executeIf(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as IfNodeContent;

	// Check if input contains an array for per-item evaluation
	const items = extractArray(inputData);

	if (items !== null) {
		// Per-item mode: evaluate each item and split into true/false arrays
		const trueItems: unknown[] = [];
		const falseItems: unknown[] = [];

		for (const item of items) {
			if (evaluateConditionGroup(content.conditionGroup, item)) {
				trueItems.push(item);
			} else {
				falseItems.push(item);
			}
		}

		// Set activeOutputPort to skip empty branches
		if (trueItems.length > 0 && falseItems.length === 0) {
			node.activeOutputPort = "true";
		} else if (trueItems.length === 0 && falseItems.length === 0) {
			// Empty input array — nothing matched, route to false branch
			node.activeOutputPort = "false";
		} else if (falseItems.length > 0 && trueItems.length === 0) {
			node.activeOutputPort = "false";
		} else {
			// Both branches have items — use sentinel so DAG executor activates both
			node.activeOutputPort = "__both__";
		}

		return {
			outputs: new Map([
				["true", trueItems],
				["false", falseItems],
				["result", trueItems.length > 0],
				["data", trueItems.length > 0 ? trueItems : falseItems],
			]),
		};
	}

	// Single-object mode: evaluate entire input as one unit
	const data = inputMapToObject(inputData);
	const result = evaluateConditionGroup(content.conditionGroup, data);

	node.activeOutputPort = result ? "true" : "false";

	return {
		outputs: new Map([
			["true", data],
			["false", data],
			["result", result],
			["data", data],
		]),
	};
}

/**
 * Extract an array from input data (for per-item evaluation).
 * Returns null if no array is found (triggers single-object mode).
 */
function extractArray(inputData: Map<string, unknown>): unknown[] | null {
	for (const [, value] of inputData) {
		if (Array.isArray(value)) return value;
	}
	return null;
}

function inputMapToObject(inputData: Map<string, unknown>): unknown {
	if (inputData.size === 1) {
		const [, value] = inputData.entries().next().value as [string, unknown];
		if (typeof value === "object" && value !== null) return value;
		return { value };
	}
	const obj: Record<string, unknown> = {};
	for (const [key, value] of inputData) {
		obj[key] = value;
	}
	return obj;
}
