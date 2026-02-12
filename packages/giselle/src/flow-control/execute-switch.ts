import type { SwitchNodeContent } from "@giselles-ai/protocol";
import { evaluateConditionGroup } from "../expressions/evaluate";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a Switch node: evaluate rules in order, activate first matching branch.
 * Sets activeOutputPort on the dag node to the matching rule's outputPortName or "fallback".
 */
export async function executeSwitch(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as SwitchNodeContent;

	const data = inputMapToObject(inputData);

	if (content.mode === "rules") {
		for (const rule of content.rules) {
			const matches = evaluateConditionGroup(rule.conditionGroup, data);
			if (matches) {
				node.activeOutputPort = rule.outputPortName;
				return {
					outputs: new Map([
						["matchedRule", rule.name],
						["data", data],
					]),
				};
			}
		}

		// No rule matched — use fallback if configured
		if (content.hasFallback) {
			node.activeOutputPort = "fallback";
			return {
				outputs: new Map([
					["matchedRule", null],
					["data", data],
				]),
			};
		}
	}

	// Expression mode or no match without fallback — pass through
	node.activeOutputPort = "fallback";
	return {
		outputs: new Map([
			["matchedRule", null],
			["data", data],
		]),
	};
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
