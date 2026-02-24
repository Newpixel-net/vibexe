/**
 * Sub-Workflow Tool — executes another workspace's workflow as a tool call.
 *
 * When the AI model calls this tool, it loads the target workspace, finds
 * the entry node, creates a generation, and waits for completion.
 */

import type { ToolSet } from "ai";
import { tool as defineTool } from "ai";
import z from "zod/v4";
import {
	GenerationId,
	type QueuedGeneration,
	type WorkspaceId,
} from "@vibexe-ai/protocol";
import type { VibexeContext } from "../../../types";
import { internalSetGeneration } from "../../internal/set-generation";
import { startContentGeneration } from "../../start-content-generation";
import { getGeneration } from "../../utils";

/**
 * Build a tool that executes a sub-workflow (another workspace) and returns its output.
 */
export function buildSubWorkflowTool({
	targetWorkspaceId,
	targetEntryNodeId,
	context,
	logger,
}: {
	targetWorkspaceId: string;
	targetEntryNodeId?: string;
	context: VibexeContext;
	logger: VibexeContext["logger"];
}): ToolSet {
	const toolName = `run_workflow_${targetWorkspaceId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20)}`;

	return {
		[toolName]: defineTool({
			description: `Execute a sub-workflow (workspace ${targetWorkspaceId}). Pass input data and receive the workflow's output.`,
			inputSchema: z.object({
				input: z
					.string()
					.describe("Input data to pass to the sub-workflow"),
			}),
			execute: async ({ input }: { input: string }) => {
				try {
					// Load the target workspace
					const workspacePath = `workspaces/${targetWorkspaceId}/workspace.json`;
					const workspaceExists =
						await context.storage.exists(workspacePath);

					if (!workspaceExists) {
						return JSON.stringify({
							error: true,
							message: `Sub-workflow workspace "${targetWorkspaceId}" not found`,
						});
					}

					const workspaceData = await context.storage.getJson({
						path: workspacePath,
						schema: z.any(),
					});

					// Find the entry node (use specified or find first generation-capable node)
					const nodes = workspaceData.nodes ?? [];
					let entryNode = targetEntryNodeId
						? nodes.find(
								(n: { id: string }) =>
									n.id === targetEntryNodeId,
							)
						: nodes.find(
								(n: { content?: { type: string } }) =>
									n.content?.type === "contentGeneration" ||
									n.content?.type === "aiAgent" ||
									n.content?.type === "textGeneration",
							);

					if (!entryNode) {
						return JSON.stringify({
							error: true,
							message:
								"Sub-workflow has no generation-capable entry node",
						});
					}

					// Create and execute a generation on the target node
					const nestedGenerationId = GenerationId.generate();
					const now = Date.now();

					const nestedGeneration: QueuedGeneration = {
						id: nestedGenerationId,
						context: {
							operationNode: entryNode,
							connections: workspaceData.connections ?? [],
							sourceNodes: nodes,
							origin: {
								type: "studio",
								workspaceId:
									targetWorkspaceId as WorkspaceId,
							},
						},
						status: "queued",
						createdAt: now,
						queuedAt: now,
					};

					await internalSetGeneration({
						storage: context.storage,
						generation: nestedGeneration,
						logger,
					});

					await startContentGeneration({
						context,
						generation: nestedGeneration,
					});

					// Poll for completion (max 5 minutes)
					const maxWaitMs = 5 * 60 * 1000;
					const pollIntervalMs = 1000;
					const startTime = Date.now();

					while (Date.now() - startTime < maxWaitMs) {
						await new Promise((resolve) =>
							setTimeout(resolve, pollIntervalMs),
						);

						const currentGen = await getGeneration({
							storage: context.storage,
							generationId: nestedGenerationId,
						});

						if (currentGen.status === "completed") {
							if ("outputs" in currentGen) {
								const textOutput = currentGen.outputs.find(
									(o) => o.type === "generated-text",
								);
								if (textOutput && "content" in textOutput) {
									return String(textOutput.content);
								}
							}
							if (
								"messages" in currentGen &&
								currentGen.messages
							) {
								const assistantMessages =
									currentGen.messages.filter(
										(m: { role: string }) =>
											m.role === "assistant",
									);
								const lastMsg =
									assistantMessages[
										assistantMessages.length - 1
									];
								if (lastMsg && "parts" in lastMsg) {
									const textParts = (
										lastMsg.parts as any[]
									)
										?.filter((p) => p.type === "text")
										.map((p) => p.text);
									if (textParts?.length) {
										return textParts.join("\n");
									}
								}
							}
							return "Sub-workflow completed but produced no text output.";
						}

						if (
							currentGen.status === "failed" ||
							currentGen.status === "cancelled"
						) {
							const errorMsg =
								"error" in currentGen
									? `${(currentGen as any).error?.name}: ${(currentGen as any).error?.message}`
									: "Unknown error";
							return JSON.stringify({
								error: true,
								message: `Sub-workflow failed: ${errorMsg}`,
							});
						}
					}

					return JSON.stringify({
						error: true,
						message:
							"Sub-workflow timed out after 5 minutes",
					});
				} catch (error) {
					const msg =
						error instanceof Error
							? error.message
							: String(error);
					logger.error(
						{ error: msg, targetWorkspaceId },
						"Sub-workflow tool execution failed",
					);
					return JSON.stringify({
						error: true,
						message: `Failed to execute sub-workflow: ${msg}`,
					});
				}
			},
		}),
	};
}
