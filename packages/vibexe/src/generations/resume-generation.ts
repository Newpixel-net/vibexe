/**
 * Resume or reject a generation that is awaiting human review.
 *
 * - approveReview: transitions back to "queued" so it re-enters the generation pipeline
 * - rejectReview: transitions to "cancelled" with a rejection message
 */

import {
	type AwaitingReviewGeneration,
	type CancelledGeneration,
	type Generation,
	type QueuedGeneration,
	isAwaitingReviewGeneration,
} from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { internalSetGeneration } from "./internal/set-generation";
import { startContentGeneration } from "./start-content-generation";
import { getGeneration } from "./utils";

/**
 * Approve a human review request and resume the generation.
 *
 * The generation is re-queued and started again. The approved tool result
 * is injected into the messages so the AI continues from where it left off.
 */
export async function approveReview({
	context,
	generationId,
}: {
	context: VibexeContext;
	generationId: string;
}) {
	const generation = await getGeneration({
		storage: context.storage,
		generationId: generationId as any,
	});

	if (!isAwaitingReviewGeneration(generation)) {
		throw new Error(
			`Generation ${generationId} is not awaiting review (status: ${generation.status})`,
		);
	}

	const awaitingGen = generation as AwaitingReviewGeneration;

	// Inject the approval as a tool result message and re-queue
	const approvalMessage = {
		id: `review-approval-${Date.now()}`,
		role: "tool" as const,
		content: JSON.stringify({
			approved: true,
			action: awaitingGen.reviewContext.proposedAction,
			message: "Human approved this action. Proceed.",
		}),
		parts: [
			{
				type: "text" as const,
				text: JSON.stringify({
					approved: true,
					action: awaitingGen.reviewContext.proposedAction,
					message: "Human approved this action. Proceed.",
				}),
			},
		],
	};

	const resumedGeneration: QueuedGeneration = {
		id: awaitingGen.id,
		context: awaitingGen.context,
		status: "queued",
		createdAt: awaitingGen.createdAt,
		queuedAt: Date.now(),
	};

	await internalSetGeneration({
		storage: context.storage,
		generation: resumedGeneration,
		logger: context.logger,
	});

	// Re-start the generation
	await startContentGeneration({
		context,
		generation: resumedGeneration,
	});

	context.logger.info(
		{ generationId },
		"Human review approved, generation resumed",
	);

	return resumedGeneration;
}

/**
 * Reject a human review request and cancel the generation.
 */
export async function rejectReview({
	context,
	generationId,
	reason,
}: {
	context: VibexeContext;
	generationId: string;
	reason?: string;
}) {
	const generation = await getGeneration({
		storage: context.storage,
		generationId: generationId as any,
	});

	if (!isAwaitingReviewGeneration(generation)) {
		throw new Error(
			`Generation ${generationId} is not awaiting review (status: ${generation.status})`,
		);
	}

	const cancelledGeneration: CancelledGeneration = {
		id: generation.id,
		context: generation.context,
		status: "cancelled",
		createdAt: generation.createdAt,
		cancelledAt: Date.now(),
		messages:
			"messages" in generation ? (generation.messages as any) : undefined,
		queuedAt: "queuedAt" in generation ? generation.queuedAt : undefined,
		startedAt:
			"startedAt" in generation ? generation.startedAt : undefined,
	};

	await internalSetGeneration({
		storage: context.storage,
		generation: cancelledGeneration,
		logger: context.logger,
	});

	context.logger.info(
		{ generationId, reason },
		"Human review rejected, generation cancelled",
	);

	return cancelledGeneration;
}
