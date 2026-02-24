import type { GenerationId } from "@vibexe-ai/protocol";
import {
	CancelledGeneration,
	CompletedGeneration,
	FailedGeneration,
	type Generation,
	RunningGeneration,
} from "@vibexe-ai/protocol";
import { z } from "zod/v4";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_BACKOFF_INTERVAL = 5000; // Cap at 5 seconds

const exponentialBackoff = (interval: number) => {
	return Math.min(interval * 2, MAX_BACKOFF_INTERVAL);
};

type GenerationFetcher = (
	generationId: GenerationId,
) => Promise<Generation | undefined>;

interface RequestOptions {
	initialInterval?: number;
	maxAttempts?: number;
}
async function waitAndGetGenerationStatus(
	fetcher: GenerationFetcher,
	generationId: GenerationId,
	status: Array<z.infer<typeof Generation>["status"]>,
	{ initialInterval = 500, maxAttempts = 60 }: RequestOptions = {},
) {
	let currentInterval = initialInterval;
	let attempts = 0;

	while (attempts < maxAttempts) {
		const generation = await fetcher(generationId);

		if (generation !== undefined && status.includes(generation.status)) {
			return generation;
		}

		// Wait for the current interval
		await wait(currentInterval);

		// Increase the interval exponentially
		currentInterval = exponentialBackoff(currentInterval);
		attempts++;
	}

	console.warn(
		`[generation-poll] Polling timed out after ${maxAttempts} attempts for generation ${generationId}. ` +
		`The generation may still complete server-side.`,
	);
	// Return the last known state instead of throwing — the generation may
	// still be running server-side and will complete eventually.
	return await fetcher(generationId);
}

export async function waitAndGetGenerationCompleted(
	fetcher: GenerationFetcher,
	generationId: GenerationId,
	requestOptions?: RequestOptions,
) {
	const generation = await waitAndGetGenerationStatus(
		fetcher,
		generationId,
		["completed"],
		requestOptions,
	);
	if (generation === undefined) return undefined;
	return CompletedGeneration.parse(generation);
}

export async function waitAndGetGenerationRunning(
	fetcher: GenerationFetcher,
	generationId: GenerationId,
	requestOptions?: RequestOptions,
) {
	const generation = await waitAndGetGenerationStatus(
		fetcher,
		generationId,
		["running", "completed", "failed", "cancelled"],
		requestOptions,
	);
	if (generation === undefined) return undefined;
	return z
		.union([
			RunningGeneration,
			CompletedGeneration,
			FailedGeneration,
			CancelledGeneration,
		])
		.parse(generation);
}

export async function waitAndGetGenerationFailed(
	fetcher: GenerationFetcher,
	generationId: GenerationId,
	requestOptions?: RequestOptions,
) {
	const failedGeneration = await waitAndGetGenerationStatus(
		fetcher,
		generationId,
		["failed"],
		requestOptions,
	);
	if (failedGeneration === undefined) return undefined;
	return FailedGeneration.parse(failedGeneration);
}

export function arrayEquals(a: unknown, b: unknown) {
	return (
		Array.isArray(a) &&
		Array.isArray(b) &&
		a.length === b.length &&
		a.every((val, index) => val === b[index])
	);
}
