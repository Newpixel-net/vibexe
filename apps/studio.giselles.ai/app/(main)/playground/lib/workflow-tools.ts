import { createId } from "@paralleldrive/cuid2";
import { nodeFactories } from "@giselles-ai/node-registry";
import {
	App,
	AppId,
	Connection,
	ConnectionId,
	InputId,
	Workspace,
	type WorkspaceId,
} from "@giselles-ai/protocol";
import { tool } from "ai";
import { z } from "zod";
import { agents, db, workspaces } from "@/db";
import { giselle } from "@/app/giselle";
import { fetchCurrentUser } from "@/services/accounts";
import { fetchCurrentTeam } from "@/services/teams";

type WorkspaceType = z.infer<typeof Workspace>;

export function createWorkflowTools() {
	// In-memory workspace cache to avoid S3 eventual consistency issues.
	// All tools read/write through this cache so add_connection always
	// sees nodes that were just added by add_node.
	const wsCache = new Map<string, WorkspaceType>();

	async function getWorkspaceCached(id: string): Promise<WorkspaceType> {
		const cached = wsCache.get(id);
		if (cached) return cached;
		const ws = await giselle.getWorkspace(id as WorkspaceId);
		wsCache.set(id, ws);
		return ws;
	}

	async function saveWorkspaceCached(ws: WorkspaceType): Promise<void> {
		wsCache.set(ws.id, ws);
		await giselle.updateWorkspace(ws);
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

					const workspace = await giselle.createWorkspace();

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
					])
					.describe("The node type to add"),
				name: z.string().describe("Display name for the node"),
				llmProvider: z
					.enum(["openai", "anthropic", "google", "perplexity", "xai"])
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
							node = nodeFactories.create("integration", {
								pieceName,
								actionName,
								pieceVersion: pieceVersion ?? "0.0.0",
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
								await giselle.saveApp({ app: parseResult.data });
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
					let actualInputId = targetInputId;
					if (!actualInputId) {
						const newInputId = InputId.generate();
						const newInput = {
							id: newInputId,
							label: sourceNode.name ?? "Input",
							accessor: sourceNode.name?.toLowerCase().replace(/\s+/g, "-") ?? "input",
						};
						targetNode.inputs.push(newInput);
						actualInputId = newInputId;
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
						const refNodeId = validateMatch[1];
						if (!connectedNodeIds.has(refNodeId)) {
							const refNode = workspace.nodes.find((n) => n.id === refNodeId);
							const refName = refNode?.name ?? refNodeId;
							const targetName = node.name ?? nodeId;
							promptWarnings.push(`Reference {{${refNodeId}:${validateMatch[2]}}} in prompt for "${targetName}" points to node "${refName}" which is NOT connected to "${targetName}". Add a connection first, or this reference will be empty at runtime.`);
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
						"@giselles-ai/activepieces-adapter/server"
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

					// Check every textGeneration node has a non-empty prompt
					for (const node of workspace.nodes) {
						if (node.content.type === "textGeneration") {
							const content = node.content as { type: "textGeneration"; prompt?: string };
							if (!content.prompt || content.prompt === "" || content.prompt === '{"type":"doc","content":[{"type":"paragraph"}]}') {
								warnings.push(`EMPTY PROMPT: Node "${node.name ?? node.id}" (textGeneration) has no prompt set. Use set_prompt to fix this.`);
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

					// Check for orphan nodes (no connections at all, except Start which only has outgoing)
					for (const node of workspace.nodes) {
						if (node.content.type === "appEntry" || node.content.type === "end") continue;
						const hasOutgoing = workspace.connections.some((c) => c.outputNode.id === node.id);
						const hasIncoming = workspace.connections.some((c) => c.inputNode.id === node.id);
						if (!hasOutgoing && !hasIncoming) {
							warnings.push(`ORPHAN NODE: Node "${node.name ?? node.id}" has no connections at all. It will be ignored at runtime.`);
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
