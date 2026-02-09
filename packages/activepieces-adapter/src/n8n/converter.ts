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

	return {
		name: n8nWorkflow.name ?? "Imported N8N Workflow",
		nodes: giselleNodes,
		connections,
		warnings,
		uiState: {
			nodePositions,
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

		case "textGeneration":
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "textGeneration",
					llm: {
						provider: mapping.provider,
						id: mapping.modelId,
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
				outputs: [
					{
						id: OutputId.generate(),
						label: "Output",
						accessor: "text",
					},
				],
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
	// N8N LLM nodes store prompt in various locations
	const prompt =
		params.prompt ??
		params.text ??
		params.messages ??
		params.content ??
		"";
	let plainText: string;
	if (typeof prompt === "string") {
		plainText = prompt;
	} else if (Array.isArray(prompt)) {
		plainText = prompt
			.map((m) => {
				if (typeof m === "string") return m;
				if (typeof m === "object" && m !== null) {
					return (m as Record<string, unknown>).content ?? "";
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

function resolveActionName(
	pieceName: string,
	defaultAction: string,
	params: Record<string, unknown>,
): string {
	// Try to determine the specific action from N8N parameters
	if (params.operation && typeof params.operation === "string") {
		return params.operation;
	}
	if (params.action && typeof params.action === "string") {
		return params.action;
	}
	if (params.resource && params.operation) {
		return `${params.resource}_${params.operation}`;
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

function convertN8NParameters(
	params: Record<string, unknown>,
): Record<string, unknown> {
	// Pass through most parameters directly
	// Filter out N8N-specific metadata
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
		converted[key] = value;
	}
	return converted;
}
