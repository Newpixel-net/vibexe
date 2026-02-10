import {
	type Generation,
	isQueuedGeneration,
	type RunningGeneration,
} from "@giselles-ai/protocol";
import type { GiselleContext } from "../types";
import { generateContent } from "./generate-content";
import { internalSetGeneration } from "./internal/set-generation";
import type {
	GenerationMetadata,
	OnGenerationComplete,
	OnGenerationError,
} from "./types";

export async function startContentGeneration({
	context,
	generation,
	metadata,
	onComplete,
	onError,
}: {
	context: GiselleContext;
	generation: Generation;
	metadata?: GenerationMetadata;
	onComplete?: OnGenerationComplete;
	onError?: OnGenerationError;
}) {
	console.error(
		`[DEBUG-GEN] startContentGeneration called: id=${generation.id} status=${generation.status} provider=${(generation as any).context?.operationNode?.content?.llm?.provider ?? "unknown"}`,
	);
	if (!isQueuedGeneration(generation)) {
		console.error(
			`[DEBUG-GEN] Generation ${generation.id} is NOT queued (status=${generation.status})`,
		);
		throw new Error(`Generation ${generation.id} is not queued`);
	}
	const runningGeneration: RunningGeneration = {
		...generation,
		status: "running",
		messages: [],
		startedAt: Date.now(),
	};
	try {
		await internalSetGeneration({
			storage: context.storage,
			generation: runningGeneration,
		});
		console.error(
			`[DEBUG-GEN] internalSetGeneration succeeded for ${generation.id}`,
		);
	} catch (err) {
		console.error(
			`[DEBUG-GEN] internalSetGeneration FAILED for ${generation.id}:`,
			err,
		);
		throw err;
	}
	switch (context.generateContentProcess.type) {
		case "self":
			console.error(
				`[DEBUG-GEN] dispatching to waitUntil (self) for ${generation.id}`,
			);
			context.waitUntil(async () =>
				generateContent({
					context,
					generation: runningGeneration,
					onComplete,
					onError,
				}),
			);
			break;

		case "external":
			console.error(
				`[DEBUG-GEN] dispatching to external process for ${generation.id}`,
			);
			await context.generateContentProcess.process({
				context,
				generation: runningGeneration,
				metadata,
			});
			break;
	}
	console.error(
		`[DEBUG-GEN] startContentGeneration completed for ${generation.id}`,
	);
	return runningGeneration;
}
