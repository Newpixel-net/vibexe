import { createId } from "@paralleldrive/cuid2";
import { nodeFactories } from "@vibexe-ai/node-registry";
import {
	App,
	AppId,
	Connection,
	ConnectionId,
	InputId,
	Workspace,
	type NodeLike,
	type WorkspaceId,
} from "@vibexe-ai/protocol";
import { isSupportedConnection } from "@vibexe-ai/react";
import { tool } from "ai";
import { z } from "zod";
import { agents, db, workspaces } from "@/db";
import { vibexe } from "@/app/vibexe";
import { fetchCurrentUser } from "@/services/accounts";
import { fetchCurrentTeam } from "@/services/teams";

type WorkspaceType = z.infer<typeof Workspace>;

export function createWorkflowTools() {
	// In-memory workspace cache to avoid S3 eventual consistency issues.
	// All tools read/write through this cache so add_connection always
	// sees nodes that were just added by add_node.
	const wsCache = new Map<string, WorkspaceType>();

	// Per-workspace sequential execution lock to prevent parallel tool calls
	// from clobbering each other (e.g., two add_connection calls running
	// concurrently would both read the same state and the second would
	// overwrite the first's changes).
	const wsLocks = new Map<string, Promise<void>>();

	/** Acquire a per-workspace lock. Returns a release function. */
	function acquireLock(workspaceId: string): Promise<() => void> {
		const prev = wsLocks.get(workspaceId) ?? Promise.resolve();
		let release: () => void;
		const next = new Promise<void>((resolve) => { release = resolve; });
		wsLocks.set(workspaceId, prev.then(() => next));
		return prev.then(() => release!);
	}

	async function getWorkspaceCached(id: string): Promise<WorkspaceType> {
		const cached = wsCache.get(id);
		if (cached) return cached;
		const ws = await vibexe.getWorkspace(id as WorkspaceId);
		wsCache.set(id, ws);
		return ws;
	}

	async function saveWorkspaceCached(ws: WorkspaceType): Promise<void> {
		wsCache.set(ws.id, ws);
		await vibexe.updateWorkspace(ws);
	}

	return {
		present_plan: tool({
			description:
				"Present the workflow plan to the user for visual review before building. The UI will render a node diagram from this data. Wait for user approval before proceeding to build.",
			inputSchema: z.object({
				name: z.string().describe("Workflow name"),
				description: z
					.string()
					.describe("Brief description of what the workflow does"),
				nodes: z.array(
					z.object({
						tempId: z
							.string()
							.describe('Temporary ID for this node, e.g. "node-1"'),
						name: z.string().describe("Display name for the node"),
						type: z
							.enum([
								"textGeneration",
								"imageGeneration",
								"trigger",
								"action",
								"query",
								"dataQuery",
								"end",
								"text",
								"file",
								"github",
								"webPage",
								"vectorStore",
								"dataStore",
								"appEntry",
								"integration",
								"if",
								"switch",
								"merge",
								"loop",
								"code",
								"filter",
								"editFields",
								"sort",
								"wait",
								"errorTrigger",
								"aggregate",
								"summarize",
								"limit",
								"removeDuplicates",
								"renameKeys",
								"splitOut",
								"compareDatasets",
								"executeSubWorkflow",
								"respondToWebhook",
								"customVariables",
								"dataTable",
								"formTrigger",
							])
							.describe("The node type"),
						provider: z
							.string()
							.optional()
							.describe(
								'LLM provider for model nodes, e.g. "openai", "anthropic", "xai"',
							),
						modelId: z
							.string()
							.optional()
							.describe(
								'LLM model ID, e.g. "gpt-5-mini", "claude-sonnet-4.5"',
							),
						pieceName: z
							.string()
							.optional()
							.describe(
								'Activepieces piece name for integration nodes, e.g. "slack"',
							),
						actionName: z
							.string()
							.optional()
							.describe(
								'Activepieces action name, e.g. "send-channel-message"',
							),
						promptSummary: z
							.string()
							.optional()
							.describe(
								"Brief description of what the prompt does (for textGeneration nodes)",
							),
					}),
				),
				connections: z.array(
					z.object({
						from: z.string().describe("tempId of source node"),
						to: z.string().describe("tempId of target node"),
					}),
				),
			}),
			execute: async (plan) => {
				// Validate unique tempIds — duplicate tempIds cause silent node loss during build
				const tempIds = plan.nodes.map((n) => n.tempId);
				const seen = new Set<string>();
				const duplicates: string[] = [];
				for (const id of tempIds) {
					if (seen.has(id)) duplicates.push(id);
					seen.add(id);
				}
				if (duplicates.length > 0) {
					return {
						success: false,
						plan,
						message: `Plan has duplicate tempIds: ${duplicates.join(", ")}. Each node must have a unique tempId.`,
					};
				}

				// Validate appEntry exists
				if (!plan.nodes.some((n) => n.type === "appEntry")) {
					return {
						success: false,
						plan,
						message: "Plan is missing a Start (appEntry) node. Every workflow must have a Start node.",
					};
				}

				// Validate end node exists
				if (!plan.nodes.some((n) => n.type === "end")) {
					return {
						success: false,
						plan,
						message: "Plan is missing an End node. Every workflow must have an End node.",
					};
				}

				// Validate connections reference valid tempIds
				const validTempIds = new Set(tempIds);
				const badConns: string[] = [];
				for (const conn of plan.connections) {
					if (!validTempIds.has(conn.from)) badConns.push(`from "${conn.from}"`);
					if (!validTempIds.has(conn.to)) badConns.push(`to "${conn.to}"`);
				}
				if (badConns.length > 0) {
					return {
						success: false,
						plan,
						message: `Plan has connections referencing non-existent nodes: ${badConns.join(", ")}. Fix the connections to use valid tempIds.`,
					};
				}

				return {
					success: true,
					plan,
					message:
					"Plan presented to user. STOP HERE. The UI is now showing the visual plan preview. Do NOT call any more tools. Wait for the user to review and approve the plan before building.",
				};
			},
		}),

		create_workflow: tool({
			description: "Create a new empty workflow workspace",
			inputSchema: z.object({
				name: z.string().describe("Workflow name"),
				description: z.string().describe("Brief description of the workflow"),
			}),
			execute: async ({ name, description }) => {
				try {
					const user = await fetchCurrentUser();
					const team = await fetchCurrentTeam();

					const workspace = await vibexe.createWorkspace();

					const agentId = `agnt_${createId()}` as const;
					await db.insert(agents).values({
						id: agentId,
						teamDbId: team.dbId,
						creatorDbId: user.dbId,
						workspaceId: workspace.id,
						name,
					});
					await db.insert(workspaces).values({
						id: workspace.id,
						creatorDbId: user.dbId,
						teamDbId: team.dbId,
						name,
					});

					// Set workspace name and ensure correct Workspace type
					const parsedWorkspace = Workspace.parse({
						...workspace,
						name,
					});
					await saveWorkspaceCached(parsedWorkspace);

					return {
						success: true,
						workspaceId: workspace.id,
						name,
						description,
						error: "",
					};
				} catch (error) {
					console.error("create_workflow error:", error);
					return {
						success: false,
						workspaceId: "",
						name: "",
						description: "",
						error: `Failed to create workflow: ${String(error)}`,
					};
				}
			},
		}),

		add_node: tool({
			description:
				"Add a node to the workflow. Returns the node ID and its output IDs for use in connections.",
			inputSchema: z.object({
				workspaceId: z.string().describe("The workspace ID from create_workflow"),
				type: z
					.enum([
						"textGeneration",
						"imageGeneration",
						"trigger",
						"action",
						"query",
						"dataQuery",
						"end",
						"text",
						"file",
						"github",
						"webPage",
						"vectorStore",
						"dataStore",
						"appEntry",
						"integration",
						"if",
						"switch",
						"merge",
						"loop",
						"code",
						"filter",
						"editFields",
						"sort",
						"wait",
						"errorTrigger",
						"aggregate",
						"summarize",
						"limit",
						"removeDuplicates",
						"renameKeys",
						"splitOut",
						"compareDatasets",
						"executeSubWorkflow",
						"respondToWebhook",
						"customVariables",
						"dataTable",
						"formTrigger",
					])
					.describe("The node type to add"),
				name: z.string().describe("Display name for the node"),
				llmProvider: z
					.enum(["openai", "anthropic", "google", "perplexity", "xai", "nvidia"])
					.optional()
					.describe(
						"LLM provider (required for textGeneration and imageGeneration)",
					),
				llmModelId: z
					.string()
					.optional()
					.describe(
						"LLM model ID (required for textGeneration and imageGeneration)",
					),
				triggerProvider: z
					.enum(["github", "manual"])
					.optional()
					.describe("Trigger provider (required for trigger nodes)"),
				actionProvider: z
					.enum(["github"])
					.optional()
					.describe("Action provider (required for action nodes)"),
				fileCategory: z
					.enum(["pdf", "text", "image"])
					.optional()
					.describe("File category (required for file nodes)"),
				vectorStoreProvider: z
					.enum(["github-issue", "github-pull-request", "document"])
					.optional()
					.describe(
						"Vector store provider (required for vectorStore nodes)",
					),
				searchGrounding: z
					.boolean()
					.optional()
					.describe(
						"Enable Google web search grounding (only for Google textGeneration nodes)",
					),
				pieceName: z
					.string()
					.optional()
					.describe("Activepieces piece name (required for integration nodes, e.g. 'slack', 'google-sheets')"),
				actionName: z
					.string()
					.optional()
					.describe("Activepieces action name (required for integration nodes, e.g. 'send-message')"),
				pieceVersion: z
					.string()
					.optional()
					.describe("Activepieces piece version (optional for integration nodes, defaults to '0.0.0')"),
				position: z.object({
					x: z.number(),
					y: z.number(),
				}).describe("Position on the canvas"),
			}),
			execute: async ({
				workspaceId,
				type,
				name,
				llmProvider,
				llmModelId,
				triggerProvider,
				actionProvider,
				fileCategory,
				vectorStoreProvider,
				searchGrounding,
				pieceName,
				actionName,
				pieceVersion,
				position,
			}) => {
				const errResult = (msg: string) => ({
					success: false as const,
					nodeId: "",
					nodeName: "",
					nodeType: "",
					outputs: [] as { outputId: string; accessor: string; label: string }[],
					inputs: [] as { inputId: string; accessor: string; label: string }[],
					error: msg,
				});

				const release = await acquireLock(workspaceId);
				try {
					const workspace = await getWorkspaceCached(workspaceId);

					let node;

					switch (type) {
						case "textGeneration": {
							if (!llmProvider || !llmModelId) {
								return errResult("llmProvider and llmModelId are required for textGeneration nodes");
							}
							const defaultConfigs: Record<
								string,
								Record<string, unknown>
							> = {
								openai: {
									temperature: 0.7,
									topP: 1.0,
									presencePenalty: 0.0,
									frequencyPenalty: 0.0,
								},
								anthropic: {
									temperature: 0.7,
									topP: 1.0,
								},
								google: {
									temperature: 0.7,
									topP: 1.0,
									searchGrounding: false,
								},
								perplexity: {
									temperature: 0.2,
									topP: 0.9,
									presencePenalty: 0.0,
									frequencyPenalty: 1.0,
								},
								xai: {
									temperature: 0.7,
									topP: 1.0,
									presencePenalty: 0.0,
									frequencyPenalty: 0.0,
								},
								nvidia: {
									temperature: 0.7,
									topP: 1.0,
								},
							};
							const configurations = { ...(defaultConfigs[llmProvider] ?? {}) };
							if (llmProvider === "google" && searchGrounding) {
								configurations.searchGrounding = true;
							}
							node = nodeFactories.create("textGeneration", {
								provider: llmProvider,
								id: llmModelId,
								configurations,
							} as Parameters<typeof nodeFactories.create<"textGeneration">>[1]);
							break;
						}
						case "imageGeneration": {
							if (!llmProvider || !llmModelId) {
								return errResult("llmProvider and llmModelId are required for imageGeneration nodes");
							}
							node = nodeFactories.create("imageGeneration", {
								provider: llmProvider,
								id: llmModelId,
								configurations: {},
							} as Parameters<typeof nodeFactories.create<"imageGeneration">>[1]);
							break;
						}
						case "trigger": {
							const provider = triggerProvider ?? "github";
							node = nodeFactories.create("trigger", provider as Parameters<typeof nodeFactories.create<"trigger">>[1]);
							break;
						}
						case "action": {
							const provider = actionProvider ?? "github";
							node = nodeFactories.create("action", provider as Parameters<typeof nodeFactories.create<"action">>[1]);
							break;
						}
						case "file": {
							const category = fileCategory ?? "text";
							node = nodeFactories.create("file", category as Parameters<typeof nodeFactories.create<"file">>[1]);
							break;
						}
						case "vectorStore": {
							const provider = vectorStoreProvider ?? "document";
							node = nodeFactories.create("vectorStore", provider as Parameters<typeof nodeFactories.create<"vectorStore">>[1]);
							break;
						}
						case "integration": {
							if (!pieceName || !actionName) {
								return errResult("pieceName and actionName are required for integration nodes");
							}
							// Resolve real piece version if not explicitly provided
							let resolvedVersion = pieceVersion ?? "0.0.0";
							if (!pieceVersion) {
								try {
									const { inspectPiece } = await import(
										"@vibexe-ai/activepieces-adapter/server"
									);
									const info = await inspectPiece(pieceName);
									if (info.version && info.version !== "0.0.0") {
										resolvedVersion = info.version;
									}
								} catch {
									// Fall back to "0.0.0" — piece will still work at runtime
								}
							}
							node = nodeFactories.create("integration", {
								pieceName,
								actionName,
								pieceVersion: resolvedVersion,
							});
							break;
						}
						case "query":
						case "dataQuery":
						case "end":
						case "text":
						case "github":
						case "webPage":
						case "dataStore":
						case "appEntry":
						case "if":
						case "switch":
						case "merge":
						case "loop":
						case "code":
						case "filter":
						case "editFields":
						case "sort":
						case "wait":
						case "errorTrigger":
						case "aggregate":
						case "summarize":
						case "limit":
						case "removeDuplicates":
						case "renameKeys":
						case "splitOut":
						case "compareDatasets":
						case "executeSubWorkflow":
						case "respondToWebhook":
						case "customVariables":
						case "dataTable":
						case "formTrigger":
							node = nodeFactories.create(type);
							break;
						default:
							return errResult(`Unknown node type: ${type}`);
					}

					// Set custom name
					(node as { name?: string }).name = name;

					// Add node to workspace
					workspace.nodes.push(node);

					// Set UI position
					workspace.ui.nodeState[node.id] = {
						position: { x: position.x, y: position.y },
						selected: false,
					};

					await saveWorkspaceCached(workspace);

					// Auto-configure appEntry nodes so the Run dialog works
					if (type === "appEntry" && node.content.type === "appEntry" && node.content.status === "unconfigured") {
						try {
							const draftApp = node.content.draftApp;
							const appId = AppId.generate();
							const appLike = {
								id: appId,
								version: "v1" as const,
								state: "disconnected" as const,
								description: draftApp.description ?? "",
								parameters: draftApp.parameters,
								entryNodeId: node.id,
								workspaceId: workspaceId as WorkspaceId,
							};
							const parseResult = App.safeParse(appLike);
							if (parseResult.success) {
								await vibexe.saveApp({ app: parseResult.data });
								// Update node content to configured
								(node.content as Record<string, unknown>).status = "configured";
								(node.content as Record<string, unknown>).appId = appId;
								delete (node.content as Record<string, unknown>).draftApp;
								await saveWorkspaceCached(workspace);
							} else {
								console.error("[add_node] App.safeParse failed:", JSON.stringify(parseResult.error));
							}
						} catch (configError) {
							console.error("Auto-configure appEntry warning:", configError);
						}
					}

					return {
						success: true as const,
						nodeId: node.id,
						nodeName: name,
						nodeType: type,
						outputs: node.outputs.map((o) => ({
							outputId: o.id,
							accessor: o.accessor,
							label: o.label,
						})),
						inputs: node.inputs.map((i) => ({
							inputId: i.id,
							accessor: i.accessor,
							label: i.label,
						})),
						error: "",
					};
				} catch (error) {
					console.error("add_node error:", error);
					return errResult(`Failed to add node: ${String(error)}`);
				} finally {
					release();
				}
			},
		}),

		add_connection: tool({
			description:
				"Connect two nodes by linking a source output to a target input. If the target node has no matching input, one will be created automatically. IMPORTANT: Call this tool ONE AT A TIME, waiting for each connection to complete before adding the next.",
			inputSchema: z.object({
				workspaceId: z.string().describe("The workspace ID"),
				sourceNodeId: z.string().describe("The source node ID"),
				sourceOutputId: z
					.string()
					.describe("The output ID from the source node"),
				targetNodeId: z.string().describe("The target node ID"),
				targetInputId: z
					.string()
					.optional()
					.describe(
						"The input ID on the target node. If not provided, a new input will be created.",
					),
			}),
			execute: async ({
				workspaceId,
				sourceNodeId,
				sourceOutputId,
				targetNodeId,
				targetInputId,
			}) => {
				const errResult = (msg: string) => ({
					success: false as const,
					connectionId: "",
					inputId: "",
					error: msg,
				});

				// Acquire per-workspace lock to prevent parallel add_connection
				// calls from clobbering each other's changes in wsCache
				const release = await acquireLock(workspaceId);
				try {
					// Read from cache (instant, no S3 consistency issues)
					const workspace = await getWorkspaceCached(workspaceId);

					const sourceNode = workspace.nodes.find(
						(n) => n.id === sourceNodeId,
					);
					const targetNode = workspace.nodes.find(
						(n) => n.id === targetNodeId,
					);

					if (!sourceNode || !targetNode) {
						const nodeIds = workspace.nodes.map((n) => n.id).join(", ");
						console.error(`[add_connection] Node not found. source=${sourceNodeId}, target=${targetNodeId}. Available: ${nodeIds}`);
						return errResult(`Node not found: ${!sourceNode ? sourceNodeId : targetNodeId}. Available nodes: ${nodeIds}`);
					}

					const sourceOutput = sourceNode.outputs.find(
						(o) => o.id === sourceOutputId,
					);
					if (!sourceOutput) {
						const outputIds = sourceNode.outputs.map((o) => `${o.id}(${o.accessor})`).join(", ");
						return errResult(`Output ${sourceOutputId} not found on node ${sourceNodeId}. Available: ${outputIds}`);
					}

					// Find or create input on target node
					// Prefer using pre-defined input ports (e.g. Merge's input1/input2)
					// over creating new ones with auto-derived accessor names
					let actualInputId = targetInputId;
					if (!actualInputId) {
						const connectedInputIds = new Set(
							workspace.connections
								.filter((c) => c.inputNode.id === targetNode.id)
								.map((c) => c.inputId),
						);
						const unusedInput = targetNode.inputs.find(
							(inp) => !connectedInputIds.has(inp.id),
						);

						if (unusedInput) {
							actualInputId = unusedInput.id;
						} else {
							const newInputId = InputId.generate();
							const newInput = {
								id: newInputId,
								label: sourceNode.name ?? "Input",
								accessor: sourceNode.name?.toLowerCase().replace(/\s+/g, "-") ?? "input",
							};
							targetNode.inputs.push(newInput);
							actualInputId = newInputId;
						}
					}

					// Self-loop check
					if (sourceNodeId === targetNodeId) {
						return errResult("Cannot connect a node to itself.");
					}

					// Cycle detection (BFS)
					const visited = new Set<string>();
					const queue = [targetNodeId];
					while (queue.length > 0) {
						const current = queue.pop()!;
						if (current === sourceNodeId) {
							return errResult(
								`Cycle detected: connecting ${sourceNode.name ?? sourceNodeId} → ${targetNode.name ?? targetNodeId} would create a loop.`,
							);
						}
						if (visited.has(current)) continue;
						visited.add(current);
						for (const conn of workspace.connections) {
							if (conn.outputNode.id === current) {
								queue.push(conn.inputNode.id);
							}
						}
					}

					// Semantic validation (same rules as UI drag-to-connect)
					// Flow control nodes (if, switch, merge, loop, code, filter, etc.) are not
					// known by isSupportedConnection, so we skip validation for them rather
					// than silently swallowing all exceptions.
					const FLOW_CONTROL_TYPES = new Set([
						"if", "switch", "merge", "loop", "code", "filter",
						"editFields", "sort", "wait", "errorTrigger", "aggregate",
						"summarize", "limit", "removeDuplicates", "renameKeys",
						"splitOut", "compareDatasets", "executeSubWorkflow",
						"respondToWebhook", "customVariables", "dataTable", "formTrigger",
					]);
					const sourceIsFlowControl = FLOW_CONTROL_TYPES.has(sourceNode.content.type);
					const targetIsFlowControl = FLOW_CONTROL_TYPES.has(targetNode.content.type);

					if (!sourceIsFlowControl && !targetIsFlowControl) {
						try {
							const validationResult = isSupportedConnection(
								sourceNode as unknown as NodeLike,
								targetNode as unknown as NodeLike,
								{ existingConnections: workspace.connections as unknown as Connection[] },
							);
							if (!validationResult.canConnect) {
								return errResult(`Invalid connection: ${validationResult.message}`);
							}
						} catch (validationError) {
							console.warn(`[add_connection] isSupportedConnection threw for ${sourceNode.content.type} → ${targetNode.content.type}:`, validationError);
							// Allow the connection but log the issue
						}
					}

					// Duplicate check (idempotent — return existing connection)
					const existing = workspace.connections.find(
						(c) =>
							c.outputNode.id === sourceNodeId &&
							c.outputId === sourceOutputId &&
							c.inputNode.id === targetNodeId &&
							c.inputId === actualInputId,
					);
					if (existing) {
						return { success: true as const, connectionId: existing.id, inputId: actualInputId!, error: "" };
					}

					const connectionData = {
						id: ConnectionId.generate(),
						outputNode: {
							id: sourceNode.id,
							type: sourceNode.type,
							content: { type: sourceNode.content.type },
						},
						outputId: sourceOutputId,
						inputNode: {
							id: targetNode.id,
							type: targetNode.type,
							content: { type: targetNode.content.type },
						},
						inputId: actualInputId,
					};

					// Validate connection against schema before saving
					const parseResult = Connection.safeParse(connectionData);
					if (!parseResult.success) {
						const issues = JSON.stringify(parseResult.error);
						console.error(`[add_connection] Validation failed: ${issues}`);
						return errResult(`Connection validation failed: ${issues}`);
					}

					workspace.connections.push(parseResult.data);
					await saveWorkspaceCached(workspace);

					return {
						success: true as const,
						connectionId: parseResult.data.id,
						inputId: actualInputId,
						error: "",
					};
				} catch (error) {
					const errMsg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
					console.error(`[add_connection] CAUGHT ERROR: ${errMsg}`);
					return errResult(`Failed to add connection: ${errMsg}`);
				} finally {
					release();
				}
			},
		}),

		set_prompt: tool({
			description:
				"Set the prompt for a textGeneration node. Use {{nodeId:outputId}} to reference connected node outputs.",
			inputSchema: z.object({
				workspaceId: z
					.string()
					.describe("The workspace ID"),
				nodeId: z
					.string()
					.describe("The textGeneration node ID"),
				prompt: z
					.string()
					.describe(
						"The prompt text. Use {{sourceNodeId:sourceOutputId}} to inject data from connected nodes.",
					),
			}),
			execute: async ({ workspaceId, nodeId, prompt }) => {
				const release = await acquireLock(workspaceId);
				try {
					const workspace = await getWorkspaceCached(workspaceId);
					const node = workspace.nodes.find((n) => n.id === nodeId);

					if (!node) {
						return {
							success: false,
							error: `Node ${nodeId} not found`,
						};
					}

					if (node.content.type !== "textGeneration") {
						return {
							success: false,
							error: `Node ${nodeId} is not a textGeneration node (type: ${node.content.type})`,
						};
					}

					// Validate that all {{nodeId:outputId}} references point to connected nodes
					// and that the referenced outputId actually exists on the source node
					const connectedNodeIds = new Set(
						workspace.connections
							.filter((c) => c.inputNode.id === nodeId)
							.map((c) => c.outputNode.id),
					);
					const promptWarnings: string[] = [];
					const validateRefPattern = /\{\{([^:}]+):([^}]+)\}\}/g;
					let validateMatch: RegExpExecArray | null;
					validateMatch = validateRefPattern.exec(prompt);
					while (validateMatch !== null) {
						const refNodeId = validateMatch[1] as string;
						const refOutputId = validateMatch[2] as string;
						const refNode = workspace.nodes.find((n) => (n.id as string) === refNodeId);
						const refName = refNode?.name ?? refNodeId;
						const targetName = node.name ?? nodeId;

						if (!refNode) {
							promptWarnings.push(`Reference {{${refNodeId}:${refOutputId}}} in prompt for "${targetName}" points to node "${refNodeId}" which does NOT exist. Check the node ID.`);
						} else if (!connectedNodeIds.has(refNodeId as `nd-${string}`)) {
							promptWarnings.push(`Reference {{${refNodeId}:${refOutputId}}} in prompt for "${targetName}" points to node "${refName}" which is NOT connected to "${targetName}". Add a connection first, or this reference will be empty at runtime.`);
						} else {
							// Verify outputId exists on the referenced node
							const outputExists = refNode.outputs.some((o) => (o.id as string) === refOutputId);
							if (!outputExists) {
								const validOutputs = refNode.outputs.map((o) => o.id).join(", ");
								promptWarnings.push(`Reference {{${refNodeId}:${refOutputId}}} in prompt for "${targetName}" uses outputId "${refOutputId}" which does NOT exist on node "${refName}". Valid outputs: ${validOutputs}`);
							}
						}
						validateMatch = validateRefPattern.exec(prompt);
					}

					// Convert plain text prompt with {{nodeId:outputId}} references
					// into TipTap JSON document format
					const paragraphs = prompt.split("\n").map((line) => {
						const inlineContent: unknown[] = [];
						const refPattern = /\{\{([^:}]+):([^}]+)\}\}/g;
						let lastIndex = 0;
						let match: RegExpExecArray | null;

						match = refPattern.exec(line);
						while (match !== null) {
							// Add text before the reference
							if (match.index > lastIndex) {
								inlineContent.push({
									type: "text",
									text: line.slice(lastIndex, match.index),
								});
							}

							// Look up the referenced node to get its type and content type
							const refNodeId = match[1];
							const refOutputId = match[2];
							const refNode = workspace.nodes.find(
								(n) => n.id === refNodeId,
							);

							if (refNode) {
								inlineContent.push({
									type: "Source",
									attrs: {
										node: {
											id: refNode.id,
											type: refNode.type,
											content: { type: refNode.content.type },
										},
										outputId: refOutputId,
									},
								});
							} else {
								// Node not found, keep as plain text
								inlineContent.push({
									type: "text",
									text: match[0],
								});
							}

							lastIndex = match.index + match[0].length;
							match = refPattern.exec(line);
						}

						// Add remaining text after last reference
						if (lastIndex < line.length) {
							inlineContent.push({
								type: "text",
								text: line.slice(lastIndex),
							});
						}

						// Return paragraph node (empty paragraph if line was empty)
						if (inlineContent.length === 0) {
							return { type: "paragraph" };
						}
						return { type: "paragraph", content: inlineContent };
					});

					const tiptapDoc = JSON.stringify({
						type: "doc",
						content: paragraphs,
					});

					(node.content as { type: "textGeneration"; prompt?: string }).prompt = tiptapDoc;

					await saveWorkspaceCached(workspace);

					return {
						success: true,
						nodeId,
						prompt,
						warnings: promptWarnings,
						error: promptWarnings.length > 0
							? `Prompt was set, but ${promptWarnings.length} warning(s) found: ${promptWarnings.join(" | ")}`
							: "",
					};
				} catch (error) {
					console.error("set_prompt error:", error);
					return {
						success: false,
						error: `Failed to set prompt: ${String(error)}`,
					};
				} finally {
					release();
				}
			},
		}),

		lookup_piece_actions: tool({
			description:
				"Look up available action names for an Activepieces integration piece. Call this BEFORE creating an integration node for any piece NOT listed in the Popular Integrations section of your instructions. Returns the valid actionName values you can use with add_node.",
			inputSchema: z.object({
				pieceName: z
					.string()
					.describe(
						"The piece name to look up (e.g. 'mongodb', 'elevenlabs', 'bamboohr')",
					),
			}),
			execute: async ({ pieceName }) => {
				try {
					const { inspectPiece } = await import(
						"@vibexe-ai/activepieces-adapter/server"
					);
					const info = await inspectPiece(pieceName);
					return {
						success: true,
						pieceName: info.name,
						displayName: info.displayName,
						actions: info.actions.map((a) => ({
							name: a.name,
							displayName: a.displayName,
							description: a.description,
						})),
						authType: info.auth?.type ?? "none",
						error: "",
					};
				} catch (error) {
					return {
						success: false,
						pieceName,
						displayName: "",
						actions: [],
						authType: "",
						error: `Failed to look up piece "${pieceName}": ${String(error)}`,
					};
				}
			},
		}),

		configure_node: tool({
			description:
				"Configure a flow control node's settings. Use this AFTER add_node to set If conditions, Switch rules, Loop mode, Code scripts, Filter conditions, EditFields operations, or Sort keys. Only provide the fields relevant to the node type.",
			inputSchema: z.object({
				workspaceId: z.string().describe("The workspace ID"),
				nodeId: z.string().describe("The node ID to configure"),
				// If / Filter conditions
				conditions: z
					.object({
						conditions: z.array(
							z.object({
								field: z.string().describe("Field path to evaluate, e.g. 'sentiment', 'user.age', 'status'"),
								operator: z
									.enum([
										"equals", "notEquals", "contains", "notContains",
										"greaterThan", "lessThan", "greaterThanOrEqual", "lessThanOrEqual",
										"isEmpty", "isNotEmpty", "isTrue", "isFalse",
										"regex", "startsWith", "endsWith",
									])
									.describe("Comparison operator"),
								value: z.string().optional().describe("Comparison value (not needed for isEmpty/isNotEmpty/isTrue/isFalse)"),
							}),
						),
						combineWith: z.enum(["and", "or"]).default("and").describe("How to combine multiple conditions"),
					})
					.optional()
					.describe("Conditions for If or Filter nodes"),
				// Switch rules
				switchRules: z
					.array(
						z.object({
							name: z.string().describe("Rule name, e.g. 'Positive', 'Negative', 'Neutral'"),
							conditions: z.array(
								z.object({
									field: z.string(),
									operator: z.enum([
										"equals", "notEquals", "contains", "notContains",
										"greaterThan", "lessThan", "greaterThanOrEqual", "lessThanOrEqual",
										"isEmpty", "isNotEmpty", "isTrue", "isFalse",
										"regex", "startsWith", "endsWith",
									]),
									value: z.string().optional(),
								}),
							),
							combineWith: z.enum(["and", "or"]).default("and"),
						}),
					)
					.optional()
					.describe("Rules for Switch nodes (evaluated in order, first match wins)"),
				// Loop config
				loopMode: z
					.enum(["forEach", "nTimes"])
					.optional()
					.describe("Loop mode: forEach iterates array items, nTimes repeats N times"),
				maxIterations: z
					.number()
					.optional()
					.describe("Max iterations safety limit (default 100)"),
				nTimes: z
					.number()
					.optional()
					.describe("Number of repetitions for nTimes mode"),
				// Code node
				code: z
					.string()
					.optional()
					.describe("JavaScript code for Code nodes. Available: items (array), data (object), $input, $json, JSON, Math, Date. Must return a value."),
				codeTimeout: z
					.number()
					.optional()
					.describe("Code execution timeout in ms (default 10000)"),
				// EditFields operations
				fieldOperations: z
					.array(
						z.object({
							operation: z.enum(["set", "remove", "rename"]).describe("Operation type"),
							fieldName: z.string().describe("Target field name"),
							value: z.string().optional().describe("Value for 'set' operation. Use {{field}} for interpolation."),
							newFieldName: z.string().optional().describe("New name for 'rename' operation"),
						}),
					)
					.optional()
					.describe("Field operations for EditFields nodes"),
				keepOnlySet: z
					.boolean()
					.optional()
					.describe("EditFields: if true, output only explicitly set fields (drop all others)"),
				// Sort keys
				sortKeys: z
					.array(
						z.object({
							field: z.string().describe("Field path to sort by"),
							direction: z.enum(["asc", "desc"]).default("asc"),
						}),
					)
					.optional()
					.describe("Sort keys for Sort nodes (applied in order for multi-level sorting)"),
			}),
			execute: async (params) => {
				const release = await acquireLock(params.workspaceId);
				try {
					const workspace = await getWorkspaceCached(params.workspaceId);
					const node = workspace.nodes.find((n) => n.id === params.nodeId);
					if (!node) {
						return { success: false, error: `Node ${params.nodeId} not found` };
					}

					const content = node.content as Record<string, unknown>;
					const nodeType = content.type as string;

					switch (nodeType) {
						case "if": {
							if (!params.conditions) {
								return { success: false, error: "If nodes require 'conditions' parameter" };
							}
							content.conditionGroup = {
								conditions: params.conditions.conditions,
								combineWith: params.conditions.combineWith ?? "and",
							};
							break;
						}
						case "switch": {
							if (!params.switchRules || params.switchRules.length === 0) {
								return { success: false, error: "Switch nodes require at least one rule in 'switchRules' array" };
							}
							content.rules = params.switchRules.map((rule, i) => ({
								name: rule.name,
								conditionGroup: {
									conditions: rule.conditions,
									combineWith: rule.combineWith ?? "and",
								},
								outputPortName: `rule_${i}`,
							}));
							content.mode = "rules";
							content.hasFallback = true;
							break;
						}
						case "loop": {
							if (params.loopMode) content.mode = params.loopMode;
							if (params.loopMode === "nTimes" && params.nTimes === undefined) {
								return { success: false, error: "Loop mode 'nTimes' requires the 'nTimes' parameter" };
							}
							if (params.maxIterations !== undefined) content.maxIterations = params.maxIterations;
							if (params.nTimes !== undefined) content.nTimes = params.nTimes;
							break;
						}
						case "code": {
							if (!params.code || params.code.trim() === "") {
								return { success: false, error: "Code nodes require a non-empty 'code' parameter with valid JavaScript" };
							}
							content.code = params.code;
							if (params.codeTimeout !== undefined) content.timeout = params.codeTimeout;
							content.language = "javascript";
							break;
						}
						case "filter": {
							if (!params.conditions) {
								return { success: false, error: "Filter nodes require 'conditions' parameter" };
							}
							content.conditionGroup = {
								conditions: params.conditions.conditions,
								combineWith: params.conditions.combineWith ?? "and",
							};
							break;
						}
						case "editFields": {
							if (params.fieldOperations) content.operations = params.fieldOperations;
							if (params.keepOnlySet !== undefined) content.keepOnlySet = params.keepOnlySet;
							break;
						}
						case "sort": {
							if (!params.sortKeys || params.sortKeys.length === 0) {
								return { success: false, error: "Sort nodes require at least one key in 'sortKeys' array" };
							}
							content.sortKeys = params.sortKeys;
							break;
						}
						default:
							return {
								success: false,
								error: `configure_node does not support node type "${nodeType}". Supported: if, switch, loop, code, filter, editFields, sort.`,
							};
					}

					await saveWorkspaceCached(workspace);

					return {
						success: true,
						nodeId: params.nodeId,
						nodeType,
						configured: Object.keys(params).filter((k) => k !== "workspaceId" && k !== "nodeId" && params[k as keyof typeof params] !== undefined),
						error: "",
					};
				} catch (error) {
					console.error("configure_node error:", error);
					return { success: false, error: `Failed to configure node: ${String(error)}` };
				} finally {
					release();
				}
			},
		}),

		finalize_workflow: tool({
			description:
				"Mark the workflow as complete and return the link to open it in the editor. Validates that all textGeneration nodes have prompts, the End node has incoming connections, and no nodes are orphaned. Returns warnings if issues are found — fix them before finalizing.",
			inputSchema: z.object({
				workspaceId: z.string().describe("The workspace ID"),
				summary: z
					.string()
					.describe("A brief summary of what the workflow does"),
			}),
			execute: async ({ workspaceId, summary }) => {
				try {
					const workspace = await getWorkspaceCached(workspaceId);
					const warnings: string[] = [];

					// Check Start (appEntry) node exists
					const startNode = workspace.nodes.find((n) => n.content.type === "appEntry");
					if (!startNode) {
						warnings.push(`MISSING START NODE: No Start (appEntry) node found. Add one with add_node({ type: "appEntry" }).`);
					}

					// Check every textGeneration/contentGeneration node has a non-empty prompt
					for (const node of workspace.nodes) {
						if (node.content.type === "textGeneration") {
							const content = node.content as { type: "textGeneration"; prompt?: string };
							if (!content.prompt || content.prompt === "" || content.prompt === '{"type":"doc","content":[{"type":"paragraph"}]}') {
								warnings.push(`EMPTY PROMPT: Node "${node.name ?? node.id}" (textGeneration) has no prompt set. Use set_prompt to fix this.`);
							}
						}
						if (node.content.type === "contentGeneration") {
							const content = node.content as { type: "contentGeneration"; prompt?: string };
							if (!content.prompt || content.prompt === "" || content.prompt === '{"type":"doc","content":[{"type":"paragraph"}]}') {
								warnings.push(`EMPTY PROMPT: Node "${node.name ?? node.id}" (contentGeneration) has no prompt. Use set_prompt.`);
							}
						}
					}

					// Check End node has incoming connections
					const endNode = workspace.nodes.find((n) => n.content.type === "end");
					if (endNode) {
						const endConnections = workspace.connections.filter(
							(c) => c.inputNode.id === endNode.id,
						);
						if (endConnections.length === 0) {
							warnings.push(`DISCONNECTED END: The End node has no incoming connections. Connect the final processing node's output to End.`);
						}
					} else {
						warnings.push(`MISSING END NODE: No End node found. Add one with add_node({ type: "end" }).`);
					}

					// Node types that legitimately have only outgoing (source-like)
					const SOURCE_TYPES = new Set([
						"appEntry", "end", "errorTrigger", "formTrigger",
						"customVariables", "trigger", "dataTable",
					]);

					// Node types that legitimately have only incoming (terminal-like)
					const TERMINAL_TYPES = new Set([
						"end", "errorTrigger", "customVariables",
						"respondToWebhook", "dataStore", "vectorStore",
					]);

					// Check for orphan nodes (no connections at all)
					for (const node of workspace.nodes) {
						if (SOURCE_TYPES.has(node.content.type)) continue;
						const hasOutgoing = workspace.connections.some((c) => c.outputNode.id === node.id);
						const hasIncoming = workspace.connections.some((c) => c.inputNode.id === node.id);
						if (!hasOutgoing && !hasIncoming) {
							warnings.push(`ORPHAN NODE: Node "${node.name ?? node.id}" has no connections at all. It will be ignored at runtime.`);
						}
					}

					// Check for dead-end nodes (receive input but output goes nowhere)
					for (const node of workspace.nodes) {
						if (TERMINAL_TYPES.has(node.content.type)) continue;
						const hasIncoming = workspace.connections.some((c) => c.inputNode.id === node.id);
						const hasOutgoing = workspace.connections.some((c) => c.outputNode.id === node.id);
						if (hasIncoming && !hasOutgoing) {
							warnings.push(`DEAD END: Node "${node.name ?? node.id}" receives input but output goes nowhere.`);
						}
					}

					// Check integration nodes have incoming connections
					for (const node of workspace.nodes) {
						if (node.content.type === "integration") {
							const hasIncoming = workspace.connections.some((c) => c.inputNode.id === node.id);
							if (!hasIncoming) {
								warnings.push(`DISCONNECTED INTEGRATION: Node "${node.name ?? node.id}" (integration) has no incoming connections. Connect a processing node's output to it.`);
							}
						}
					}

					// Check flow control nodes are configured (not just defaults)
					for (const node of workspace.nodes) {
						const c = node.content as Record<string, unknown>;
						const name = (node as { name?: string }).name ?? node.id;
						if (c.type === "if" || c.type === "filter") {
							const cg = c.conditionGroup as { conditions?: unknown[] } | undefined;
							if (!cg?.conditions || cg.conditions.length === 0) {
								warnings.push(`UNCONFIGURED: Node "${name}" (${c.type}) has no conditions set. Use configure_node to set conditions.`);
							}
						}
						if (c.type === "switch") {
							const rules = c.rules as Array<{ conditionGroup?: { conditions?: unknown[] } }> | undefined;
							const hasEmptyRules = !rules || rules.every((r) => !r.conditionGroup?.conditions || r.conditionGroup.conditions.length === 0);
							if (hasEmptyRules) {
								warnings.push(`UNCONFIGURED: Node "${name}" (switch) has no rules configured. Use configure_node to set switchRules.`);
							}
						}
						if (c.type === "sort") {
							const keys = c.sortKeys as unknown[] | undefined;
							if (!keys || keys.length === 0) {
								warnings.push(`UNCONFIGURED: Node "${name}" (sort) has no sort keys. Use configure_node to set sortKeys.`);
							}
						}
					}

					if (warnings.length > 0) {
						return {
							success: false,
							url: "",
							summary: "",
							workspaceId,
							warnings,
							error: `Found ${warnings.length} issue(s). Fix them and call finalize_workflow again.`,
						};
					}

					// Clear cache for this workspace since building is done
					wsCache.delete(workspaceId);
					return {
						success: true,
						url: `/workflows/${workspaceId}`,
						summary,
						workspaceId,
						warnings: [] as string[],
						error: "",
					};
				} catch (error) {
					console.error("finalize_workflow error:", error);
					return {
						success: false,
						url: "",
						summary: "",
						workspaceId,
						warnings: [] as string[],
						error: `Failed to finalize workflow: ${String(error)}`,
					};
				}
			},
		}),
	};
}
