import type { SwitchNodeContent } from "@vibexe-ai/protocol";
import { evaluateConditionGroup } from "../expressions/evaluate";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a Switch node: evaluate rules in order, route items to matching branch.
 *
 * N8N-style per-item evaluation (when input is an array):
 * - Each item is tested against rules in order; first match wins.
 * - Items are distributed into per-port arrays.
 * - Non-matching items go to the fallback port.
 *
 * Single-object mode: first matching rule wins (current behavior).
 */
export async function executeSwitch(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as SwitchNodeContent;

	// Check for array input (per-item mode)
	const items = extractArray(inputData);

	if (items !== null && content.mode === "rules") {
		// Per-item: distribute items across rule ports
		const portItems = new Map<string, unknown[]>();
		// Initialize all ports with empty arrays
		for (const rule of content.rules) {
			portItems.set(rule.outputPortName, []);
		}
		if (content.hasFallback) {
			portItems.set("fallback", []);
		}

		for (const item of items) {
			let matched = false;
			for (const rule of content.rules) {
				if (evaluateConditionGroup(rule.conditionGroup, item)) {
					const arr = portItems.get(rule.outputPortName) ?? [];
					arr.push(item);
					portItems.set(rule.outputPortName, arr);
					matched = true;
					break; // first match wins
				}
			}
			if (!matched && content.hasFallback) {
				const arr = portItems.get("fallback") ?? [];
				arr.push(item);
				portItems.set("fallback", arr);
			}
		}

		// Find which ports have items
		const activePorts: string[] = [];
		for (const [port, arr] of portItems) {
			if (arr.length > 0) activePorts.push(port);
		}

		// If exactly one port has items, set activeOutputPort for branch skipping
		if (activePorts.length === 1) {
			node.activeOutputPort = activePorts[0];
		} else if (activePorts.length > 1) {
			// Multiple ports have items — use sentinel so DAG executor activates all
			node.activeOutputPort = "__both__";
		}

		const outputs = new Map<string, unknown>();
		outputs.set("matchedRule", activePorts[0] ?? null);
		for (const [port, arr] of portItems) {
			outputs.set(port, arr);
		}
		outputs.set("data", items);
		return { outputs };
	}

	// Single-object mode (original behavior)
	const data = inputMapToObject(inputData);

	if (content.mode === "rules") {
		for (const rule of content.rules) {
			const matches = evaluateConditionGroup(rule.conditionGroup, data);
			if (matches) {
				node.activeOutputPort = rule.outputPortName;
				const outputs = buildSwitchOutputs(content, data, rule.name);
				outputs.set(rule.outputPortName, data);
				return { outputs };
			}
		}

		if (content.hasFallback) {
			node.activeOutputPort = "fallback";
			const outputs = buildSwitchOutputs(content, data, null);
			outputs.set("fallback", data);
			return { outputs };
		}

		// No rules matched and no fallback — return empty outputs
		// Don't leak data to all rule ports; only set metadata
		const outputs = new Map<string, unknown>();
		outputs.set("matchedRule", null);
		outputs.set("data", data);
		return { outputs };
	}

	// Expression mode or unknown mode — pass through on fallback if available
	if (content.hasFallback) {
		node.activeOutputPort = "fallback";
	}
	const outputs = buildSwitchOutputs(content, data, null);
	return { outputs };
}

function extractArray(inputData: Map<string, unknown>): unknown[] | null {
	for (const [, value] of inputData) {
		if (Array.isArray(value)) return value;
	}
	return null;
}

function buildSwitchOutputs(
	content: SwitchNodeContent,
	data: unknown,
	matchedRule: string | null,
): Map<string, unknown> {
	const outputs = new Map<string, unknown>();
	outputs.set("matchedRule", matchedRule);
	outputs.set("data", data);
	for (const rule of content.rules) {
		outputs.set(rule.outputPortName, data);
	}
	if (content.hasFallback) {
		outputs.set("fallback", data);
	}
	return outputs;
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
