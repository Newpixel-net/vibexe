"use server";

import type {
	Generation,
	GenerationId,
	GenerationOrigin,
	NodeId,
	QueuedGeneration,
	RunningGeneration,
} from "@vibexe-ai/protocol";
import { vibexe } from "@/app/vibexe";

export async function getGeneration(input: { generationId: GenerationId }) {
	return await vibexe.getGeneration(input.generationId);
}

export async function getNodeGenerations(input: {
	origin: GenerationOrigin;
	nodeId: NodeId;
}) {
	return await vibexe.getNodeGenerations(input.origin, input.nodeId);
}

export async function cancelGeneration(input: { generationId: GenerationId }) {
	return await vibexe.cancelGeneration(input.generationId);
}

export async function setGeneration(input: { generation: Generation }) {
	await vibexe.setGeneration(input.generation);
}

export async function generateImage(input: { generation: QueuedGeneration }) {
	await vibexe.generateImage(input.generation);
}

export async function startContentGeneration(input: {
	generation: Generation;
}) {
	const generation = await vibexe.startContentGeneration(input);
	return { generation };
}

export async function getGenerationMessageChunks(input: {
	generationId: GenerationId;
	startByte?: number;
}) {
	return await vibexe.getGenerationMessageChunks({
		generationId: input.generationId,
		startByte: input.startByte,
	});
}

export async function generateContent(input: {
	generation: RunningGeneration;
}) {
	const generation = await vibexe.generateContent({
		generation: input.generation,
	});
	return { generation };
}
