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

export function createWorkflowTools() {
	return {
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
					await giselle.updateWorkspace(parsedWorkspace);

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
					])
					.describe("The node type to add"),
				name: z.string().describe("Display name for the node"),
				llmProvider: z
					.enum(["openai", "anthropic", "google", "perplexity"])
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
				position,
			}) => {
				const errResult = (msg: string) => ({
					success: false as const,
					nodeId: "",
					outputs: [] as { outputId: string; accessor: string; label: string }[],
					inputs: [] as { inputId: string; accessor: string; label: string }[],
					error: msg,
				});

				try {
					const workspace = await giselle.getWorkspace(
						workspaceId as WorkspaceId,
					);

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
									topK: 50,
								},
								google: {
									temperature: 0.7,
									topP: 1.0,
									topK: 50,
									searchGrounding: false,
								},
								perplexity: {
									temperature: 0.7,
									topP: 1.0,
								},
							};
							node = nodeFactories.create("textGeneration", {
								provider: llmProvider,
								id: llmModelId,
								configurations: defaultConfigs[llmProvider] ?? {},
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

					await giselle.updateWorkspace(workspace);

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
								await giselle.updateWorkspace(workspace);
							} else {
								console.error("[add_node] App.safeParse failed:", JSON.stringify(parseResult.error));
							}
						} catch (configError) {
							console.error("Auto-configure appEntry warning:", configError);
							// Non-fatal: workflow still works, just Run dialog won't show inputs
						}
					}

					return {
						success: true as const,
						nodeId: node.id,
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
					console.log(`[add_connection] START: ${sourceNodeId}(${sourceOutputId}) -> ${targetNodeId}`);

					// Retry loop to handle S3 eventual consistency - nodes may not be visible immediately
					let workspace;
					let sourceNode;
					let targetNode;
					const maxRetries = 5;
					for (let attempt = 0; attempt < maxRetries; attempt++) {
						// Increasing delay: 500ms, 1000ms, 1500ms, 2000ms, 2500ms
						await new Promise((r) => setTimeout(r, 500 + attempt * 500));

						workspace = await giselle.getWorkspace(
							workspaceId as WorkspaceId,
						);

						console.log(`[add_connection] Attempt ${attempt + 1}: ${workspace.nodes.length} nodes, ${workspace.connections.length} connections`);

						sourceNode = workspace.nodes.find(
							(n) => n.id === sourceNodeId,
						);
						targetNode = workspace.nodes.find(
							(n) => n.id === targetNodeId,
						);

						if (sourceNode && targetNode) break;

						if (attempt < maxRetries - 1) {
							console.log(`[add_connection] Nodes not yet visible, retrying...`);
						}
					}

					if (!workspace || !sourceNode || !targetNode) {
						const nodeIds = workspace?.nodes.map((n) => n.id).join(", ") ?? "none";
						console.error(`[add_connection] Node not found after ${maxRetries} retries. source=${sourceNodeId}, target=${targetNodeId}. Available: ${nodeIds}`);
						return errResult(`Node not found: ${!sourceNode ? sourceNodeId : targetNodeId}. Available nodes: ${nodeIds}`);
					}

					const sourceOutput = sourceNode.outputs.find(
						(o) => o.id === sourceOutputId,
					);
					if (!sourceOutput) {
						const outputIds = sourceNode.outputs.map((o) => `${o.id}(${o.accessor})`).join(", ");
						console.error(`[add_connection] Output not found: ${sourceOutputId} on ${sourceNodeId}. Available: ${outputIds}`);
						return errResult(`Output ${sourceOutputId} not found on node ${sourceNodeId}. Available: ${outputIds}`);
					}

					// Find or create input on target node
					let actualInputId = targetInputId;
					if (!actualInputId) {
						// Create a new input on the target node
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
						console.error(`[add_connection] Data: ${JSON.stringify(connectionData)}`);
						return errResult(`Connection validation failed: ${issues}`);
					}

					workspace.connections.push(parseResult.data);
					await giselle.updateWorkspace(workspace);

					console.log(`[add_connection] SUCCESS: ${parseResult.data.id}`);

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
					// Retry loop to handle S3 eventual consistency
					let workspace;
					let node;
					for (let attempt = 0; attempt < 3; attempt++) {
						await new Promise((r) => setTimeout(r, 500 + attempt * 500));
						workspace = await giselle.getWorkspace(
							workspaceId as WorkspaceId,
						);
						node = workspace.nodes.find((n) => n.id === nodeId);
						if (node) break;
					}

					if (!workspace || !node) {
						return {
							success: false,
							error: `Node ${nodeId} not found after retries`,
						};
					}

					if (node.content.type !== "textGeneration") {
						return {
							success: false,
							error: `Node ${nodeId} is not a textGeneration node (type: ${node.content.type})`,
						};
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

					await giselle.updateWorkspace(workspace);

					return {
						success: true,
						nodeId,
						prompt,
						error: "",
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

		finalize_workflow: tool({
			description:
				"Mark the workflow as complete and return the link to open it in the editor",
			inputSchema: z.object({
				workspaceId: z.string().describe("The workspace ID"),
				summary: z
					.string()
					.describe("A brief summary of what the workflow does"),
			}),
			execute: async ({ workspaceId, summary }) => {
				return {
					success: true,
					url: `/workflows/${workspaceId}`,
					summary,
					workspaceId,
				};
			},
		}),
	};
}
