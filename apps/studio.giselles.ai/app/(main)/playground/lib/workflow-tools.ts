import { createId } from "@paralleldrive/cuid2";
import { nodeFactories } from "@giselles-ai/node-registry";
import {
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
					});
					await db.insert(workspaces).values({
						id: workspace.id,
						creatorDbId: user.dbId,
						teamDbId: team.dbId,
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
				"Connect two nodes by linking a source output to a target input. If the target node has no matching input, one will be created automatically.",
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
					const workspace = await giselle.getWorkspace(
						workspaceId as WorkspaceId,
					);

					const sourceNode = workspace.nodes.find(
						(n) => n.id === sourceNodeId,
					);
					const targetNode = workspace.nodes.find(
						(n) => n.id === targetNodeId,
					);

					if (!sourceNode || !targetNode) {
						return errResult(`Node not found: ${!sourceNode ? sourceNodeId : targetNodeId}`);
					}

					const sourceOutput = sourceNode.outputs.find(
						(o) => o.id === sourceOutputId,
					);
					if (!sourceOutput) {
						return errResult(`Output ${sourceOutputId} not found on node ${sourceNodeId}`);
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

					const connection = {
						id: ConnectionId.generate(),
						outputNode: {
							id: sourceNode.id,
							type: sourceNode.type,
						},
						outputId: sourceOutputId,
						inputNode: {
							id: targetNode.id,
							type: targetNode.type,
						},
						inputId: actualInputId,
					} as Workspace["connections"][number];

					workspace.connections.push(connection);
					await giselle.updateWorkspace(workspace);

					return {
						success: true as const,
						connectionId: connection.id,
						inputId: actualInputId,
						error: "",
					};
				} catch (error) {
					console.error("add_connection error:", error);
					return errResult(`Failed to add connection: ${String(error)}`);
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
					url: `/workspaces/${workspaceId}`,
					summary,
					workspaceId,
				};
			},
		}),
	};
}
