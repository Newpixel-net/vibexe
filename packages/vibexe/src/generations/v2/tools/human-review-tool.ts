/**
 * Human Review Tool — pauses the AI Agent for human approval before proceeding.
 *
 * When the AI calls this tool, it returns a JSON marker that is detected by
 * onStepFinish in generate-content.ts. The generation transitions to
 * `awaiting_review` status. The user sees a review dialog and can approve/reject.
 */

import type { ToolSet } from "ai";
import { tool as defineTool } from "ai";
import z from "zod/v4";
import type { GenerationId } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../../../types";

/**
 * Build a human review tool that the AI model can call to request approval.
 */
export function buildHumanReviewTool({
	toolName,
	description,
	generationId,
	logger,
}: {
	toolName: string;
	description: string;
	generationId: GenerationId;
	context: VibexeContext;
	logger: VibexeContext["logger"];
}): ToolSet {
	const safeName = toolName.replace(/\s+/g, "_").toLowerCase();

	return {
		[safeName]: defineTool({
			description,
			inputSchema: z.object({
				action: z
					.string()
					.describe("The action the AI wants to take"),
				reason: z
					.string()
					.describe("Why this action needs human approval"),
				details: z
					.record(z.string(), z.any())
					.optional()
					.describe(
						"Additional context about the proposed action",
					),
			}),
			execute: async ({
				action,
				reason,
				details,
			}: {
				action: string;
				reason: string;
				details?: Record<string, unknown>;
			}) => {
				logger.info(
					{ action, reason, generationId },
					"Human review requested by AI",
				);

				// Return a JSON marker that onStepFinish will detect
				return JSON.stringify({
					__human_review_requested__: true,
					action,
					reason,
					details: details ?? {},
					generationId,
				});
			},
		}),
	};
}
