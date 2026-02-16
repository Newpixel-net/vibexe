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
import { mapN8NNodeType, N8N_CREDENTIAL_TO_PIECE } from "./node-mapping";

// N8N Workflow JSON types
export interface N8NWorkflow {
	name?: string;
	nodes: N8NNode[];
	connections: N8NConnections;
	settings?: Record<string, unknown>;
	pinData?: Record<string, unknown>;
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
	issues?: { credentials?: Record<string, unknown> };
	onError?: string;
	retryOnFail?: boolean;
	maxTries?: number;
	waitBetweenTries?: number;
}

// Sticky note data for native StickyNote rendering
export interface GiselleStickyNoteData {
	id: string;
	text: string;
	color: "yellow" | "blue" | "green" | "pink" | "gray";
	position: { x: number; y: number };
	size: { width: number; height: number };
}

// Giselle workspace types (simplified for conversion)
export interface GiselleWorkspaceData {
	name: string;
	nodes: GiselleNodeData[];
	connections: GiselleConnectionData[];
	stickyNotes: GiselleStickyNoteData[];
	warnings: ConversionWarning[];
	hasFlowControl: boolean;
	importMeta?: {
		source: "n8n";
		nodesNeedingCredentials: number;
		expressionsPartiallyTranslated: number;
		cyclesConverted: number;
		disabledNodes: number;
		scheduleConfig?: { cronExpression: string; timezone: string };
	};
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
	disabled?: boolean;
	pinnedData?: unknown;
	errorConfig?: {
		retryOnFail?: boolean;
		maxRetries?: number;
		retryDelay?: number;
		onError?: string;
	};
	credentialHint?: {
		n8nCredentialType: string;
		n8nCredentialName: string;
		suggestedPiece: string | null;
	};
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
	"editFields", "sort", "wait", "aggregate", "limit",
	"removeDuplicates", "renameKeys", "splitOut",
	"compareDatasets", "summarize", "respondToWebhook",
]);

/** N8N uses ~40px icon nodes; Giselle uses 96px card nodes with labels.
 *  Scale all N8N coordinates by this factor to maintain comfortable spacing. */
const N8N_POSITION_SCALE = 1.75;

/**
 * Convert an N8N workflow JSON to Giselle workspace data.
 */
export function convertN8NToGiselle(
	n8nWorkflow: N8NWorkflow,
): GiselleWorkspaceData {
	const warnings: ConversionWarning[] = [];
	const giselleNodes: GiselleNodeData[] = [];
	const stickyNotes: GiselleStickyNoteData[] = [];
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
	let nodesNeedingCredentials = 0;
	let expressionsPartiallyTranslated = 0;
	let disabledNodes = 0;
	let scheduleConfig: { cronExpression: string; timezone: string } | undefined;

	// Build a name-to-name map for expression translation
	const nodeNameMap = new Map<string, string>();
	for (const n8nNode of n8nWorkflow.nodes) {
		nodeNameMap.set(n8nNode.name, n8nNode.name);
	}

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

		// Unsupported/community nodes → disabled placeholder nodes (preserves connections)
		if (mapping.type === "unsupported") {
			warnings.push({
				nodeType: mapping.originalType,
				nodeName: n8nNode.name,
				message: mapping.reason,
			});
			const nodeId = NodeId.generate();
			const inputId = InputId.generate();
			const outputId = OutputId.generate();
			const placeholderNode: GiselleNodeData = {
				id: nodeId,
				type: "operation",
				name: `${n8nNode.name} (unsupported)`,
				disabled: true,
				content: {
					type: "editFields",
					fields: [],
				},
				inputs: [{ id: inputId, label: "Input", accessor: "input" }],
				outputs: [{ id: outputId, label: "Output", accessor: "output" }],
			};
			giselleNodes.push(placeholderNode);
			disabledNodes++;
			nodeIdMapping[n8nNode.name] = {
				nodeId,
				nodeType: "operation",
				contentType: "editFields",
				outputIds: [outputId],
				inputIds: [inputId],
			};
			if (n8nNode.position) {
				nodePositions[nodeId] = {
					x: n8nNode.position[0],
					y: n8nNode.position[1],
				};
			}
			continue;
		}

		// Sticky notes → native StickyNote objects (not variable nodes)
		if (mapping.type === "text") {
			const stickyNote = createStickyNote(n8nNode);
			stickyNotes.push(stickyNote);
			continue;
		}

		const giselleNode = createGiselleNode(n8nNode, mapping, nodeNameMap, warnings);
		if (giselleNode) {
			// Transfer disabled metadata
			if (n8nNode.disabled) {
				giselleNode.disabled = true;
				disabledNodes++;
			}

			// Transfer pinned data from workflow-level pinData
			if (n8nWorkflow.pinData?.[n8nNode.name] !== undefined) {
				giselleNode.pinnedData = n8nWorkflow.pinData[n8nNode.name];
			}

			// Extract credential hints (Phase 2)
			// Check n8nNode.credentials first, then fallback to issues.credentials and parameters.nodeCredentialType
			if (n8nNode.credentials) {
				const credHint = extractCredentialHint(n8nNode.credentials, n8nNode.name, warnings);
				if (credHint) {
					giselleNode.credentialHint = credHint;
					nodesNeedingCredentials++;
				}
			}
			if (!giselleNode.credentialHint) {
				const fallbackHint = extractCredentialHintFromIssues(n8nNode);
				if (fallbackHint) {
					giselleNode.credentialHint = fallbackHint;
					nodesNeedingCredentials++;
				}
			}

			// Extract error handling config (Phase 2)
			const errorConfig = extractErrorConfig(n8nNode);
			if (errorConfig) {
				giselleNode.errorConfig = errorConfig;
			}

			// Extract schedule config from schedule trigger (Phase 4)
			if (mapping.type === "nativeTrigger" && mapping.provider === "schedule") {
				scheduleConfig = extractScheduleConfig(n8nNode.parameters);
			}

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
	const rawConnections = convertConnections(
		n8nWorkflow.connections,
		nodeIdMapping,
		() => ConnectionId.generate(),
	);

	// Phase 2b: Convert cycles to Loop+If patterns or strip back-edges
	const { connections, cyclesConverted } = transformCyclesToLoops(
		rawConnections,
		giselleNodes,
		nodeIdMapping,
		warnings,
	);

	// Phase 3: Compute clean layout
	const layoutPositions = computeLayout(
		giselleNodes,
		connections,
		nodePositions,
	);

	// Normalize all positions (nodes + sticky notes) to start near origin
	const allCoords = [
		...Object.values(layoutPositions),
		...stickyNotes.map((n) => n.position),
	];
	if (allCoords.length > 0) {
		const minX = Math.min(...allCoords.map((p) => p.x));
		const minY = Math.min(...allCoords.map((p) => p.y));
		for (const id of Object.keys(layoutPositions)) {
			layoutPositions[id] = {
				x: layoutPositions[id].x - minX,
				y: layoutPositions[id].y - minY,
			};
		}
		for (const note of stickyNotes) {
			note.position.x -= minX;
			note.position.y -= minY;
		}
	}

	return {
		name: n8nWorkflow.name ?? "Imported N8N Workflow",
		nodes: giselleNodes,
		connections,
		stickyNotes,
		warnings,
		hasFlowControl,
		importMeta: {
			source: "n8n",
			nodesNeedingCredentials,
			expressionsPartiallyTranslated,
			cyclesConverted,
			disabledNodes,
			scheduleConfig,
		},
		uiState: {
			nodePositions: layoutPositions,
		},
	};
}

function createGiselleNode(
	n8nNode: N8NNode,
	mapping: Exclude<ReturnType<typeof mapN8NNodeType>, { type: "skip" } | { type: "unsupported" }>,
	nodeNameMap: Map<string, string>,
	warnings: ConversionWarning[],
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

		case "integration": {
			let config = convertN8NParameters(n8nNode.parameters);
			// Map N8N HTTP params to Activepieces HTTP piece property names
			if (mapping.pieceName === "http") {
				config = mapHttpParamsToActivepiecesSchema(config);
			}
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
					configuration: config,
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
		}

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
			const numInputs = typeof n8nNode.parameters.numberInputs === "number"
				? n8nNode.parameters.numberInputs
				: 2;
			const mergeInputs = Array.from({ length: numInputs }, (_, i) => ({
				id: InputId.generate(),
				label: `Input ${i + 1}`,
				accessor: `input${i + 1}`,
			}));
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "merge",
					mode: mergeMode,
				},
				inputs: mergeInputs,
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

		// --- Additional Data Transform Nodes (Phase 1) ---

		case "nativeAggregate": {
			const aggOps = extractAggregateOperations(n8nNode.parameters);
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "aggregate",
					operations: aggOps.operations,
					groupBy: aggOps.groupBy,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Output", accessor: "output" },
				],
			};
		}

		case "nativeLimit": {
			const maxItems = Number(n8nNode.parameters.maxItems ?? n8nNode.parameters.limit ?? 10);
			const keep = (n8nNode.parameters.keep as string) === "lastItems" ? "last" : "first";
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "limit",
					maxItems: Math.max(maxItems, 0),
					keep,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Output", accessor: "output" },
				],
			};
		}

		case "nativeRemoveDuplicates": {
			const fields = extractStringArray(n8nNode.parameters, "fieldToCompare", "compareValue");
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "removeDuplicates",
					fields,
					keepFirst: true,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Output", accessor: "output" },
				],
			};
		}

		case "nativeRenameKeys": {
			const mappings = extractRenameKeyMappings(n8nNode.parameters);
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "renameKeys",
					mappings,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Output", accessor: "output" },
				],
			};
		}

		case "nativeSplitOut": {
			const fieldToSplit = String(n8nNode.parameters.fieldToSplitOut ?? n8nNode.parameters.fieldName ?? "");
			const includeOtherFields = n8nNode.parameters.include !== "noOtherFields";
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "splitOut",
					fieldToSplit,
					includeOtherFields,
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Output", accessor: "output" },
				],
			};
		}

		case "nativeCompareDatasets": {
			const mergeByFields = extractStringArray(n8nNode.parameters, "mergeByField1", "mergeByField2");
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "compareDatasets",
					mergeByFields: mergeByFields.length > 0 ? mergeByFields : [],
					mode: "allMatches",
				},
				inputs: [
					{ id: InputId.generate(), label: "Input 1", accessor: "input1" },
					{ id: InputId.generate(), label: "Input 2", accessor: "input2" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "In Both", accessor: "inBoth" },
					{ id: OutputId.generate(), label: "Only in First", accessor: "onlyInFirst" },
					{ id: OutputId.generate(), label: "Only in Second", accessor: "onlyInSecond" },
				],
			};
		}

		case "nativeSummarize": {
			const sumFields = extractStringArray(n8nNode.parameters, "fieldsToSummarize", "fields");
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "summarize",
					fields: sumFields,
					operations: ["count", "sum", "avg", "min", "max"],
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Output", accessor: "output" },
				],
			};
		}

		// --- Respond to Webhook (Phase 4) ---

		case "nativeRespondToWebhook": {
			const statusCode = Number(n8nNode.parameters.responseCode ?? 200);
			const contentType = (n8nNode.parameters.contentType as string) ?? "application/json";
			const headers: Record<string, string> = {};
			if (n8nNode.parameters.responseHeaders && typeof n8nNode.parameters.responseHeaders === "object") {
				const hObj = n8nNode.parameters.responseHeaders as Record<string, unknown>;
				const entries = hObj.entries ?? hObj.parameters;
				if (Array.isArray(entries)) {
					for (const entry of entries) {
						const e = entry as Record<string, unknown>;
						if (e.name && e.value) {
							headers[String(e.name)] = String(e.value);
						}
					}
				}
			}
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name || "Respond to Webhook",
				content: {
					type: "respondToWebhook",
					statusCode,
					headers,
					responseBody: "",
					contentType: contentType === "text/html" ? "text/html"
						: contentType === "text/plain" ? "text/plain"
						: "application/json",
				},
				inputs: [
					{ id: InputId.generate(), label: "Input", accessor: "input" },
				],
				outputs: [],
			};
		}

		case "text":
			// Sticky notes are now handled before createGiselleNode is called.
			// This case should not be reached but is kept for safety.
			return null;

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
): { code: string; language: "javascript" } {
	const jsCode = params.jsCode as string | undefined;
	const functionCode = params.functionCode as string | undefined;
	const pythonCode = params.pythonCode as string | undefined;

	// Schema only supports "javascript" — convert Python code as a JS comment
	if (pythonCode && !jsCode && !functionCode) {
		return {
			code: `// Converted from Python:\n// ${pythonCode.split("\n").join("\n// ")}\nreturn items;`,
			language: "javascript",
		};
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
): Array<{ operation: "set" | "remove" | "rename"; fieldName: string; value?: string; newFieldName?: string }> {
	const operations: Array<{ operation: "set" | "remove" | "rename"; fieldName: string; value?: string; newFieldName?: string }> = [];

	// V2 format: params.assignments.assignments = [{ name, value, type }]
	const assignments = params.assignments as
		| { assignments?: Array<{ name: string; value: unknown; type?: string }> }
		| undefined;
	if (assignments?.assignments) {
		for (const a of assignments.assignments) {
			operations.push({
				operation: "set",
				fieldName: a.name,
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
						operation: "set",
						fieldName: String(item.name ?? ""),
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

/**
 * Map N8N sticky note color (number 1-7) to Giselle color name.
 */
function mapStickyNoteColor(
	colorIndex: unknown,
): GiselleStickyNoteData["color"] {
	const index = typeof colorIndex === "number" ? colorIndex : Number(colorIndex);
	switch (index) {
		case 1: return "yellow";   // N8N yellow → yellow
		case 2: return "yellow";   // N8N orange → yellow (no orange available)
		case 3: return "pink";     // N8N red → pink (closest)
		case 4: return "green";    // N8N green → green
		case 5: return "blue";     // N8N blue → blue
		case 6: return "pink";     // N8N purple → pink (closest)
		case 7: return "gray";     // N8N gray → gray
		default: return "yellow";
	}
}

/**
 * Pre-process N8N markdown content into standard markdown.
 * N8N's markdown renderer has custom handling that standard markdown (Streamdown)
 * doesn't support. This transforms N8N-specific patterns during import.
 */
function preprocessN8NMarkdown(text: string): string {
	if (!text) return text;
	let result = text;

	// Transform 1: YouTube embeds → clickable links (fixes D5)
	result = result.replace(
		/@\[youtube\]\(([^)]+)\)/g,
		"[Watch on YouTube](https://youtube.com/watch?v=$1)",
	);

	// Transform 2: Sub-bullets with • → standard markdown sub-list items (fixes D2)
	result = result.replace(/\n\s*•\s*/g, "\n  - ");

	// Transform 3: Checklists with ✓ → list items (fixes D4)
	result = result.replace(/\n\s*✓\s*/g, "\n- ✓ ");

	// Transform 4: Flow arrows ↓ → ensure separate paragraphs (fixes D3)
	result = result.replace(/\n↓\n/g, "\n\n↓\n\n");

	// Transform 5: Number-emoji flow steps → paragraph breaks (fixes D3)
	result = result.replace(/\n([1-9]️⃣|🔟)/g, "\n\n$1");

	// Transform 6: Emoji callout lines → separate paragraphs (fixes D6)
	result = result.replace(/\n(📋|💡|✅|⏱️|🎯)/g, "\n\n$1");

	return result;
}

/**
 * Create a native StickyNote from an N8N sticky note node.
 * Uses N8N's raw position, size, content, and color.
 */
function createStickyNote(n8nNode: N8NNode): GiselleStickyNoteData {
	const rawText = (n8nNode.parameters.content as string) ?? "";
	const text = preprocessN8NMarkdown(rawText);
	const color = mapStickyNoteColor(n8nNode.parameters.color);
	const width = typeof n8nNode.parameters.width === "number"
		? n8nNode.parameters.width
		: 200;
	const height = typeof n8nNode.parameters.height === "number"
		? n8nNode.parameters.height
		: 150;

	return {
		id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		text,
		color,
		position: {
			x: n8nNode.position[0] * N8N_POSITION_SCALE,
			y: n8nNode.position[1] * N8N_POSITION_SCALE,
		},
		size: {
			width: Math.round(width * N8N_POSITION_SCALE),
			height: Math.round(height * N8N_POSITION_SCALE),
		},
	};
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

// ─── Expression System (Phase 3) ─────────────────────────────────────────────

/**
 * Convert N8N expressions to Giselle format.
 * Supports 15+ patterns with ordered regex pipeline (most specific first).
 * Returns { value, hadPartialTranslation } to track partial translations.
 */
function convertN8NExpressionToGiselle(
	value: string,
	nodeNameMap: Map<string, string>,
	warnings: ConversionWarning[],
): { value: string; partial: boolean } {
	if (!value) return { value, partial: false };
	let partial = false;

	// Strip leading = prefix (N8N expression marker)
	let cleaned = value.startsWith("=") ? value.slice(1) : value;

	// 1. {{ $('NodeName').first().json.field }} -> [NodeName.field]
	cleaned = cleaned.replace(
		/\{\{\s*\$\(['"]([^'"]+)['"]\)\.first\(\)\.json\.([^\s}]+)\s*\}\}/g,
		"[$1.$2]",
	);

	// 2. {{ $('NodeName').all() }} -> [NodeName.*]
	cleaned = cleaned.replace(
		/\{\{\s*\$\(['"]([^'"]+)['"]\)\.all\(\)\s*\}\}/g,
		"[$1.*]",
	);

	// 3. {{ $('NodeName').item.json.field }} -> [NodeName.field]
	cleaned = cleaned.replace(
		/\{\{\s*\$\(['"]([^'"]+)['"]\)\.item\.json\.([^\s}]+)\s*\}\}/g,
		"[$1.$2]",
	);

	// 4. {{ $('NodeName').item.json }} -> [NodeName]
	cleaned = cleaned.replace(
		/\{\{\s*\$\(['"]([^'"]+)['"]\)\.item\.json\s*\}\}/g,
		"[$1]",
	);

	// 5. {{ $('NodeName').first().json }} -> [NodeName]
	cleaned = cleaned.replace(
		/\{\{\s*\$\(['"]([^'"]+)['"]\)\.first\(\)\.json\s*\}\}/g,
		"[$1]",
	);

	// 6. {{ $input.first().json.field }} -> [input.field]
	cleaned = cleaned.replace(
		/\{\{\s*\$input\.first\(\)\.json\.([^\s}]+)\s*\}\}/g,
		"[input.$1]",
	);

	// 7. {{ $input.all() }} -> [input.*]
	cleaned = cleaned.replace(
		/\{\{\s*\$input\.all\(\)\s*\}\}/g,
		"[input.*]",
	);

	// 8. {{ $input.item.json.field }} -> [input.field]
	cleaned = cleaned.replace(
		/\{\{\s*\$input\.item\.json\.([^\s}]+)\s*\}\}/g,
		"[input.$1]",
	);

	// 9. {{ $node["NodeName"].json.field }} -> [NodeName.field]
	cleaned = cleaned.replace(
		/\{\{\s*\$node\[['"]([^'"]+)['"]\]\.json\.([^\s}]+)\s*\}\}/g,
		"[$1.$2]",
	);

	// 10. {{ $node["NodeName"].json }} -> [NodeName]
	cleaned = cleaned.replace(
		/\{\{\s*\$node\[['"]([^'"]+)['"]\]\.json\s*\}\}/g,
		"[$1]",
	);

	// 11. {{ $json.field }} or {{ $json["field"] }} -> [input.field]
	cleaned = cleaned.replace(
		/\{\{\s*\$json(?:\.|\[['"])([^\s}'"\]]+)(?:['"]\])?\s*\}\}/g,
		"[input.$1]",
	);

	// 12. {{ $json }} -> [input]
	cleaned = cleaned.replace(/\{\{\s*\$json\s*\}\}/g, "[input]");

	// 13. {{ $execution.id }} -> [execution.id]
	cleaned = cleaned.replace(
		/\{\{\s*\$execution\.id\s*\}\}/g,
		"[execution.id]",
	);

	// 14. {{ $runIndex }} / {{ $itemIndex }} -> [index]
	cleaned = cleaned.replace(
		/\{\{\s*\$(?:runIndex|itemIndex)\s*\}\}/g,
		"[index]",
	);

	// 15. {{ $prevNode.name }} -> [prevNode]
	cleaned = cleaned.replace(
		/\{\{\s*\$prevNode\.name\s*\}\}/g,
		"[prevNode]",
	);

	// 16. {{ $now.format(...) }} -> [timestamp]
	cleaned = cleaned.replace(
		/\{\{\s*\$now\.format\([^)]*\)\s*\}\}/g,
		"[timestamp]",
	);

	// 17. {{ $now }} / {{ $today }} -> [timestamp]
	cleaned = cleaned.replace(/\{\{\s*\$(?:now|today)\s*\}\}/g, "[timestamp]");

	// 18. {{ $env.VAR_NAME }} -> warning + strip
	cleaned = cleaned.replace(
		/\{\{\s*\$env\.([^\s}]+)\s*\}\}/g,
		(_match, varName) => {
			partial = true;
			warnings.push({
				nodeType: "expression",
				nodeName: "expression",
				message: `Environment variable $env.${varName} is not supported — replaced with placeholder`,
			});
			return `[env.${varName}]`;
		},
	);

	// 19. {{ $binary... }} -> warning + strip
	cleaned = cleaned.replace(
		/\{\{\s*\$binary[^}]*\}\}/g,
		(_match) => {
			partial = true;
			warnings.push({
				nodeType: "expression",
				nodeName: "expression",
				message: "Binary data expressions are not supported",
			});
			return "[binary]";
		},
	);

	// 20. Remaining {{ ... }} with JS functions — extract field ref, strip function call
	cleaned = cleaned.replace(
		/\{\{\s*(.*?)\s*\}\}/g,
		(_match, inner: string) => {
			// Try to extract a useful field reference from expressions like Math.round($json.value)
			const fieldMatch = inner.match(/\$(?:json|input)\.([a-zA-Z_]\w*)/);
			if (fieldMatch) {
				partial = true;
				return `[input.${fieldMatch[1]}]`;
			}
			const nodeFieldMatch = inner.match(/\$\(['"]([^'"]+)['"]\).*?\.json\.([a-zA-Z_]\w*)/);
			if (nodeFieldMatch) {
				partial = true;
				return `[${nodeFieldMatch[1]}.${nodeFieldMatch[2]}]`;
			}
			// Can't parse — leave as literal
			partial = true;
			return inner;
		},
	);

	return { value: cleaned, partial };
}

/** Backward-compatible wrapper that calls the new expression system */
function cleanN8NExpression(value: string): string {
	if (!value) return value;
	const result = convertN8NExpressionToGiselle(value, new Map(), []);
	return result.value;
}

// ─── Credential Extraction (Phase 2) ────────────────────────────────────────

function extractCredentialHint(
	credentials: Record<string, unknown>,
	nodeName: string,
	warnings: ConversionWarning[],
): GiselleNodeData["credentialHint"] | null {
	for (const [credType, credRef] of Object.entries(credentials)) {
		const credName = typeof credRef === "object" && credRef !== null
			? String((credRef as Record<string, unknown>).name ?? credType)
			: credType;
		const suggestedPiece = N8N_CREDENTIAL_TO_PIECE[credType] ?? null;

		warnings.push({
			nodeType: "credential",
			nodeName,
			message: `Credential '${credName}' (${credType}) must be reconfigured in Giselle${suggestedPiece ? ` — suggested piece: ${suggestedPiece}` : ""}`,
		});

		return {
			n8nCredentialType: credType,
			n8nCredentialName: credName,
			suggestedPiece,
		};
	}
	return null;
}

/**
 * Fallback credential hint extraction from issues.credentials or parameters.nodeCredentialType.
 * N8N templates often have credentials: {} (empty) but still contain credential type info
 * in issues.credentials (e.g. {"openAiApi": ["Credentials for OpenAI are not set."]})
 * or in parameters.nodeCredentialType (for HTTP Request nodes with predefined credentials).
 */
function extractCredentialHintFromIssues(
	n8nNode: N8NNode,
): GiselleNodeData["credentialHint"] | null {
	// Check issues.credentials
	if (n8nNode.issues?.credentials) {
		for (const credType of Object.keys(n8nNode.issues.credentials)) {
			const suggestedPiece = N8N_CREDENTIAL_TO_PIECE[credType] ?? null;
			return {
				n8nCredentialType: credType,
				n8nCredentialName: credType,
				suggestedPiece,
			};
		}
	}
	// Check parameters.nodeCredentialType (HTTP Request with predefined credentials)
	const nodeCredType = n8nNode.parameters?.nodeCredentialType as string | undefined;
	if (nodeCredType) {
		const suggestedPiece = N8N_CREDENTIAL_TO_PIECE[nodeCredType] ?? null;
		return {
			n8nCredentialType: nodeCredType,
			n8nCredentialName: nodeCredType,
			suggestedPiece,
		};
	}
	return null;
}

// ─── Error Config Extraction (Phase 2) ──────────────────────────────────────

function extractErrorConfig(
	n8nNode: N8NNode,
): GiselleNodeData["errorConfig"] | null {
	const params = n8nNode.parameters;
	const onError = (params.onError as string) ?? n8nNode.onError ?? "stopWorkflow";
	const retryOnFail = (params.retryOnFail as boolean) ?? n8nNode.retryOnFail ?? false;
	const maxTries = Number(params.maxTries ?? n8nNode.maxTries ?? 3);
	const waitBetweenTries = Number(params.waitBetweenTries ?? n8nNode.waitBetweenTries ?? 1000);

	// Only create errorConfig if non-default settings exist
	if (onError === "stopWorkflow" && !retryOnFail) {
		return null;
	}

	let mappedOnError: string;
	switch (onError) {
		case "continueOnFail":
			mappedOnError = "continueOnFail";
			break;
		case "continueErrorOutput":
			mappedOnError = "routeToError";
			break;
		default:
			mappedOnError = "stopWorkflow";
	}

	return {
		onError: mappedOnError,
		retryOnFail,
		maxRetries: retryOnFail ? maxTries : undefined,
		retryDelay: retryOnFail ? waitBetweenTries : undefined,
	};
}

// ─── Schedule Config Extraction (Phase 4) ───────────────────────────────────

function extractScheduleConfig(
	params: Record<string, unknown>,
): { cronExpression: string; timezone: string } {
	// Check for explicit cron expression
	if (params.cronExpression && typeof params.cronExpression === "string") {
		return {
			cronExpression: params.cronExpression,
			timezone: (params.timezone as string) ?? "UTC",
		};
	}

	// N8N interval format: { rule: { interval: [{ field, ...interval }] } }
	const rule = params.rule as Record<string, unknown> | undefined;
	const intervals = rule?.interval;
	if (Array.isArray(intervals) && intervals.length > 0) {
		const interval = intervals[0] as Record<string, unknown>;
		const field = (interval.field as string) ?? "hours";

		switch (field) {
			case "seconds": {
				const sec = Number(interval.secondsInterval ?? 30);
				return { cronExpression: `*/${sec} * * * * *`, timezone: "UTC" };
			}
			case "minutes": {
				const min = Number(interval.minutesInterval ?? 5);
				return { cronExpression: `*/${min} * * * *`, timezone: "UTC" };
			}
			case "hours": {
				const hrs = Number(interval.hoursInterval ?? 1);
				return { cronExpression: `0 */${hrs} * * *`, timezone: "UTC" };
			}
			case "days": {
				const hour = Number(interval.triggerAtHour ?? 0);
				const minute = Number(interval.triggerAtMinute ?? 0);
				const daysInterval = Number(interval.daysInterval ?? 1);
				if (daysInterval === 1) {
					return { cronExpression: `${minute} ${hour} * * *`, timezone: "UTC" };
				}
				return { cronExpression: `${minute} ${hour} */${daysInterval} * *`, timezone: "UTC" };
			}
			case "weeks": {
				const hour = Number(interval.triggerAtHour ?? 0);
				const minute = Number(interval.triggerAtMinute ?? 0);
				const day = Number(interval.triggerAtDay ?? 1);
				return { cronExpression: `${minute} ${hour} * * ${day}`, timezone: "UTC" };
			}
			default:
				break;
		}
	}

	return { cronExpression: "0 * * * *", timezone: "UTC" };
}

// ─── New Node Type Helpers (Phase 1) ────────────────────────────────────────

function extractAggregateOperations(
	params: Record<string, unknown>,
): { operations: Array<{ field: string; operation: string; resultField: string }>; groupBy: string[] } {
	const operations: Array<{ field: string; operation: string; resultField: string }> = [];
	const groupBy: string[] = [];

	// N8N aggregate format: { fieldsToAggregate: { values: [{ field, operation }] }, groupBy: "field1,field2" }
	const fieldsToAgg = params.fieldsToAggregate as Record<string, unknown> | undefined;
	if (fieldsToAgg?.values && Array.isArray(fieldsToAgg.values)) {
		for (const v of fieldsToAgg.values) {
			const item = v as Record<string, unknown>;
			const field = String(item.field ?? item.fieldToAggregate ?? "");
			const operation = String(item.aggregation ?? item.operation ?? "sum").toLowerCase();
			operations.push({
				field,
				operation: ["sum", "avg", "min", "max", "count", "countDistinct", "concatenate"].includes(operation) ? operation : "sum",
				resultField: `${operation}_${field}`,
			});
		}
	}

	if (params.groupBy && typeof params.groupBy === "string") {
		groupBy.push(...params.groupBy.split(",").map((s: string) => s.trim()).filter(Boolean));
	}

	return { operations, groupBy };
}

function extractStringArray(
	params: Record<string, unknown>,
	...keys: string[]
): string[] {
	const result: string[] = [];
	for (const key of keys) {
		const val = params[key];
		if (typeof val === "string" && val) {
			result.push(val);
		} else if (Array.isArray(val)) {
			for (const item of val) {
				if (typeof item === "string") result.push(item);
				else if (typeof item === "object" && item !== null) {
					const obj = item as Record<string, unknown>;
					const v = obj.fieldName ?? obj.field ?? obj.value;
					if (typeof v === "string") result.push(v);
				}
			}
		}
	}
	// Also check options
	const options = params.options as Record<string, unknown> | undefined;
	if (options) {
		for (const key of keys) {
			const val = options[key];
			if (typeof val === "string" && val) result.push(val);
		}
	}
	return result;
}

function extractRenameKeyMappings(
	params: Record<string, unknown>,
): Array<{ from: string; to: string }> {
	const mappings: Array<{ from: string; to: string }> = [];

	// N8N format: { keys: { key: [{ currentKey, newKey }] } }
	const keys = params.keys as Record<string, unknown> | undefined;
	if (keys?.key && Array.isArray(keys.key)) {
		for (const k of keys.key) {
			const item = k as Record<string, unknown>;
			mappings.push({
				from: String(item.currentKey ?? ""),
				to: String(item.newKey ?? ""),
			});
		}
	}

	return mappings;
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

/**
 * Map N8N HTTP node parameters to Activepieces HTTP piece property names.
 * N8N uses sendHeaders/headerParameters/sendBody/specifyBody/jsonBody etc.
 * Activepieces HTTP piece uses url/method/headers/body/body_type etc.
 */
function mapHttpParamsToActivepiecesSchema(
	config: Record<string, unknown>,
): Record<string, unknown> {
	const mapped: Record<string, unknown> = {};

	// Direct mappings
	if (config.url) mapped.url = config.url;
	if (config.method) mapped.method = config.method;

	// Headers: N8N uses sendHeaders + headerParameters.parameters[]
	// Activepieces HTTP piece uses headers as object
	if (config.sendHeaders && config.headerParameters) {
		const params = config.headerParameters as Record<string, unknown>;
		const entries = (params?.parameters ?? params?.entries ?? params) as unknown;
		if (Array.isArray(entries)) {
			const headers: Record<string, string> = {};
			for (const entry of entries) {
				const e = entry as Record<string, unknown>;
				if (e.name && e.value) headers[String(e.name)] = String(e.value);
			}
			mapped.headers = headers;
		}
	}

	// Body: N8N uses sendBody + specifyBody + jsonBody/body
	// Activepieces HTTP piece uses body_type + body
	if (config.sendBody) {
		mapped.body_type = config.specifyBody === "json" ? "json" : "form-data";
		mapped.body = config.jsonBody ?? config.body ?? "";
	}

	// Query params: N8N uses queryParameters
	if (config.queryParameters) {
		mapped.queryParams = config.queryParameters;
	}

	// Copy remaining params that aren't N8N-specific
	const n8nSpecific = new Set([
		"sendHeaders", "headerParameters", "sendBody", "specifyBody",
		"jsonBody", "authentication", "nodeCredentialType", "options",
		"queryParameters",
	]);
	for (const [key, value] of Object.entries(config)) {
		if (!n8nSpecific.has(key) && !(key in mapped)) {
			mapped[key] = value;
		}
	}

	return mapped;
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
 * Transform N8N polling cycles into Giselle Loop+If patterns, or remove back-edges
 * with a warning for complex cycles that can't be automatically converted.
 *
 * Phase 6: Pragmatic cycle support — instead of rewriting the DAG executor for
 * arbitrary cycles, we convert common N8N polling loop patterns to equivalent
 * Giselle Loop nodes during import.
 *
 * Algorithm:
 * 1. Detect cycles via DFS
 * 2. For each back-edge (A -> B where B is ancestor):
 *    a. Trace cycle body: all nodes on path from B to A
 *    b. Find condition node (If/Switch) in cycle
 *    c. Classify: POLLING_LOOP, RETRY_LOOP, or UNKNOWN
 * 3. For known patterns: synthesize Loop node, rewire connections
 * 4. For unknown: strip back-edge with warning (graceful degradation)
 */
function transformCyclesToLoops(
	connections: GiselleConnectionData[],
	nodes: GiselleNodeData[],
	nodeIdMapping: Record<string, { nodeId: string; nodeType: string; contentType: string; outputIds: string[]; inputIds: string[] }>,
	warnings: ConversionWarning[],
): { connections: GiselleConnectionData[]; cyclesConverted: number } {
	// Build adjacency list
	const adj = new Map<string, Array<{ targetId: string; connIndex: number }>>();
	for (let i = 0; i < connections.length; i++) {
		const conn = connections[i];
		const srcId = conn.outputNode.id;
		const dstId = conn.inputNode.id;
		if (!adj.has(srcId)) adj.set(srcId, []);
		adj.get(srcId)!.push({ targetId: dstId, connIndex: i });
	}

	// DFS to detect back-edges
	const WHITE = 0;
	const GRAY = 1;
	const BLACK = 2;
	const color = new Map<string, number>();
	const backEdges: Array<{ fromId: string; toId: string; connIndex: number }> = [];
	const parent = new Map<string, string | null>();

	const allNodeIds = new Set<string>();
	for (const conn of connections) {
		allNodeIds.add(conn.outputNode.id);
		allNodeIds.add(conn.inputNode.id);
	}
	for (const nodeId of allNodeIds) {
		color.set(nodeId, WHITE);
	}

	function dfs(nodeId: string) {
		color.set(nodeId, GRAY);
		for (const edge of adj.get(nodeId) ?? []) {
			const targetColor = color.get(edge.targetId) ?? WHITE;
			if (targetColor === GRAY) {
				backEdges.push({
					fromId: nodeId,
					toId: edge.targetId,
					connIndex: edge.connIndex,
				});
			} else if (targetColor === WHITE) {
				parent.set(edge.targetId, nodeId);
				dfs(edge.targetId);
			}
		}
		color.set(nodeId, BLACK);
	}

	for (const nodeId of allNodeIds) {
		if ((color.get(nodeId) ?? WHITE) === WHITE) {
			parent.set(nodeId, null);
			dfs(nodeId);
		}
	}

	if (backEdges.length === 0) {
		return { connections, cyclesConverted: 0 };
	}

	// Process each back-edge
	const backEdgeIndices = new Set<number>();
	let cyclesConverted = 0;

	for (const backEdge of backEdges) {
		backEdgeIndices.add(backEdge.connIndex);

		// Trace cycle body: find all nodes on path from backEdge.toId -> backEdge.fromId
		const cycleBody = traceCyclePath(backEdge.toId, backEdge.fromId, adj);

		if (cycleBody.length === 0) {
			// Can't trace path — just strip the edge
			warnings.push({
				nodeType: "connection",
				nodeName: `cycle`,
				message: `Cyclic connection removed — could not trace cycle path for Loop conversion`,
			});
			continue;
		}

		// Check if cycle contains an If/Switch node (condition for breaking)
		const hasConditionNode = cycleBody.some((nodeId) => {
			const node = nodes.find((n) => n.id === nodeId);
			if (!node) return false;
			const ct = (node.content as { type: string }).type;
			return ct === "if" || ct === "switch";
		});

		if (hasConditionNode && cycleBody.length >= 2 && cycleBody.length <= 10) {
			// POLLING_LOOP or RETRY_LOOP — synthesize a Loop node
			const loopNode: GiselleNodeData = {
				id: NodeId.generate(),
				type: "operation",
				name: `Loop (converted)`,
				content: {
					type: "loop",
					mode: "forEach",
					maxIterations: 100,
				},
				inputs: [
					{ id: InputId.generate(), label: "Items", accessor: "items" },
				],
				outputs: [
					{ id: OutputId.generate(), label: "Done", accessor: "done" },
					{ id: OutputId.generate(), label: "Loop", accessor: "loop" },
				],
			};
			nodes.push(loopNode);

			// Rewire: the back-edge source's output goes to the Loop's input instead
			// The Loop's "loop" output connects to the cycle body entry
			// The cycle body's "true/exit" branch connects to Loop's "done" output downstream

			// Find the entry connection to the cycle (what feeds into backEdge.toId from outside the cycle)
			const entryConns = connections.filter(
				(c) => c.inputNode.id === backEdge.toId && !cycleBody.includes(c.outputNode.id),
			);

			if (entryConns.length > 0) {
				// Rewire entry connections to feed the Loop node instead
				for (const ec of entryConns) {
					ec.inputNode = {
						id: loopNode.id,
						type: "operation",
						content: { type: "loop" },
					};
					ec.inputId = loopNode.inputs[0].id;
				}

				// Add connection: Loop "loop" output -> cycle body entry
				connections.push({
					id: ConnectionId.generate(),
					outputNode: {
						id: loopNode.id,
						type: "operation",
						content: { type: "loop" },
					},
					outputId: loopNode.outputs[1].id, // "loop" output
					inputNode: connections[backEdge.connIndex].inputNode,
					inputId: connections[backEdge.connIndex].inputId,
				});

				cyclesConverted++;
				warnings.push({
					nodeType: "cycle",
					nodeName: `${cycleBody.length}-node polling loop`,
					message: `Polling loop (${cycleBody.length} nodes) converted to Loop node — verify loop exit condition`,
				});
			} else {
				// No clear entry point — graceful degradation
				warnings.push({
					nodeType: "connection",
					nodeName: "cycle",
					message: `Cyclic connection removed — no clear entry point for Loop conversion (${cycleBody.length} nodes in cycle)`,
				});
			}
		} else {
			// UNKNOWN or too complex — strip back-edge
			warnings.push({
				nodeType: "connection",
				nodeName: "cycle",
				message: hasConditionNode
					? `Complex cycle (${cycleBody.length} nodes) removed — too complex for automatic Loop conversion`
					: `Cyclic connection removed — no If/Switch node found in cycle for Loop conversion`,
			});
		}
	}

	return {
		connections: connections.filter((_, i) => !backEdgeIndices.has(i)),
		cyclesConverted,
	};
}

/** BFS to find all nodes on any path from startId to endId. */
function traceCyclePath(
	startId: string,
	endId: string,
	adj: Map<string, Array<{ targetId: string; connIndex: number }>>,
): string[] {
	const visited = new Set<string>();
	const parentMap = new Map<string, string>();
	const queue: string[] = [startId];
	visited.add(startId);

	while (queue.length > 0) {
		const current = queue.shift()!;
		if (current === endId) {
			// Reconstruct path
			const path: string[] = [];
			let node: string | undefined = endId;
			while (node && node !== startId) {
				path.unshift(node);
				node = parentMap.get(node);
			}
			path.unshift(startId);
			return path;
		}
		for (const edge of adj.get(current) ?? []) {
			if (!visited.has(edge.targetId)) {
				visited.add(edge.targetId);
				parentMap.set(edge.targetId, current);
				queue.push(edge.targetId);
			}
		}
	}

	return []; // No path found
}

/**
 * Compute layout by preserving N8N's original node positions.
 * Falls back to topological sort when no raw positions are available.
 *
 * N8N positions are designed by the user in N8N's visual editor and already
 * represent the ideal layout. Giselle nodes are ~100px wide vs N8N's ~150px,
 * so N8N's 300px gaps translate to comfortable 200px visible gaps.
 */
function computeLayout(
	nodes: GiselleNodeData[],
	connections: GiselleConnectionData[],
	rawPositions: Record<string, { x: number; y: number }>,
): Record<string, { x: number; y: number }> {
	// All nodes are flow nodes now (sticky notes handled separately)
	const flowNodes = nodes;
	const stickyNodes: GiselleNodeData[] = [];

	// Check how many flow nodes have raw positions
	const flowNodesWithPositions = flowNodes.filter((n) => rawPositions[n.id]);

	if (flowNodesWithPositions.length >= flowNodes.length * 0.5) {
		// Use N8N positions (majority have positions)
		return computeLayoutFromRawPositions(
			flowNodes,
			stickyNodes,
			connections,
			rawPositions,
		);
	}

	// Fallback: topological sort layout
	return computeLayoutTopological(flowNodes, stickyNodes, connections);
}

/**
 * Position-preserving layout: uses N8N's original coordinates directly.
 * Synthesized nodes (e.g. from cycle→loop conversion) are placed relative
 * to their connected neighbors.
 */
function computeLayoutFromRawPositions(
	flowNodes: GiselleNodeData[],
	stickyNodes: GiselleNodeData[],
	connections: GiselleConnectionData[],
	rawPositions: Record<string, { x: number; y: number }>,
): Record<string, { x: number; y: number }> {
	const positions: Record<string, { x: number; y: number }> = {};

	// Place flow nodes that have raw positions (scaled)
	for (const node of flowNodes) {
		const raw = rawPositions[node.id];
		if (raw) {
			positions[node.id] = { x: raw.x * N8N_POSITION_SCALE, y: raw.y * N8N_POSITION_SCALE };
		}
	}

	// Place synthesized nodes (no raw position) relative to neighbors
	const synthesized = flowNodes.filter((n) => !rawPositions[n.id]);
	if (synthesized.length > 0) {
		// Build neighbor lookup
		const neighbors = new Map<string, string[]>();
		for (const node of flowNodes) {
			neighbors.set(node.id, []);
		}
		for (const conn of connections) {
			const src = conn.outputNode.id;
			const dst = conn.inputNode.id;
			neighbors.get(src)?.push(dst);
			neighbors.get(dst)?.push(src);
		}

		for (const node of synthesized) {
			const nbrs = (neighbors.get(node.id) ?? [])
				.filter((id) => positions[id])
				.map((id) => positions[id]);

			if (nbrs.length > 0) {
				// Place before neighbors (to the left), at average Y
				const minX = Math.min(...nbrs.map((p) => p.x));
				const avgY =
					nbrs.reduce((sum, p) => sum + p.y, 0) / nbrs.length;
				positions[node.id] = { x: minX - 250, y: avgY };
			} else {
				// No positioned neighbors — place at origin
				positions[node.id] = { x: 0, y: 0 };
			}
		}
	}

	// Place sticky notes using their raw N8N position (scaled)
	for (const node of stickyNodes) {
		const raw = rawPositions[node.id];
		if (raw) {
			positions[node.id] = { x: raw.x * N8N_POSITION_SCALE, y: raw.y * N8N_POSITION_SCALE };
		} else {
			// Fallback: place above the flow
			const flowYValues = Object.values(positions).map((p) => p.y);
			const minFlowY =
				flowYValues.length > 0 ? Math.min(...flowYValues) : 0;
			positions[node.id] = { x: 0, y: minFlowY - 200 };
		}
	}

	return positions;
}

/**
 * Fallback topological sort layout for workflows without N8N positions.
 * Uses Kahn's algorithm for layer assignment with fork-aware vertical spreading.
 */
function computeLayoutTopological(
	flowNodes: GiselleNodeData[],
	stickyNodes: GiselleNodeData[],
	connections: GiselleConnectionData[],
): Record<string, { x: number; y: number }> {
	const HORIZONTAL_GAP = 250;
	const VERTICAL_GAP = 180;

	// Build adjacency for flow nodes
	const flowNodeIds = new Set(flowNodes.map((n) => n.id));
	const adj: Record<string, string[]> = {};
	const inDegree: Record<string, number> = {};
	// Track which output port a connection comes from (for fork spreading)
	const parentOutput = new Map<string, string>(); // childId -> outputId

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
			parentOutput.set(dst, `${src}:${conn.outputId}`);
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
			depth[neighbor] = Math.max(depth[neighbor] ?? 0, newDepth);
			inDegree[neighbor] = (inDegree[neighbor] ?? 1) - 1;
			if (inDegree[neighbor] === 0) {
				queue.push(neighbor);
			}
		}
	}

	// Handle unreached nodes
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

	// Position each column with fork-aware vertical spreading
	const positions: Record<string, { x: number; y: number }> = {};
	for (const [colStr, nodeIds] of Object.entries(columns)) {
		const col = Number(colStr);
		const x = col * HORIZONTAL_GAP;

		// Group nodes by their parent output port for fork spreading
		const groups = new Map<string, string[]>();
		for (const nodeId of nodeIds) {
			const key = parentOutput.get(nodeId) ?? "root";
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(nodeId);
		}

		// Spread groups vertically, centering around y=0
		const groupKeys = Array.from(groups.keys());
		const totalHeight = (nodeIds.length - 1) * VERTICAL_GAP;
		let currentY = -totalHeight / 2;

		for (const key of groupKeys) {
			const group = groups.get(key)!;
			for (const nodeId of group) {
				positions[nodeId] = { x, y: currentY };
				currentY += VERTICAL_GAP;
			}
		}
	}

	// Position sticky notes above the flow
	const flowYValues = Object.values(positions).map((p) => p.y);
	const minFlowY = flowYValues.length > 0 ? Math.min(...flowYValues) : 0;
	for (let i = 0; i < stickyNodes.length; i++) {
		positions[stickyNodes[i].id] = {
			x: i * HORIZONTAL_GAP,
			y: minFlowY - 200,
		};
	}

	return positions;
}
