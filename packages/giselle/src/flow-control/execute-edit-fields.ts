import type { EditFieldsNodeContent } from "@giselles-ai/protocol";
import { navigatePath } from "../expressions/evaluate";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute an EditFields node: apply set/remove/rename operations to data.
 * If keepOnlySet is true, output only explicitly set fields.
 */
export async function executeEditFields(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as EditFieldsNodeContent;

	// Get the data to edit — either an array of items or a single object
	const items = extractItems(inputData);
	const processed = items.map((item) => processItem(item, content));

	// If input was a single item, output single item; otherwise array
	const output = items.length === 1 && !isArrayInput(inputData)
		? processed[0]
		: processed;

	return {
		outputs: new Map([["data", output]]),
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
				// If value starts with "{{" it's an expression, resolve from the item
				if (
					typeof op.value === "string" &&
					op.value.startsWith("{{") &&
					op.value.endsWith("}}")
				) {
					const path = op.value.slice(2, -2).trim();
					value = navigatePath(obj, path);
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
