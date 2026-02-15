/**
 * N8N Workflow Converter: Converts N8N workflow JSON to Giselle workspace format.
 *
 * Supports native V6 flow-control nodes (If, Switch, Merge, Loop, Code, Filter,
 * EditFields, Sort, Wait) which trigger the DAG executor at runtime.
 */

import {
	ConnectionId,
	InputId,
	NodeId,
	OutputId,
} from "@giselles-ai/protocol";
import {
	type N8NConnections,
	convertConnections,
} from "./connection-mapping";
import { mapN8NNodeType } from "./node-mapping";

// N8N Workflow JSON types
export interface N8NWorkflow {
	name?: string;
	nodes: N8NNode[];
	connections: N8NConnections;
	settings?: Record<string, unknown>;
}

export interface N8NNode {
	id?: string;
	name: string;
	type: string;
	position: [number, number];
	parameters: Record<string, unknown>;
	credentials?: Record<string, unknown>;
	typeVersion?: number;
	disabled?: boolean;
}

// Giselle workspace types (simplified for conversion)
export interface GiselleWorkspaceData {
	name: string;
	nodes: GiselleNodeData[];
	connections: GiselleConnectionData[];
	warnings: ConversionWarning[];
	hasFlowControl: boolean;
	uiState: {
		nodePositions: Record<string, { x: number; y: number }>;
	};
}

export interface GiselleNodeData {
	id: string;
	type: "operation" | "variable";
	name: string;
	content: Record<string, unknown>;
	inputs: Array<{ id: string; label: string; accessor: string }>;
	outputs: Array<{ id: string; label: string; accessor: string }>;
}

export interface GiselleConnectionData {
	id: string;
	outputNode: { id: string; type: string; content: { type: string } };
	outputId: string;
	inputNode: { id: string; type: string; content: { type: string } };
	inputId: string;
}

export interface ConversionWarning {
	nodeType: string;
	nodeName: string;
	message: string;
}

// Flow-control content types that trigger DAG execution
const FLOW_CONTROL_TYPES = new Set([
	"if", "switch", "merge", "loop", "code", "filter",
	"editFields", "sort", "wait",
]);

/**
 * Convert an N8N workflow JSON to Giselle workspace data.
 */
export function convertN8NToGiselle(
	n8nWorkflow: N8NWorkflow,
): GiselleWorkspaceData {
	const warnings: ConversionWarning[] = [];
	const giselleNodes: GiselleNodeData[] = [];
	const nodePositions: Record<string, { x: number; y: number }> = {};
	const nodeIdMapping: Record<
		string,
		{
			nodeId: string;
			nodeType: "operation" | "variable";
			contentType: string;
			outputIds: string[];
			inputIds: string[];
		}
	> = {};

	let hasFlowControl = false;

	// Phase 1: Convert each N8N node
	for (const n8nNode of n8nWorkflow.nodes) {
		const mapping = mapN8NNodeType(n8nNode.type);

		if (mapping.type === "skip") {
			warnings.push({
				nodeType: n8nNode.type,
				nodeName: n8nNode.name,
				message: mapping.reason,
			});
			continue;
		}

		const giselleNode = createGiselleNode(n8nNode, mapping);
		if (giselleNode) {
			giselleNodes.push(giselleNode);
			nodePositions[giselleNode.id] = {
				x: n8nNode.position[0],
				y: n8nNode.position[1],
			};

			const contentType = (giselleNode.content as { type: string }).type;
			if (FLOW_CONTROL_TYPES.has(contentType)) {
				hasFlowControl = true;
			}

			nodeIdMapping[n8nNode.name] = {
				nodeId: giselleNode.id,
				nodeType: giselleNode.type,
				contentType,
				outputIds: giselleNode.outputs.map((o) => o.id),
				inputIds: giselleNode.inputs.map((i) => i.id),
			};
		}
	}

	// Phase 2: Convert connections
	const connections = convertConnections(
		n8nWorkflow.connections,
		nodeIdMapping,
		() => ConnectionId.generate(),
	);

	// Phase 3: Compute clean layout
	const layoutPositions = computeLayout(
		giselleNodes,
		connections,
		nodePositions,
	);

	return {
		name: n8nWorkflow.name ?? "Imported N8N Workflow",
		nodes: giselleNodes,
		connections,
		warnings,
		hasFlowControl,
		uiState: {
			nodePositions: layoutPositions,
		},
	};
}

function createGiselleNode(
	n8nNode: N8NNode,
	mapping: Exclude<ReturnType<typeof mapN8NNodeType>, { type: "skip" }>,
): GiselleNodeData | null {
	switch (mapping.type) {
		case "trigger":
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "trigger",
					provider: "manual",
					state: { status: "unconfigured" },
				},
				inputs: [],
				outputs: [
					{
						id: OutputId.generate(),
						label: "Output",
						accessor: "trigger-output",
					},
				],
			};

		case "nativeTrigger":
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "trigger",
					provider: mapping.provider,
					state: { status: "unconfigured" },
				},
				inputs: [],
				outputs: [
					{
						id: OutputId.generate(),
						label: "Output",
						accessor: "trigger-output",
					},
				],
			};

		case "textGeneration": {
			const modelId = extractModelId(n8nNode.parameters) ?? mapping.modelId;
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "textGeneration",
					llm: {
						provider: mapping.provider,
						id: modelId,
						configurations: getDefaultLlmConfigurations(mapping.provider),
					},
					prompt: extractPromptFromN8NParams(n8nNode.parameters),
				},
				inputs: [
					{
						id: InputId.generate(),
						label: "Input",
						accessor: "input",
					},
				],
				outputs: [
					{
						id: OutputId.generate(),
						label: "Output",
						accessor: "generated-text",
					},
				],
			};
		}

		case "integration":
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "integration",
					pieceName: mapping.pieceName,
					actionName: resolveActionName(
						mapping.pieceName,
						mapping.actionName,
						n8nNode.parameters,
					),
					pieceVersion: "latest",
					configuration: convertN8NParameters(n8nNode.parameters),
				},
				inputs: [
					{
						id: InputId.generate(),
						label: "Input",
						accessor: "input",
					},
				],
				outputs: [
					{
						id: OutputId.generate(),
						label: "Result",
						accessor: "action-result",
					},
				],
			};

		// --- Native V6 Flow Control Nodes ---

		case "nativeIf": {
			const conditionData = convertN8NConditions(n8nNode.parameters);
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "if",
					conditionGroup: conditionData,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "True", accessor: "true" },
					{ id: OutputId.generate(), label: "False", accessor: "false" },
				],
			};
		}

		case "nativeSwitch": {
			const switchData = convertN8NSwitchRules(n8nNode.parameters);
			const switchOutputs = [];
			for (let i = 0; i < switchData.outputCount; i++) {
				switchOutputs.push({
					id: OutputId.generate(),
					label: `Rule ${i + 1}`,
					accessor: `rule_${i}`,
				});
			}
			switchOutputs.push({
				id: OutputId.generate(),
				label: "Fallback",
				accessor: "fallback",
			});
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "switch",
					mode: "rules",
					rules: switchData.rules,
					hasFallback: true,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: switchOutputs,
			};
		}

		case "nativeMerge": {
			const mergeMode = extractMergeMode(n8nNode.parameters);
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "merge",
					mode: mergeMode,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input 1", accessor: "input1" },
					{ id: InputId.generate(), label: "Input 2", accessor: "input2" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Output", accessor: "output" },
				],
			};
		}

		case "nativeLoop": {
			const loopConfig = extractLoopConfig(n8nNode.parameters);
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "loop",
					mode: "forEach",
					maxIterations: loopConfig.maxIterations,
				},
				inputs: [
					{ id: InputId.generate(), label: "Items", accessor: "items" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Done", accessor: "done" },
					{ id: OutputId.generate(), label: "Loop", accessor: "loop" },
				],
			};
		}

		case "nativeCode": {
			const codeData = extractCodeContent(n8nNode.parameters);
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "code",
					code: codeData.code,
					language: codeData.language,
					timeout: 10000,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Output", accessor: "output" },
				],
			};
		}

		case "nativeFilter": {
			const filterData = convertN8NConditions(n8nNode.parameters);
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "filter",
					conditionGroup: filterData,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Kept", accessor: "kept" },
					{ id: OutputId.generate(), label: "Discarded", accessor: "discarded" },
				],
			};
		}

		case "nativeEditFields": {
			const fieldOps = convertN8NSetToFieldOperations(n8nNode.parameters);
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "editFields",
					operations: fieldOps,
					keepOnlySet: Boolean(n8nNode.parameters.keepOnlySet),
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Output", accessor: "output" },
				],
			};
		}

		case "nativeSort": {
			const sortKeys = convertN8NSortKeys(n8nNode.parameters);
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "sort",
					sortKeys,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Output", accessor: "output" },
				],
			};
		}

		case "nativeWait": {
			const delaySeconds = extractWaitSeconds(n8nNode.parameters);
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "wait",
					mode: "fixedTime",
					delaySeconds,
					timeoutSeconds: 86400,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Output", accessor: "output" },
				],
			};
		}

		case "text":
			return {
				id: NodeId.generate(),
				type: "variable",
				name: n8nNode.name,
				content: {
					type: "text",
					text: extractTextFromN8NParams(n8nNode.parameters),
				},
				inputs: [],
				outputs: [],
			};

		case "end":
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name || "End",
				content: { type: "end" },
				inputs: [
					{
						id: InputId.generate(),
						label: "Input",
						accessor: "input",
					},
				],
				outputs: [],
			};

		default:
			return null;
	}
}

// ─── N8N Operator Mapping ────────────────────────────────────────────────────

/** Maps N8N condition operator strings to Giselle Condition operator enum values */
const N8N_OPERATOR_MAP: Record<string, string> = {
	// String operators
	equal: "equals",
	equals: "equals",
	notEqual: "notEquals",
	contains: "contains",
	notContains: "notContains",
	startsWith: "startsWith",
	endsWith: "endsWith",
	regex: "regex",
	isEmpty: "isEmpty",
	isNotEmpty: "isNotEmpty",
	// Number operators
	larger: "greaterThan",
	largerEqual: "greaterThanOrEqual",
	smaller: "lessThan",
	smallerEqual: "lessThanOrEqual",
	// Boolean
	isTrue: "isTrue",
	isFalse: "isFalse",
	// Existence
	exists: "isNotEmpty",
	notExists: "isEmpty",
};

// ─── Parameter Conversion Helpers ────────────────────────────────────────────

/**
 * Convert N8N If/Filter conditions to Giselle conditionGroup format.
 * Handles both N8N v1 format (params.conditions.string/number/boolean)
 * and v2 format (params.conditions array).
 */
function convertN8NConditions(
	params: Record<string, unknown>,
): { conditions: Array<{ field: string; operator: string; value: string }>; combineWith: "and" | "or" } {
	const combineWith: "and" | "or" =
		(params.combineOperation as string) === "any" ||
		(params.combineWith as string) === "or"
			? "or"
			: "and";

	const conditions: Array<{ field: string; operator: string; value: string }> = [];

	// V2 format: params.conditions is an object with a conditions array
	const conditionsParam = params.conditions;
	if (conditionsParam && typeof conditionsParam === "object") {
		// V2: { conditions: [...] }
		const condObj = conditionsParam as Record<string, unknown>;
		if (Array.isArray(condObj.conditions)) {
			for (const cond of condObj.conditions) {
				const c = cond as Record<string, unknown>;
				const leftValue = cleanN8NExpression(String(c.leftValue ?? c.value1 ?? ""));
				const rightValue = cleanN8NExpression(String(c.rightValue ?? c.value2 ?? ""));
				const op = N8N_OPERATOR_MAP[String(c.operator ?? "")] ?? "equals";
				conditions.push({ field: leftValue, operator: op, value: rightValue });
			}
			return { conditions, combineWith };
		}

		// V1: { string: [...], number: [...], boolean: [...] }
		for (const dataType of ["string", "number", "boolean"]) {
			const typedConditions = condObj[dataType];
			if (Array.isArray(typedConditions)) {
				for (const cond of typedConditions) {
					const c = cond as Record<string, unknown>;
					const field = cleanN8NExpression(String(c.value1 ?? ""));
					const value = cleanN8NExpression(String(c.value2 ?? ""));
					const op = N8N_OPERATOR_MAP[String(c.operation ?? "")] ?? "equals";
					conditions.push({ field, operator: op, value });
				}
			}
		}
	}

	// V2 alternate: params.options?.conditions (filter node format)
	const options = params.options as Record<string, unknown> | undefined;
	if (conditions.length === 0 && options?.conditions) {
		const filterConds = options.conditions;
		if (Array.isArray(filterConds)) {
			for (const cond of filterConds) {
				const c = cond as Record<string, unknown>;
				const field = cleanN8NExpression(String(c.leftValue ?? c.field ?? ""));
				const value = cleanN8NExpression(String(c.rightValue ?? c.value ?? ""));
				const op = N8N_OPERATOR_MAP[String(c.operator ?? "")] ?? "equals";
				conditions.push({ field, operator: op, value });
			}
		}
	}

	return { conditions, combineWith };
}

/**
 * Convert N8N Switch rules to Giselle switch rules format.
 */
function convertN8NSwitchRules(
	params: Record<string, unknown>,
): { rules: Array<{ name: string; conditionGroup: { conditions: Array<{ field: string; operator: string; value: string }>; combineWith: "and" | "or" }; outputPortName: string }>; outputCount: number } {
	const rules: Array<{
		name: string;
		conditionGroup: { conditions: Array<{ field: string; operator: string; value: string }>; combineWith: "and" | "or" };
		outputPortName: string;
	}> = [];

	// N8N switch can have rules array or numbered rule params
	const rulesParam = params.rules;
	if (rulesParam && typeof rulesParam === "object") {
		const rulesObj = rulesParam as Record<string, unknown>;
		const ruleValues = rulesObj.values ?? rulesObj.rules;
		if (Array.isArray(ruleValues)) {
			for (let i = 0; i < ruleValues.length; i++) {
				const rule = ruleValues[i] as Record<string, unknown>;
				const conditions: Array<{ field: string; operator: string; value: string }> = [];

				// Each rule may have conditions
				const ruleConds = rule.conditions;
				if (ruleConds && typeof ruleConds === "object") {
					const condObj = ruleConds as Record<string, unknown>;
					if (Array.isArray(condObj.conditions)) {
						for (const cond of condObj.conditions) {
							const c = cond as Record<string, unknown>;
							const field = cleanN8NExpression(String(c.leftValue ?? c.value1 ?? ""));
							const value = cleanN8NExpression(String(c.rightValue ?? c.value2 ?? ""));
							const op = N8N_OPERATOR_MAP[String(c.operator ?? "")] ?? "equals";
							conditions.push({ field, operator: op, value });
						}
					}
				}

				rules.push({
					name: String(rule.name ?? `Rule ${i + 1}`),
					conditionGroup: { conditions, combineWith: "and" },
					outputPortName: `rule_${i}`,
				});
			}
		}
	}

	// If no rules parsed, create 2 default rules
	if (rules.length === 0) {
		const outputCount = typeof params.numberOutputs === "number"
			? params.numberOutputs
			: 2;
		for (let i = 0; i < outputCount; i++) {
			rules.push({
				name: `Rule ${i + 1}`,
				conditionGroup: { conditions: [], combineWith: "and" },
				outputPortName: `rule_${i}`,
			});
		}
		return { rules, outputCount };
	}

	return { rules, outputCount: rules.length };
}

/**
 * Extract merge mode from N8N merge node parameters.
 */
function extractMergeMode(
	params: Record<string, unknown>,
): "waitAll" | "append" | "chooseBranch" {
	const mode = (params.mode as string) ?? "";
	switch (mode.toLowerCase()) {
		case "append":
			return "append";
		case "multiplex":
		case "combinebylookingup":
		case "combinebyposition":
		case "waitall":
			return "waitAll";
		case "choosebranch":
		case "passthrough":
		default:
			return "chooseBranch";
	}
}

/**
 * Extract loop configuration from N8N SplitInBatches parameters.
 */
function extractLoopConfig(
	params: Record<string, unknown>,
): { maxIterations: number } {
	const options = params.options as Record<string, unknown> | undefined;
	const batchSize = Number(params.batchSize ?? options?.batchSize ?? 100);
	return { maxIterations: Math.max(batchSize, 1) };
}

/**
 * Extract code content from N8N Code/Function node parameters.
 */
function extractCodeContent(
	params: Record<string, unknown>,
): { code: string; language: "javascript" | "python" } {
	const jsCode = params.jsCode as string | undefined;
	const functionCode = params.functionCode as string | undefined;
	const pythonCode = params.pythonCode as string | undefined;

	if (pythonCode) {
		return { code: cleanN8NExpression(pythonCode), language: "python" };
	}

	const code = jsCode ?? functionCode ?? "// Process items and return result\nreturn items;";
	return { code: cleanN8NExpression(code), language: "javascript" };
}

/**
 * Extract wait delay in seconds from N8N Wait node parameters.
 */
function extractWaitSeconds(
	params: Record<string, unknown>,
): number {
	const amount = Number(params.amount ?? params.value ?? 0);
	const unit = (params.unit as string) ?? "seconds";

	switch (unit) {
		case "milliseconds":
			return Math.max(Math.round(amount / 1000), 1);
		case "seconds":
			return amount;
		case "minutes":
			return amount * 60;
		case "hours":
			return amount * 3600;
		case "days":
			return amount * 86400;
		default:
			return amount;
	}
}

/**
 * Convert N8N Set node assignments to Giselle EditFields operations.
 */
function convertN8NSetToFieldOperations(
	params: Record<string, unknown>,
): Array<{ name: string; type: string; value: string }> {
	const operations: Array<{ name: string; type: string; value: string }> = [];

	// V2 format: params.assignments.assignments = [{ name, value, type }]
	const assignments = params.assignments as
		| { assignments?: Array<{ name: string; value: unknown; type?: string }> }
		| undefined;
	if (assignments?.assignments) {
		for (const a of assignments.assignments) {
			operations.push({
				name: a.name,
				type: a.type ?? "string",
				value: cleanN8NExpression(String(a.value ?? "")),
			});
		}
		return operations;
	}

	// V1 format: params.values.string/number/boolean = [{ name, value }]
	const values = params.values as Record<string, unknown> | undefined;
	if (values && typeof values === "object") {
		for (const dataType of ["string", "number", "boolean"]) {
			const typedValues = (values as Record<string, unknown>)[dataType];
			if (Array.isArray(typedValues)) {
				for (const v of typedValues) {
					const item = v as Record<string, unknown>;
					operations.push({
						name: String(item.name ?? ""),
						type: dataType,
						value: cleanN8NExpression(String(item.value ?? "")),
					});
				}
			}
		}
	}

	return operations;
}

/**
 * Convert N8N Sort node fields to Giselle sortKeys.
 */
function convertN8NSortKeys(
	params: Record<string, unknown>,
): Array<{ field: string; direction: "asc" | "desc" }> {
	const sortKeys: Array<{ field: string; direction: "asc" | "desc" }> = [];

	// V1: params.sortFieldsUi.sortField = [{ fieldName, order }]
	const sortFieldsUi = params.sortFieldsUi as Record<string, unknown> | undefined;
	if (sortFieldsUi?.sortField && Array.isArray(sortFieldsUi.sortField)) {
		for (const sf of sortFieldsUi.sortField) {
			const item = sf as Record<string, unknown>;
			sortKeys.push({
				field: String(item.fieldName ?? ""),
				direction: (item.order as string) === "descending" ? "desc" : "asc",
			});
		}
	}

	// V2: params.options?.sortFields = [{ field, direction }]
	const options = params.options as Record<string, unknown> | undefined;
	if (sortKeys.length === 0 && options?.sortFields && Array.isArray(options.sortFields)) {
		for (const sf of options.sortFields) {
			const item = sf as Record<string, unknown>;
			sortKeys.push({
				field: String(item.field ?? item.fieldName ?? ""),
				direction: (item.direction as string) === "desc" ? "desc" : "asc",
			});
		}
	}

	return sortKeys;
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────

/**
 * Wrap plain text into a TipTap JSON document string.
 * Giselle's TextEditor component expects content in TipTap JSON format,
 * so we must convert plain text from N8N into this structure.
 */
function plainTextToTipTapJson(text: string): string {
	if (!text) {
		return JSON.stringify({ type: "doc", content: [] });
	}
	const lines = text.split("\n");
	const paragraphs = lines.map((line) => {
		if (line === "") {
			return { type: "paragraph" as const };
		}
		return {
			type: "paragraph" as const,
			content: [{ type: "text" as const, text: line }],
		};
	});
	return JSON.stringify({ type: "doc", content: paragraphs });
}

function extractPromptFromN8NParams(params: Record<string, unknown>): string {
	// Handle OpenAI messages format: { messages: { values: [{ content, role }] } }
	if (params.messages && typeof params.messages === "object") {
		const messagesObj = params.messages as Record<string, unknown>;
		const vals = messagesObj.values;
		if (Array.isArray(vals)) {
			const parts = vals.map(
				(m: Record<string, unknown>) => {
					const role = String(m.role ?? "user");
					const content = cleanN8NExpression(String(m.content ?? ""));
					if (role === "system") return `[System]\n${content}`;
					return content;
				},
			);
			return plainTextToTipTapJson(parts.join("\n\n"));
		}
	}

	// N8N LLM nodes store prompt in various locations
	const prompt =
		params.prompt ??
		params.text ??
		params.content ??
		"";
	let plainText: string;
	if (typeof prompt === "string") {
		plainText = cleanN8NExpression(prompt);
	} else if (Array.isArray(prompt)) {
		plainText = prompt
			.map((m) => {
				if (typeof m === "string") return cleanN8NExpression(m);
				if (typeof m === "object" && m !== null) {
					const c = (m as Record<string, unknown>).content ?? "";
					return cleanN8NExpression(String(c));
				}
				return "";
			})
			.join("\n");
	} else {
		plainText = JSON.stringify(prompt);
	}
	return plainTextToTipTapJson(plainText);
}

function extractTextFromN8NParams(params: Record<string, unknown>): string {
	// Sticky notes store content in 'content' parameter
	const plainText =
		(params.content as string) ?? (params.text as string) ?? "";
	return plainTextToTipTapJson(plainText);
}

// N8N operation name -> Activepieces action name per piece
const N8N_ACTION_MAP: Record<string, Record<string, string>> = {
	"google-sheets": {
		default: "find_rows",
		getAll: "find_rows",
		get: "find_rows",
		lookup: "find_rows",
		update: "update_row",
		append: "insert_row",
		delete: "delete_row",
		clear: "clear_sheet",
		read: "find_rows",
	},
	"google-drive": {
		default: "upload_file",
		upload: "upload_file",
		create: "create_folder",
		copy: "duplicate_file",
		delete: "delete_file",
		list: "list_files",
		move: "move_file",
		share: "share_file",
	},
	gmail: {
		default: "send_email",
		send: "send_email",
		reply: "send_email",
		getAll: "read_email",
		get: "read_email",
	},
	http: {
		default: "send_request",
	},
	slack: {
		default: "send_channel_message",
		postMessage: "send_channel_message",
		send: "send_channel_message",
	},
	discord: {
		default: "send_message_webhook",
		sendMessage: "send_message_webhook",
	},
	notion: {
		default: "create_database_item",
		create: "create_database_item",
		update: "update_database_item",
		getAll: "read_database_item",
	},
	airtable: {
		default: "create_record",
		create: "create_record",
		update: "update_record",
		list: "list_records",
		get: "get_record",
		delete: "delete_record",
	},
};

function resolveActionName(
	pieceName: string,
	defaultAction: string,
	params: Record<string, unknown>,
): string {
	// Extract raw operation from N8N params
	let rawAction = defaultAction;
	if (params.operation && typeof params.operation === "string") {
		rawAction = params.operation;
	} else if (params.action && typeof params.action === "string") {
		rawAction = params.action;
	}

	// Consult the action map for this piece
	const pieceMap = N8N_ACTION_MAP[pieceName];
	if (pieceMap) {
		if (rawAction in pieceMap) {
			return pieceMap[rawAction];
		}
		// Try with resource prefix: e.g. "sheet_update"
		if (params.resource && typeof params.resource === "string") {
			const combined = `${params.resource}_${rawAction}`;
			if (combined in pieceMap) {
				return pieceMap[combined];
			}
		}
		if ("default" in pieceMap) {
			return pieceMap.default;
		}
	}

	// Fallback: use raw action if not "default"
	if (rawAction !== "default") {
		return rawAction;
	}
	return defaultAction;
}

function getDefaultLlmConfigurations(
	provider: string,
): Record<string, unknown> {
	switch (provider) {
		case "openai":
			return {
				temperature: 0.7,
				topP: 1.0,
				presencePenalty: 0.0,
				frequencyPenalty: 0.0,
			};
		case "anthropic":
			return {
				temperature: 0.7,
				topP: 1.0,
				reasoningText: false,
			};
		case "google":
			return {
				temperature: 0.7,
				topP: 1.0,
				searchGrounding: false,
			};
		case "perplexity":
			return {
				temperature: 0.7,
				topP: 1.0,
				presencePenalty: 0.0,
				frequencyPenalty: 0.0,
			};
		default:
			return {
				temperature: 0.7,
				topP: 1.0,
			};
	}
}

function extractModelId(
	params: Record<string, unknown>,
): string | null {
	const modelId = params.modelId ?? params.model;
	if (!modelId) return null;
	// N8N resource locator: { __rl: true, value: "gpt-5" }
	if (typeof modelId === "object" && modelId !== null) {
		const rl = modelId as Record<string, unknown>;
		if (rl.__rl && typeof rl.value === "string") {
			return rl.value;
		}
		if (typeof rl.value === "string") {
			return rl.value;
		}
		return null;
	}
	if (typeof modelId === "string") {
		return modelId;
	}
	return null;
}

function cleanN8NExpression(value: string): string {
	if (!value) return value;
	// Strip leading = prefix
	let cleaned = value.startsWith("=") ? value.slice(1) : value;
	// Replace {{ $('NodeName').item.json.field }} with [NodeName.field]
	cleaned = cleaned.replace(
		/\{\{\s*\$\(['"]([^'"]+)['"]\)\.item\.json\.([^\s}]+)\s*\}\}/g,
		"[$1.$2]",
	);
	// Replace {{ $('NodeName').item.json }} with [NodeName]
	cleaned = cleaned.replace(
		/\{\{\s*\$\(['"]([^'"]+)['"]\)\.item\.json\s*\}\}/g,
		"[$1]",
	);
	// Replace {{ $json.field }} or {{ $json["field"] }} with [input.field]
	cleaned = cleaned.replace(
		/\{\{\s*\$json(?:\.|\[['"])([^\s}'"\]]+)(?:['"]\])?\s*\}\}/g,
		"[input.$1]",
	);
	// Replace {{ $json }} with [input]
	cleaned = cleaned.replace(/\{\{\s*\$json\s*\}\}/g, "[input]");
	// Replace {{ $now.format(...) }} with [timestamp]
	cleaned = cleaned.replace(
		/\{\{\s*\$now\.format\([^)]*\)\s*\}\}/g,
		"[timestamp]",
	);
	// Replace {{ $now }} with [timestamp]
	cleaned = cleaned.replace(/\{\{\s*\$now\s*\}\}/g, "[timestamp]");
	return cleaned;
}

function serializeConfigValue(value: unknown): unknown {
	if (value === null || value === undefined) return value;

	// N8N resource locator: { __rl: true, value: "..." } -> extract value
	if (typeof value === "object" && !Array.isArray(value)) {
		const obj = value as Record<string, unknown>;
		if (obj.__rl && "value" in obj) {
			return cleanN8NExpression(String(obj.value ?? ""));
		}
		// Recursively serialize nested objects
		const result: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(obj)) {
			result[k] = serializeConfigValue(v);
		}
		return result;
	}

	if (Array.isArray(value)) {
		return value.map(serializeConfigValue);
	}

	if (typeof value === "string") {
		return cleanN8NExpression(value);
	}

	return value;
}

function convertN8NParameters(
	params: Record<string, unknown>,
): Record<string, unknown> {
	const converted: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(params)) {
		// Skip N8N internal parameters
		if (
			key === "authentication" ||
			key === "nodeVersion" ||
			key === "resource"
		) {
			continue;
		}
		converted[key] = serializeConfigValue(value);
	}
	return converted;
}

/**
 * Compute a clean left-to-right layout using topological sort.
 * Separates sticky notes (variable nodes) into a row above the main flow.
 */
function computeLayout(
	nodes: GiselleNodeData[],
	connections: GiselleConnectionData[],
	_rawPositions: Record<string, { x: number; y: number }>,
): Record<string, { x: number; y: number }> {
	const HORIZONTAL_GAP = 450;
	const VERTICAL_GAP = 280;
	const STICKY_Y_OFFSET = -400;

	// Separate sticky notes from main flow nodes
	const stickyNodes: GiselleNodeData[] = [];
	const flowNodes: GiselleNodeData[] = [];
	for (const node of nodes) {
		if (
			node.type === "variable" &&
			(node.content as Record<string, unknown>).type === "text"
		) {
			stickyNodes.push(node);
		} else {
			flowNodes.push(node);
		}
	}

	// Build adjacency for flow nodes
	const flowNodeIds = new Set(flowNodes.map((n) => n.id));
	const adj: Record<string, string[]> = {};
	const inDegree: Record<string, number> = {};
	for (const n of flowNodes) {
		adj[n.id] = [];
		inDegree[n.id] = 0;
	}
	for (const conn of connections) {
		const src = conn.outputNode.id;
		const dst = conn.inputNode.id;
		if (flowNodeIds.has(src) && flowNodeIds.has(dst)) {
			adj[src].push(dst);
			inDegree[dst] = (inDegree[dst] ?? 0) + 1;
		}
	}

	// Topological sort with depth assignment (BFS / Kahn's algorithm)
	const depth: Record<string, number> = {};
	const queue: string[] = [];
	for (const n of flowNodes) {
		if ((inDegree[n.id] ?? 0) === 0) {
			queue.push(n.id);
			depth[n.id] = 0;
		}
	}

	let head = 0;
	while (head < queue.length) {
		const nodeId = queue[head++];
		for (const neighbor of adj[nodeId] ?? []) {
			const newDepth = (depth[nodeId] ?? 0) + 1;
			// Take the maximum depth to handle convergent paths
			depth[neighbor] = Math.max(depth[neighbor] ?? 0, newDepth);
			inDegree[neighbor] = (inDegree[neighbor] ?? 1) - 1;
			if (inDegree[neighbor] === 0) {
				queue.push(neighbor);
			}
		}
	}

	// Handle any nodes not reached (cycles / disconnected) -- assign depth 0
	for (const n of flowNodes) {
		if (depth[n.id] === undefined) {
			depth[n.id] = 0;
		}
	}

	// Group nodes by depth (column)
	const columns: Record<number, string[]> = {};
	for (const n of flowNodes) {
		const d = depth[n.id] ?? 0;
		if (!columns[d]) columns[d] = [];
		columns[d].push(n.id);
	}

	// Position each column
	const positions: Record<string, { x: number; y: number }> = {};
	for (const [colStr, nodeIds] of Object.entries(columns)) {
		const col = Number(colStr);
		const x = col * HORIZONTAL_GAP;
		const totalHeight = (nodeIds.length - 1) * VERTICAL_GAP;
		const startY = -totalHeight / 2;
		for (let i = 0; i < nodeIds.length; i++) {
			positions[nodeIds[i]] = { x, y: startY + i * VERTICAL_GAP };
		}
	}

	// Position sticky notes in a row above the main flow
	for (let i = 0; i < stickyNodes.length; i++) {
		positions[stickyNodes[i].id] = {
			x: i * HORIZONTAL_GAP,
			y: STICKY_Y_OFFSET,
		};
	}

	return positions;
}
