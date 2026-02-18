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
	color: "yellow" | "orange" | "red" | "blue" | "green" | "purple" | "gray";
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
	connectionType?: "regular" | "subNode";
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
					warnings.push({
						nodeType: "credential",
						nodeName: n8nNode.name,
						message: `Credential '${fallbackHint.n8nCredentialName}' (${fallbackHint.n8nCredentialType}) must be configured${fallbackHint.suggestedPiece ? ` — suggested piece: ${fallbackHint.suggestedPiece}` : ""}`,
					});
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
	let { connections, cyclesConverted } = transformCyclesToLoops(
		rawConnections,
		giselleNodes,
		nodeIdMapping,
		warnings,
	);

	// Phase 2c: Remove input ports from leaf nodes (N8N sub-nodes with no incoming connections)
	// In N8N, certain node types (AI models, parsers, tools) are "sub-nodes" that only
	// have outputs — they plug into agent sub-inputs. These should NOT have input handles.
	const nodesWithIncoming = new Set<string>();
	for (const conn of connections) {
		nodesWithIncoming.add(conn.inputNode.id);
	}
	for (const node of giselleNodes) {
		if (nodesWithIncoming.has(node.id)) continue;
		const contentType = (node.content as { type: string }).type;
		if (contentType === "trigger") continue;
		if (node.inputs.length > 0) {
			node.inputs = [];
			for (const mapping of Object.values(nodeIdMapping)) {
				if (mapping.nodeId === node.id) {
					mapping.inputIds = [];
					break;
				}
			}
		}
	}

	// Phase 2d: Remove orphan nodes (nodes with zero connections)
	// Nodes that appear in neither side of any connection are useless clutter.
	// Keep trigger nodes (they're valid entry points even without downstream).
	const connectedNodeIds = new Set<string>();
	for (const conn of connections) {
		connectedNodeIds.add(conn.outputNode.id);
		connectedNodeIds.add(conn.inputNode.id);
	}
	const orphanNames: string[] = [];
	for (let i = giselleNodes.length - 1; i >= 0; i--) {
		const node = giselleNodes[i];
		if (connectedNodeIds.has(node.id)) continue;
		const contentType = (node.content as { type: string }).type;
		if (contentType === "trigger") continue;
		orphanNames.push(node.name);
		giselleNodes.splice(i, 1);
		delete nodePositions[node.id];
	}
	if (orphanNames.length > 0) {
		warnings.push({
			nodeType: "orphan",
			nodeName: orphanNames.join(", "),
			message: `${orphanNames.length} disconnected node(s) removed: ${orphanNames.join(", ")}`,
		});
	}

	// Phase 2e: Absorb connected chatModel sub-nodes' model config into aiAgent nodes
	// In N8N, agents get their model from connected ai_languageModel sub-nodes.
	// In Vibexe, aiAgent has an inline model picker. This phase copies the model config.
	for (const [sourceName, connTypes] of Object.entries(n8nWorkflow.connections)) {
		for (const [connType, outputGroups] of Object.entries(connTypes as Record<string, unknown[][]>)) {
			if (connType !== "ai_languageModel") continue;
			for (const outputGroup of outputGroups) {
				for (const conn of outputGroup as Array<{ node: string; type: string; index: number }>) {
					const targetMapping = nodeIdMapping[conn.node];
					const sourceMapping = nodeIdMapping[sourceName];
					if (!targetMapping || !sourceMapping) continue;
					if (targetMapping.contentType !== "aiAgent") continue;
					if (sourceMapping.contentType !== "chatModel") continue;

					// Find the target aiAgent node and source chatModel node
					const agentNode = giselleNodes.find((n) => n.id === targetMapping.nodeId);
					const modelNode = giselleNodes.find((n) => n.id === sourceMapping.nodeId);
					if (!agentNode || !modelNode) continue;

					// Copy model config from chatModel to aiAgent's inline model picker
					const modelContent = modelNode.content as { type: string; languageModel?: { provider: string; id: string; configuration: Record<string, unknown> } };
					if (modelContent.languageModel) {
						const agentContent = agentNode.content as Record<string, unknown>;
						agentContent.languageModel = { ...modelContent.languageModel };
					}
				}
			}
		}
	}

	// Phase 2f: Absorb output parser sub-node configs into aiAgent nodes
	// N8N uses ai_outputParser connections to link parsers to agents (or to other parsers in chains).
	// We traverse these chains to find the ultimate AI agent and transfer parser configurations.
	{
		// Step 1: Build parser→target map from ai_outputParser connections
		const parserTargetMap = new Map<string, string>(); // sourceName → targetName
		for (const [sourceName, connTypes] of Object.entries(n8nWorkflow.connections)) {
			for (const [connType, outputGroups] of Object.entries(connTypes as Record<string, unknown[][]>)) {
				if (connType !== "ai_outputParser") continue;
				for (const outputGroup of outputGroups) {
					for (const conn of outputGroup as Array<{ node: string }>) {
						parserTargetMap.set(sourceName, conn.node);
					}
				}
			}
		}

		// Step 2: For each parser, follow chain to find ultimate AI agent
		const n8nNodeByName = new Map(n8nWorkflow.nodes.map(n => [n.name, n]));

		for (const [parserName] of parserTargetMap) {
			// Follow the chain: parser → parser → ... → agent
			let currentTarget = parserTargetMap.get(parserName);
			const visited = new Set<string>([parserName]);
			while (currentTarget && parserTargetMap.has(currentTarget) && !visited.has(currentTarget)) {
				visited.add(currentTarget);
				currentTarget = parserTargetMap.get(currentTarget);
			}

			if (!currentTarget) continue;
			const agentMapping = nodeIdMapping[currentTarget];
			if (!agentMapping || agentMapping.contentType !== "aiAgent") continue;

			const agentNode = giselleNodes.find(n => n.id === agentMapping.nodeId);
			if (!agentNode) continue;

			const n8nNode = n8nNodeByName.get(parserName);
			if (!n8nNode) continue;

			const agentContent = agentNode.content as Record<string, unknown>;
			const n8nType = n8nNode.type.toLowerCase();

			if (n8nType.includes("outputparserstructured")) {
				// Extract JSON schema and enable structured output
				const schema = n8nNode.parameters?.jsonSchemaExample as string ?? "";
				agentContent.structuredOutput = { enabled: true, schema };
				// Set parser type to "structured" only if still "none" (autoFixing takes precedence)
				if ((agentContent.outputParser as Record<string, unknown>)?.type === "none") {
					agentContent.outputParser = { type: "structured", retryAttempts: 3 };
				}
			} else if (n8nType.includes("outputparserautofixing")) {
				// Auto-fixing always takes precedence over structured for parser type
				agentContent.outputParser = { type: "autoFixing", retryAttempts: 3 };
			} else if (n8nType.includes("outputparseritemlist")) {
				agentContent.outputParser = { type: "itemList", retryAttempts: 3 };
			}
		}
	}

	// Phase 2g: Sub-nodes KEPT on canvas (not deleted)
	// chatModel, toolNode, and memoryNode sub-nodes remain visible below
	// their parent aiAgent node, connected with dashed subNode connections.
	// Phase 2e/2f still copies model/parser config into aiAgent for runtime.

	// Phase 2h: Scale coordinates to match Vibexe's node sizes
	// N8N nodes are ~130x40px compact rectangles, Vibexe nodes are 96x96px cards.
	// 0.65x balances N8N layout preservation with Vibexe card sizes.
	const IMPORT_SCALE = 0.65;
	for (const id of Object.keys(nodePositions)) {
		nodePositions[id] = {
			x: nodePositions[id].x * IMPORT_SCALE,
			y: nodePositions[id].y * IMPORT_SCALE,
		};
	}
	for (const note of stickyNotes) {
		note.position.x *= IMPORT_SCALE;
		note.position.y *= IMPORT_SCALE;
		note.size.width *= IMPORT_SCALE;
		note.size.height *= IMPORT_SCALE;
	}

	// Phase 2i: Expand sticky notes to encompass contained Vibexe nodes.
	// Uses per-node-type dimensions so aiAgent (224px wide) expands notes more
	// than standard cards (96px) or sub-nodes (80px).
	{
		const PAD = 50; // Margin inside sticky note border

		// Get rendered width/height per node based on content type
		function getNodeDimensions(nodeId: string): { w: number; h: number } {
			const node = giselleNodes.find((n) => n.id === nodeId);
			if (!node) return { w: 96, h: 96 };
			const contentType = node.content.type as string;
			switch (contentType) {
				case "aiAgent":
					return { w: 224, h: 96 };
				case "chatModel":
				case "toolNode":
				case "memoryNode":
					return { w: 80, h: 80 };
				default:
					return { w: 96, h: 96 };
			}
		}

		for (const note of stickyNotes) {
			const noteRight = note.position.x + note.size.width;
			const noteBottom = note.position.y + note.size.height;

			// Find nodes whose positions fall within this sticky note's bounds
			const contained: Array<{ x: number; y: number; w: number; h: number }> = [];
			for (const [id, pos] of Object.entries(nodePositions)) {
				if (
					pos.x >= note.position.x - PAD &&
					pos.x <= noteRight + PAD &&
					pos.y >= note.position.y - PAD &&
					pos.y <= noteBottom + PAD
				) {
					const dims = getNodeDimensions(id);
					contained.push({ x: pos.x, y: pos.y, w: dims.w, h: dims.h });
				}
			}
			if (contained.length === 0) continue;

			// Compute bounding box using actual node dimensions
			const minX = Math.min(...contained.map((p) => p.x)) - PAD;
			const minY = Math.min(...contained.map((p) => p.y)) - PAD;
			const maxX = Math.max(...contained.map((p) => p.x + p.w)) + PAD;
			const maxY = Math.max(...contained.map((p) => p.y + p.h)) + PAD;

			// Expand note to encompass bounding box (never shrink)
			note.position.x = Math.min(note.position.x, minX);
			note.position.y = Math.min(note.position.y, minY);
			note.size.width = Math.max(note.size.width, maxX - note.position.x);
			note.size.height = Math.max(note.size.height, maxY - note.position.y);
		}
	}

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
			const extractedModel = extractModelId(n8nNode.parameters);
			const modelId = extractedModel
				? normalizeModelId(mapping.provider, extractedModel)
				: `${mapping.provider}/${mapping.modelId}`;
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

		// --- LangChain AI Agent → native aiAgent node ---

		case "aiAgent": {
			// Extract system prompt and user prompt from N8N agent parameters
			const agentSystemPrompt = typeof n8nNode.parameters.options === "object"
				? String((n8nNode.parameters.options as Record<string, unknown>).systemMessage ?? "")
				: "";
			const agentUserPrompt = extractPromptFromN8NParams(n8nNode.parameters);

			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "aiAgent",
					version: "v1",
					agentType: mapping.agentType,
					languageModel: {
						provider: "openai",
						id: "openai/gpt-5",
						configuration: {},
					},
					tools: [],
					systemPrompt: cleanN8NExpression(agentSystemPrompt),
					prompt: cleanN8NExpression(agentUserPrompt),
					maxSteps: 30,
					structuredOutput: { enabled: false, schema: "" },
					fallbackModel: { enabled: false, configuration: {} },
					outputParser: { type: "none", retryAttempts: 3 },
					guardrails: { enabled: false, inputRules: [], outputRules: [] },
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

		// --- LangChain Sub-Nodes (round circle rendering) ---

		case "chatModel": {
			// Extract actual model from N8N params, normalize to registry ID format
			const extractedModel = extractModelId(n8nNode.parameters);
			const chatModelId = extractedModel
				? normalizeModelId(mapping.provider, extractedModel)
				: mapping.defaultModelId;
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "chatModel",
					languageModel: {
						provider: mapping.provider,
						id: chatModelId,
						configuration: {},
					},
				},
				inputs: [],
				outputs: [{
					id: OutputId.generate(),
					label: "Output",
					accessor: "output",
				}],
			};
		}

		case "toolNode": {
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				disabled: true,
				content: {
					type: "toolNode",
					toolType: mapping.toolType,
					configuration: {},
				},
				inputs: [],
				outputs: [{
					id: OutputId.generate(),
					label: "Output",
					accessor: "output",
				}],
			};
		}

		case "memoryNode": {
			return {
				id: NodeId.generate(),
				type: "operation",
				name: n8nNode.name,
				content: {
					type: "memoryNode",
					memoryType: mapping.memoryType,
					contextWindowLength: 10,
					sessionScope: "agent",
				},
				inputs: [],
				outputs: [{
					id: OutputId.generate(),
					label: "Output",
					accessor: "output",
				}],
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
			// V2 combinator override: stored in conditions.combinator, not top-level params
			const v2Combinator = condObj.combinator as string | undefined;
			const effectiveCombineWith: "and" | "or" = v2Combinator === "or" ? "or" : combineWith;

			for (const cond of condObj.conditions) {
				const c = cond as Record<string, unknown>;
				const leftValue = cleanN8NExpression(String(c.leftValue ?? c.value1 ?? ""));
				const rightValue = cleanN8NExpression(String(c.rightValue ?? c.value2 ?? ""));
				// V2 operator can be an object: { type: "string", operation: "equals" }
				const rawOperator = typeof c.operator === "object" && c.operator !== null
					? String((c.operator as Record<string, unknown>).operation ?? "")
					: String(c.operator ?? "");
				const op = N8N_OPERATOR_MAP[rawOperator] ?? "equals";
				conditions.push({ field: leftValue, operator: op, value: rightValue });
			}
			return { conditions, combineWith: effectiveCombineWith };
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
				// V2 operator can be an object: { type: "string", operation: "equals" }
				const rawOperator = typeof c.operator === "object" && c.operator !== null
					? String((c.operator as Record<string, unknown>).operation ?? "")
					: String(c.operator ?? "");
				const op = N8N_OPERATOR_MAP[rawOperator] ?? "equals";
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
							// V2 operator can be an object: { type: "string", operation: "equals" }
							const rawOperator = typeof c.operator === "object" && c.operator !== null
								? String((c.operator as Record<string, unknown>).operation ?? "")
								: String(c.operator ?? "");
							const op = N8N_OPERATOR_MAP[rawOperator] ?? "equals";
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
		case 1: return "yellow";
		case 2: return "orange";
		case 3: return "red";
		case 4: return "green";
		case 5: return "blue";
		case 6: return "purple";
		case 7: return "gray";
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
			x: n8nNode.position[0],
			y: n8nNode.position[1],
		},
		size: {
			width,
			height,
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

/** Default fallback model IDs per provider for when an N8N model isn't in our registry. */
const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
	openai: "openai/gpt-5",
	anthropic: "anthropic/claude-sonnet-4.5",
	google: "google/gemini-2.5-flash",
	xai: "xai/grok-3",
	nvidia: "nvidia/moonshotai/kimi-k2.5",
};

/**
 * Normalize an N8N model name to a valid registry model ID.
 * N8N uses legacy OpenAI names (gpt-4o-mini) while our registry uses current names (gpt-5-mini).
 * Falls back to provider default if the model isn't in our alias table or registry.
 */
function normalizeModelId(provider: string, rawModel: string): string {
	const key = `${provider}/${rawModel}`;
	if (key in MODEL_ID_ALIASES) {
		return MODEL_ID_ALIASES[key];
	}
	// If already in provider/model format and no alias found, check if it's already valid
	const candidateId = rawModel.includes("/") ? rawModel : `${provider}/${rawModel}`;
	// If the candidate is in the alias table (shouldn't reach here but safety check)
	if (candidateId in MODEL_ID_ALIASES) {
		return MODEL_ID_ALIASES[candidateId];
	}
	// Fall back to provider default to avoid invalid model IDs that crash workspace loading
	return PROVIDER_DEFAULT_MODELS[provider] ?? candidateId;
}

const MODEL_ID_ALIASES: Record<string, string> = {
	// Map N8N model names to valid registry model IDs.
	// Our registry uses current model names (gpt-5 series, claude-4.5 series).
	// N8N workflows may reference older or different-named models.

	// OpenAI: current generation → registry equivalents
	"openai/gpt-4o": "openai/gpt-5",
	"openai/gpt-4o-mini": "openai/gpt-5-mini",
	"openai/gpt-4.1": "openai/gpt-5",
	"openai/gpt-4.1-mini": "openai/gpt-5-mini",
	"openai/gpt-4.1-nano": "openai/gpt-5-nano",
	"openai/o4-mini": "openai/gpt-5-mini",
	"openai/o4": "openai/gpt-5",
	"openai/o3": "openai/gpt-5",
	"openai/o3-mini": "openai/gpt-5-mini",
	"openai/o1": "openai/gpt-5",
	"openai/o1-mini": "openai/gpt-5-mini",
	"openai/o1-preview": "openai/gpt-5",
	// OpenAI: deprecated models → registry equivalents
	"openai/gpt-4-turbo": "openai/gpt-5",
	"openai/gpt-4": "openai/gpt-5",
	"openai/gpt-3.5-turbo": "openai/gpt-5-mini",
	// Anthropic: deprecated models → current equivalents
	"anthropic/claude-3-opus": "anthropic/claude-sonnet-4.5",
	"anthropic/claude-3-sonnet": "anthropic/claude-sonnet-4.5",
	"anthropic/claude-3-haiku": "anthropic/claude-haiku-4.5",
	"anthropic/claude-3.5-sonnet": "anthropic/claude-sonnet-4.5",
	"anthropic/claude-3.5-haiku": "anthropic/claude-haiku-4.5",
	// Anthropic version-stamped → friendly names
	"anthropic/claude-sonnet-4-5-20250929": "anthropic/claude-sonnet-4.5",
	// Google: deprecated models → current equivalents
	"google/gemini-1.5-pro": "google/gemini-2.5-pro",
	"google/gemini-1.5-flash": "google/gemini-2.5-flash",
	"google/gemini-2.0-flash": "google/gemini-2.5-flash",
	"google/gemini-pro": "google/gemini-2.5-pro",
};

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

	// Handle bare expressions without {{ }} wrappers (N8N = prefix mode)
	if (!cleaned.includes("{{") && cleaned.includes("$")) {
		// $json['key'] or $json["key"] -> [input.key]
		cleaned = cleaned.replace(
			/\$json\[['"]([^'"]+)['"]\]/g,
			"[input.$1]",
		);
		// $json.field -> [input.field]
		cleaned = cleaned.replace(
			/\$json\.([a-zA-Z_]\w*)/g,
			"[input.$1]",
		);
		// $('NodeName').first().json['key'] -> [NodeName.key]
		cleaned = cleaned.replace(
			/\$\(['"]([^'"]+)['"]\)\.first\(\)\.json\[['"]([^'"]+)['"]\]/g,
			"[$1.$2]",
		);
		// $('NodeName').item.json['key'] -> [NodeName.key]
		cleaned = cleaned.replace(
			/\$\(['"]([^'"]+)['"]\)\.item\.json\[['"]([^'"]+)['"]\]/g,
			"[$1.$2]",
		);
		// $('NodeName').first().json.field -> [NodeName.field]
		cleaned = cleaned.replace(
			/\$\(['"]([^'"]+)['"]\)\.first\(\)\.json\.([a-zA-Z_][\w.]*)/g,
			"[$1.$2]",
		);
		// $('NodeName').item.json.field -> [NodeName.field]
		cleaned = cleaned.replace(
			/\$\(['"]([^'"]+)['"]\)\.item\.json\.([a-zA-Z_][\w.]*)/g,
			"[$1.$2]",
		);
	}

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

	// 10.5. {{ $json['key with spaces'] }} -> [input.key with spaces]
	cleaned = cleaned.replace(
		/\{\{\s*\$json\[['"]([^'"]+)['"]\]\s*\}\}/g,
		"[input.$1]",
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

	// 19.5a. {{ $('NodeName').first().json['key with spaces'] }} -> [NodeName.key with spaces]
	cleaned = cleaned.replace(
		/\{\{\s*\$\(['"]([^'"]+)['"]\)\.first\(\)\.json\[['"]([^'"]+)['"]\]\s*\}\}/g,
		"[$1.$2]",
	);

	// 19.5b. {{ $('NodeName').item.json['key with spaces'] }} -> [NodeName.key with spaces]
	cleaned = cleaned.replace(
		/\{\{\s*\$\(['"]([^'"]+)['"]\)\.item\.json\[['"]([^'"]+)['"]\]\s*\}\}/g,
		"[$1.$2]",
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
	// Check parameters.authentication + genericAuthType (N8N templates without credentials field)
	// e.g. HTTP Request nodes with authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth"
	const authParam = n8nNode.parameters?.authentication as string | undefined;
	const genericAuthType = n8nNode.parameters?.genericAuthType as string | undefined;
	if (authParam === "genericCredentialType" && genericAuthType) {
		const suggestedPiece = N8N_CREDENTIAL_TO_PIECE[genericAuthType] ?? null;
		return {
			n8nCredentialType: genericAuthType,
			n8nCredentialName: genericAuthType,
			suggestedPiece,
		};
	}
	// Check node type for inherently authenticated services (Google Sheets, Drive, etc.)
	// N8N templates often omit the credentials field but these nodes always require OAuth2
	const nodeType = n8nNode.type?.toLowerCase() ?? "";
	const INHERENT_CREDENTIAL_TYPES: Record<string, { credType: string; piece: string }> = {
		"n8n-nodes-base.googlesheets": { credType: "googleSheetsOAuth2Api", piece: "google-sheets" },
		"n8n-nodes-base.googledrive": { credType: "googleDriveOAuth2Api", piece: "google-drive" },
		"n8n-nodes-base.gmail": { credType: "gmailOAuth2", piece: "gmail" },
		"n8n-nodes-base.googlecalendar": { credType: "googleCalendarOAuth2Api", piece: "google-calendar" },
		"n8n-nodes-base.slack": { credType: "slackOAuth2Api", piece: "slack" },
		"n8n-nodes-base.notion": { credType: "notionApi", piece: "notion" },
		"n8n-nodes-base.airtable": { credType: "airtableApi", piece: "airtable" },
		"n8n-nodes-base.discord": { credType: "discordOAuth2Api", piece: "discord" },
		"n8n-nodes-base.hubspot": { credType: "hubspotOAuth2Api", piece: "hubspot" },
		"n8n-nodes-base.telegram": { credType: "telegramApi", piece: "telegram-bot" },
		"n8n-nodes-base.dropbox": { credType: "dropboxOAuth2Api", piece: "dropbox" },
		"n8n-nodes-base.trello": { credType: "trelloApi", piece: "trello" },
		"n8n-nodes-base.jira": { credType: "jiraCloudApi", piece: "jira-cloud" },
		"n8n-nodes-base.asana": { credType: "asanaOAuth2Api", piece: "asana" },
	};
	if (nodeType in INHERENT_CREDENTIAL_TYPES) {
		const entry = INHERENT_CREDENTIAL_TYPES[nodeType];
		return {
			n8nCredentialType: entry.credType,
			n8nCredentialName: entry.credType,
			suggestedPiece: entry.piece,
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
			// POLLING_LOOP or RETRY_LOOP — synthesize a Loop node in polling mode.
			// Polling mode repeats the loop body until an If/Switch routes to an exit branch.
			const loopNode: GiselleNodeData = {
				id: NodeId.generate(),
				type: "operation",
				name: `Loop (converted)`,
				content: {
					type: "loop",
					mode: "polling",
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
			// Strip back-edge — Loop executor handles iteration internally,
			// no need for visual back-edge connections (they cause SSR hangs)
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
 * Compute layout by using N8N raw positions directly (1:1 mapping).
 * N8N coordinates have ~272px gaps between adjacent nodes, which works well
 * for Giselle's 96px card nodes (visible gap = 272 - 96 = 176px).
 * Falls back to topological layout only if raw positions are missing.
 */
function computeLayout(
	nodes: GiselleNodeData[],
	connections: GiselleConnectionData[],
	rawPositions: Record<string, { x: number; y: number }>,
): Record<string, { x: number; y: number }> {
	// Use raw N8N positions directly — they preserve the author's 2D layout intent
	const positions: Record<string, { x: number; y: number }> = {};
	let hasPositions = false;
	for (const node of nodes) {
		if (rawPositions[node.id]) {
			positions[node.id] = { ...rawPositions[node.id] };
			hasPositions = true;
		}
	}

	// Fall back to topological layout only if we have no raw positions
	if (!hasPositions) {
		return computeLayoutTopological(nodes, [], connections, rawPositions);
	}

	// Assign smart position for synthesized nodes (e.g. Loop (converted))
	// by averaging the positions of their connected neighbors
	for (const node of nodes) {
		if (!positions[node.id]) {
			// Find connected nodes that DO have positions
			const neighborPositions: Array<{ x: number; y: number }> = [];
			for (const conn of connections) {
				if (conn.outputNode.id === node.id && positions[conn.inputNode.id]) {
					neighborPositions.push(positions[conn.inputNode.id]);
				}
				if (conn.inputNode.id === node.id && positions[conn.outputNode.id]) {
					neighborPositions.push(positions[conn.outputNode.id]);
				}
			}
			if (neighborPositions.length > 0) {
				// Place between the upstream and downstream neighbors
				const avgX = neighborPositions.reduce((s, p) => s + p.x, 0) / neighborPositions.length;
				const avgY = neighborPositions.reduce((s, p) => s + p.y, 0) / neighborPositions.length;
				// Offset slightly left of the average so it sits between input and first body node
				positions[node.id] = { x: avgX - 100, y: avgY };
			} else {
				positions[node.id] = { x: 0, y: 0 };
			}
		}
	}

	return positions;
}

/**
 * Topological sort layout with compact spacing matching Giselle's auto-arrange.
 * Uses Kahn's algorithm for layer assignment with Y-sort by raw N8N position
 * to preserve the author's vertical grouping intent.
 */
function computeLayoutTopological(
	flowNodes: GiselleNodeData[],
	_stickyNodes: GiselleNodeData[],
	connections: GiselleConnectionData[],
	rawPositions?: Record<string, { x: number; y: number }>,
): Record<string, { x: number; y: number }> {
	const HORIZONTAL_GAP = 200;
	const VERTICAL_GAP = 140;

	// Build adjacency for flow nodes
	const flowNodeIds = new Set(flowNodes.map((n) => n.id));
	const adj: Record<string, string[]> = {};
	const inDegree: Record<string, number> = {};
	const parentOutput = new Map<string, string>();

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

	// Kahn's algorithm for layer assignment
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

	// Handle unreached nodes (cycles)
	for (const n of flowNodes) {
		if (depth[n.id] === undefined) depth[n.id] = 0;
	}

	// Group nodes by depth column
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

		// Sort nodes within column by raw N8N Y position (preserves vertical grouping)
		if (rawPositions) {
			nodeIds.sort((a, b) => {
				const ay = rawPositions[a]?.y ?? 0;
				const by = rawPositions[b]?.y ?? 0;
				return ay - by;
			});
		}

		// Group by parent output port for fork spreading
		const groups = new Map<string, string[]>();
		for (const nodeId of nodeIds) {
			const key = parentOutput.get(nodeId) ?? "root";
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(nodeId);
		}

		// Spread vertically, centering around y=0
		const totalHeight = (nodeIds.length - 1) * VERTICAL_GAP;
		let currentY = -totalHeight / 2;
		for (const [, group] of groups) {
			for (const nodeId of group) {
				positions[nodeId] = { x, y: currentY };
				currentY += VERTICAL_GAP;
			}
		}
	}

	return positions;
}
