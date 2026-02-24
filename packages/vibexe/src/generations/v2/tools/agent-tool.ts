/**
 * Recursive Agent Tool — allows one AI Agent to delegate tasks to another AI Agent node.
 *
 * When the AI model calls this tool, it spawns a nested generation on the target
 * AI Agent and returns its output text.
 */

import type { ToolSet } from "ai";
import { tool as defineTool } from "ai";
import z from "zod/v4";
import {
	GenerationId,
	type GenerationContext as GenerationContextType,
	type QueuedGeneration,
} from "@vibexe-ai/protocol";
import type { VibexeContext } from "../../../types";
import { internalSetGeneration } from "../../internal/set-generation";
import { startContentGeneration } from "../../start-content-generation";
import { getGeneration } from "../../utils";

/**
 * Build a tool that delegates a task to another AI Agent node in the workflow.
 */
export function buildAgentTool({
	targetAgentNodeId,
	context,
	generationContext,
	logger,
}: {
	targetAgentNodeId: string;
	context: VibexeContext;
	generationContext: GenerationContextType;
	logger: VibexeContext["logger"];
}): ToolSet {
	const targetNode = generationContext.sourceNodes.find(
		(n) => n.id === targetAgentNodeId,
	);

	if (!targetNode) {
		logger.warn(
			{ targetAgentNodeId },
			"Agent tool: target AI Agent node not found in source nodes",
		);
		return {};
	}

	const toolName = `delegate_to_${targetNode.name?.replace(/\s+/g, "_").toLowerCase() || targetAgentNodeId}`;

	return {
		[toolName]: defineTool({
			description: `Delegate a task to AI Agent "${targetNode.name || targetAgentNodeId}". Send a task description and receive the agent's response.`,
			inputSchema: z.object({
				task: z
					.string()
					.describe("The task or question to send to the agent"),
			}),
			execute: async ({ task }: { task: string }) => {
				try {
					// Create a queued generation for the target agent
					const nestedGenerationId = GenerationId.generate();
					const now = Date.now();

					// Build a minimal generation context with the target node as operation node
					const nestedGeneration: QueuedGeneration = {
						id: nestedGenerationId,
						context: {
							operationNode: targetNode as any,
							connections: generationContext.connections,
							sourceNodes: generationContext.sourceNodes,
							origin: generationContext.origin,
						},
						status: "queued",
						createdAt: now,
						queuedAt: now,
					};

					// Store the generation
					await internalSetGeneration({
						storage: context.storage,
						generation: nestedGeneration,
						logger,
					});

					// Start the generation (transitions to running and executes)
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
							// Extract text output
							if ("outputs" in currentGen) {
								const textOutput = currentGen.outputs.find(
									(o) => o.type === "generated-text",
								);
								if (textOutput && "content" in textOutput) {
									return String(textOutput.content);
								}
							}
							// Fallback: try to get text from messages
							if ("messages" in currentGen && currentGen.messages) {
								const assistantMessages = currentGen.messages.filter(
									(m: { role: string }) => m.role === "assistant",
								);
								const lastMsg =
									assistantMessages[assistantMessages.length - 1];
								if (lastMsg && "parts" in lastMsg) {
									const textParts = (lastMsg.parts as any[])
										?.filter((p) => p.type === "text")
										.map((p) => p.text);
									if (textParts?.length) {
										return textParts.join("\n");
									}
								}
							}
							return "Agent completed but produced no text output.";
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
								message: `Delegated agent failed: ${errorMsg}`,
							});
						}
					}

					return JSON.stringify({
						error: true,
						message:
							"Delegated agent timed out after 5 minutes",
					});
				} catch (error) {
					const msg =
						error instanceof Error ? error.message : String(error);
					logger.error(
						{ error: msg, targetAgentNodeId },
						"Agent tool execution failed",
					);
					return JSON.stringify({
						error: true,
						message: `Failed to delegate to agent: ${msg}`,
					});
				}
			},
		}),
	};
}
