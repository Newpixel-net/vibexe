import type { EditFieldsNodeContent } from "@giselles-ai/protocol";
import { navigatePath } from "../expressions/evaluate";
import { evaluateN8NExpressions } from "../expressions/n8n-expression-evaluator";
import type { NodeOutputLookup } from "../expressions/resolve-dag-expressions";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute an EditFields node: apply set/remove/rename operations to data.
 * If keepOnlySet is true, output only explicitly set fields.
 */
export async function executeEditFields(
	node: DagNode,
	inputData: Map<string, unknown>,
	dagLookup?: NodeOutputLookup,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as EditFieldsNodeContent;

	// Get the data to edit — either an array of items or a single object
	const items = extractItems(inputData);
	const processed = items.map((item) => processItem(item, content));

	// If input was a single item, output single item; otherwise array
	const output = items.length === 1 && !isArrayInput(inputData)
		? processed[0]
		: processed;

	// Evaluate any remaining raw N8N expressions in the output values
	// (e.g., EditFields "set" operations with $json['key'] or regex expressions)
	if (output && typeof output === "object" && !Array.isArray(output)) {
		const inputObj: Record<string, unknown> = {};
		for (const [k, v] of inputData) {
			inputObj[k] = v;
		}
		evaluateN8NExpressions(
			output as Record<string, unknown>,
			inputObj,
			dagLookup,
		);
	}

	return {
		outputs: new Map([
			["output", output], // matches factory accessor "output"
			["data", output],
		]),
	};
}

function processItem(
	item: unknown,
	content: EditFieldsNodeContent,
): unknown {
	const obj =
		typeof item === "object" && item !== null
			? { ...(item as Record<string, unknown>) }
			: { value: item };

	const result: Record<string, unknown> = content.keepOnlySet ? {} : { ...obj };

	for (const op of content.operations) {
		switch (op.operation) {
			case "set": {
				// Value can be a literal or an expression reference to a field
				let value: unknown = op.value;
				if (typeof op.value === "string" && op.value.includes("{{")) {
					// Pure single expression like {{field}} — preserves original type
					const pureMatch = op.value.match(/^\{\{([^}]+)\}\}$/);
					if (pureMatch) {
						value = navigatePath(obj, pureMatch[1].trim());
					} else {
						// Template interpolation: replace ALL {{field}} placeholders
						value = op.value.replace(
							/\{\{([^}]+)\}\}/g,
							(_match, expr: string) => {
								const resolved = navigatePath(obj, expr.trim());
								if (resolved === undefined || resolved === null) return "";
								if (typeof resolved === "string") return resolved;
								try { return JSON.stringify(resolved); } catch { return String(resolved); }
							},
						);
					}
				}
				result[op.fieldName] = value;
				break;
			}
			case "remove":
				delete result[op.fieldName];
				break;
			case "rename":
				if (op.newFieldName && op.fieldName in result) {
					result[op.newFieldName] = result[op.fieldName];
					delete result[op.fieldName];
				}
				break;
		}
	}

	return result;
}

function extractItems(inputData: Map<string, unknown>): unknown[] {
	for (const [, value] of inputData) {
		if (Array.isArray(value)) return value;
	}
	const firstEntry = inputData.entries().next();
	if (!firstEntry.done) {
		const [, value] = firstEntry.value;
		return [value];
	}
	return [{}];
}

function isArrayInput(inputData: Map<string, unknown>): boolean {
	for (const [, value] of inputData) {
		if (Array.isArray(value)) return true;
	}
	return false;
}
