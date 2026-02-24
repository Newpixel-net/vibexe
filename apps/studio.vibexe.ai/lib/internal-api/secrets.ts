"use server";

import type { SecretId, WorkspaceId } from "@vibexe-ai/protocol";
import { Secret } from "@vibexe-ai/protocol";
import { vibexe, storage } from "@/app/vibexe";
import { getCurrentUser } from "@/lib/get-current-user";
import { getWorkspaceTeam } from "@/lib/workspaces/get-workspace-team";
import { isMemberOfTeam } from "@/services/teams";

function secretPath(secretId: SecretId) {
	return `secrets/${secretId}/secret.json`;
}

async function assertWorkspaceAccess(workspaceId: WorkspaceId) {
	const [currentUser, workspaceTeam] = await Promise.all([
		getCurrentUser(),
		getWorkspaceTeam(workspaceId),
	]);
	const isMember = await isMemberOfTeam(currentUser.dbId, workspaceTeam.dbId);
	if (!isMember) {
		throw new Error("Not authorized to access this workspace");
	}
}

async function getSecret(secretId: SecretId) {
	return await storage.getJson({
		path: secretPath(secretId),
		schema: Secret,
	});
}

/**
 * vibexe.addSecret allows optional workspaceId, but this API expects a workspace
 * to always exist for its use cases. If it's missing, we cannot verify ownership,
 * so we fail fast. This differs from vibexe.addSecret's input type, but matches
 * the intended usage here.
 */
export async function addSecret(
	input: Parameters<typeof vibexe.addSecret>[0],
) {
	if (input.workspaceId === undefined) {
		throw new Error("Workspace ID is required");
	}
	await assertWorkspaceAccess(input.workspaceId);
	return { secret: await vibexe.addSecret(input) };
}

export async function deleteSecret(
	input: Parameters<typeof vibexe.deleteSecret>[0],
) {
	const secret = await getSecret(input.secretId);
	if (!secret.workspaceId) {
		throw new Error("Secret is not associated with a workspace");
	}
	await assertWorkspaceAccess(secret.workspaceId);
	await vibexe.deleteSecret(input);
}

export async function getWorkspaceSecrets(input: {
	workspaceId: WorkspaceId;
	tags?: string[];
}) {
	await assertWorkspaceAccess(input.workspaceId);
	return { secrets: await vibexe.getWorkspaceSecrets(input) };
}
