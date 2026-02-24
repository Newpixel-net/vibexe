"use server";

import { DataQueryError } from "@vibexe-ai/vibexe";
import type {
	QueuedGeneration,
	Trigger,
	TriggerId,
} from "@vibexe-ai/protocol";
import { vibexe } from "@/app/vibexe";

export async function resolveTrigger(input: { generation: QueuedGeneration }) {
	return { trigger: await vibexe.resolveTrigger(input) };
}

export async function configureTrigger(
	input: Parameters<typeof vibexe.configureTrigger>[0],
) {
	return { triggerId: await vibexe.configureTrigger(input) };
}

export async function getTrigger(input: { triggerId: TriggerId }) {
	return { trigger: await vibexe.getTrigger(input) };
}

export async function setTrigger(input: { trigger: Trigger }) {
	return { triggerId: await vibexe.setTrigger(input) };
}

export async function reconfigureGitHubTrigger(
	input: Parameters<typeof vibexe.reconfigureGitHubTrigger>[0],
) {
	return { triggerId: await vibexe.reconfigureGitHubTrigger(input) };
}

export async function executeAction(input: { generation: QueuedGeneration }) {
	await vibexe.executeAction(input);
}

export async function executeIntegration(input: {
	generation: QueuedGeneration;
}) {
	await vibexe.executeIntegration(input);
}

export async function executeQuery(input: { generation: QueuedGeneration }) {
	await vibexe.executeQuery(input.generation);
}

export async function executeDataQuery(input: {
	generation: QueuedGeneration;
}) {
	try {
		await vibexe.executeDataQuery(input.generation);
	} catch (error) {
		if (error instanceof DataQueryError) {
			// User-caused errors (SQL syntax, connection issues, etc.) should not go to Sentry.
			// The generation status is already persisted as "failed" by execute-data-query.ts.
			return;
		}
		throw error;
	}
}

export async function getGitHubRepositoryFullname(
	input: Parameters<typeof vibexe.getGitHubRepositoryFullname>[0],
) {
	return { fullname: await vibexe.getGitHubRepositoryFullname(input) };
}
