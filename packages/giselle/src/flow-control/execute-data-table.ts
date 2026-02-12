import type { DataTableNodeContent } from "@giselles-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a Data Table node: CRUD operations on persistent workflow data tables.
 * The actual DB queries are delegated to a context-provided dataTableExecutor.
 *
 * For now, this returns a structured-data result based on the operation type.
 * The context resolver will handle the actual PostgreSQL queries.
 */
export async function executeDataTable(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as DataTableNodeContent;

	if (!content.tableId) {
		return {
			outputs: new Map([
				["data", { error: "No table selected" }],
			]),
		};
	}

	// Resolve field values from inputData (merge static config with dynamic inputs)
	const resolvedFields: Record<string, unknown> = {};
	for (const field of content.fields) {
		// Check if the value references an input (e.g., "{{input:data.name}}")
		let value: unknown = field.value;
		for (const [key, inputVal] of inputData) {
			if (field.value === `{{${key}}}`) {
				value = inputVal;
				break;
			}
		}
		resolvedFields[field.column] = value;
	}

	// Build the operation descriptor — actual execution is handled by the
	// server-side API route that has DB access via Drizzle ORM.
	const operation = {
		type: content.operation,
		tableId: content.tableId,
		tableName: content.tableName,
		fields: resolvedFields,
		filter: content.filter,
		limit: content.limit,
	};

	// The DAG executor passes this result downstream.
	// In future, the context resolver will execute the actual SQL
	// and populate the "data" output with real query results.
	return {
		outputs: new Map([
			["data", operation],
			["operation", content.operation],
		]),
	};
}
