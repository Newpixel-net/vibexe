import type { MergeNodeContent } from "@vibexe-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a Merge node: collect inputs from active branches.
 * Modes:
 * - waitAll: Collect all inputs and combine
 * - waitAny: Use first available input
 * - append: Concatenate all inputs as an array
 * - chooseBranch: Use input from whichever branch actually ran (for If/Switch reconvergence)
 */
export async function executeMerge(
	_node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = _node.operationNode.content as MergeNodeContent;

	switch (content.mode) {
		case "waitAll": {
			// Combine all inputs into a single object
			const combined: Record<string, unknown> = {};
			for (const [key, value] of inputData) {
				combined[key] = value;
			}
			return {
				outputs: new Map([
					["output", combined], // matches factory accessor "output"
					["data", combined],
				]),
			};
		}

		case "waitAny": {
			// Use the first available input
			const firstEntry = inputData.entries().next();
			if (!firstEntry.done) {
				const [, value] = firstEntry.value;
				return {
					outputs: new Map([
						["output", value],
						["data", value],
					]),
				};
			}
			return { outputs: new Map() };
		}

		case "append": {
			// Concatenate all inputs into an array
			const items: unknown[] = [];
			for (const [, value] of inputData) {
				if (Array.isArray(value)) {
					items.push(...value);
				} else {
					items.push(value);
				}
			}
			return {
				outputs: new Map([
					["output", items],
					["data", items],
				]),
			};
		}

		case "chooseBranch":
		default: {
			// Use input from whichever branch ran (non-null)
			for (const [, value] of inputData) {
				if (value !== undefined && value !== null) {
					return {
						outputs: new Map([
							["output", value],
							["data", value],
						]),
					};
				}
			}
			return { outputs: new Map() };
		}
	}
}
