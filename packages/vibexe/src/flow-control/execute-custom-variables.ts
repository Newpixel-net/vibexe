import type { CustomVariablesNodeContent } from "@vibexe-ai/protocol";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Execute a CustomVariables node.
 * Outputs team-level custom variables as key-value data for downstream nodes.
 * The actual variable values are injected by the DAG executor context.
 *
 * This node makes variables available as structured data outputs,
 * allowing other nodes to reference them via expressions or input connections.
 */
export async function executeCustomVariables(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode
		.content as CustomVariablesNodeContent;

	// Variables will be injected by the runtime context
	// For now, pass through input data and add empty vars placeholder
	const inputObj: Record<string, unknown> = {};
	for (const [key, value] of inputData) {
		inputObj[key] = value;
	}

	// If variable keys are specified, filter to only those
	// The actual values come from the team_custom_variables DB table
	const variableKeys = content.variableKeys ?? [];
	const prefix = content.prefix ?? "vars";

	// The variables will be populated by the server-side execution context
	// which has access to the DB. This executor provides the output structure.
	const variables: Record<string, unknown> = {};

	return {
		outputs: new Map([
			["variables", variables],
			["prefix", prefix],
			["keys", variableKeys],
			["data", { variables, prefix, requestedKeys: variableKeys }],
		]),
	};
}
