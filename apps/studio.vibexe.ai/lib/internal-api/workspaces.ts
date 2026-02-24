"use server";

import type { WorkspaceId } from "@vibexe-ai/protocol";
import { vibexe } from "@/app/vibexe";

export async function createWorkspace() {
	return await vibexe.createWorkspace();
}

export async function createSampleWorkspaces() {
	return await vibexe.createSampleWorkspaces();
}

export async function getWorkspace(input: { workspaceId: WorkspaceId }) {
	return await vibexe.getWorkspace(input.workspaceId);
}

export async function updateWorkspace(input: {
	workspace: Parameters<typeof vibexe.updateWorkspace>[0];
}) {
	return await vibexe.updateWorkspace(input.workspace);
}
