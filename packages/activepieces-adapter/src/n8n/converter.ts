/**
 * N8N Workflow Converter: Converts N8N workflow JSON to Giselle workspace format.
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
			nodeIdMapping[n8nNode.name] = {
				nodeId: giselleNode.id,
				nodeType: giselleNode.type,
				contentType: (giselleNode.content as { type: string }).type,
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

		case "delay":
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "integration",
					pieceName: "delay",
					actionName: "delay_for",
					pieceVersion: "latest",
					configuration: extractDelayConfig(n8nNode.parameters),
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
						label: "After delay",
						accessor: "action-result",
					},
				],
			};

		case "conditional": {
			const outputs =
				mapping.subtype === "if"
					? [
							{
								id: OutputId.generate(),
								label: "True",
								accessor: "true-branch",
							},
							{
								id: OutputId.generate(),
								label: "False",
								accessor: "false-branch",
							},
						]
					: [
							{
								id: OutputId.generate(),
								label: "Output 0",
								accessor: "branch-0",
							},
							{
								id: OutputId.generate(),
								label: "Output 1",
								accessor: "branch-1",
							},
							{
								id: OutputId.generate(),
								label: "Output 2",
								accessor: "branch-2",
							},
							{
								id: OutputId.generate(),
								label: "Output 3",
								accessor: "branch-3",
							},
						];
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "integration",
					pieceName: "conditions",
					actionName:
						mapping.subtype === "if" ? "if_condition" : "switch_condition",
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
				outputs,
			};
		}

		case "dataTransform":
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "integration",
					pieceName: "data-mapper",
					actionName: resolveDataTransformAction(
						mapping.subtype,
						n8nNode.parameters,
					),
					pieceVersion: "latest",
					configuration: extractDataTransformConfig(
						mapping.subtype,
						n8nNode.parameters,
					),
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

function extractDelayConfig(
	params: Record<string, unknown>,
): Record<string, unknown> {
	return {
		amount: params.amount ?? params.value ?? 60,
		unit: params.unit ?? "seconds",
	};
}

function resolveDataTransformAction(
	subtype: string,
	_params: Record<string, unknown>,
): string {
	switch (subtype) {
		case "set":
			return "set_values";
		case "code":
			return "run_code";
		case "merge":
			return "merge_data";
		case "splitInBatches":
			return "split_batches";
		default:
			return "transform";
	}
}

function extractDataTransformConfig(
	subtype: string,
	params: Record<string, unknown>,
): Record<string, unknown> {
	switch (subtype) {
		case "set": {
			const assignments = params.assignments as
				| { assignments?: Array<{ name: string; value: unknown }> }
				| undefined;
			if (assignments?.assignments) {
				const pairs: Record<string, string> = {};
				for (const a of assignments.assignments) {
					pairs[a.name] = cleanN8NExpression(String(a.value ?? ""));
				}
				return { assignments: pairs };
			}
			return convertN8NParameters(params);
		}
		case "code": {
			const code =
				(params.jsCode as string) ??
				(params.pythonCode as string) ??
				(params.functionCode as string) ??
				"";
			return { code: cleanN8NExpression(code), language: params.jsCode ? "javascript" : "python" };
		}
		case "merge":
			return { mode: (params.mode as string) ?? "append" };
		default:
			return convertN8NParameters(params);
	}
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

	// Handle any nodes not reached (cycles / disconnected) — assign depth 0
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
