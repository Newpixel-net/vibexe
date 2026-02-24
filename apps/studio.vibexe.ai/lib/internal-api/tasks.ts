"use server";

import type { CreateTaskInputs, StartTaskInputs } from "@vibexe-ai/vibexe";
import type { TaskId, WorkspaceId } from "@vibexe-ai/protocol";
import { vibexe } from "@/app/vibexe";

export async function createTask(input: CreateTaskInputs) {
	return await vibexe.createTask(input);
}

export async function startTask(input: StartTaskInputs) {
	await vibexe.startTask(input);
}

export async function getWorkspaceInprogressTask(input: {
	workspaceId: WorkspaceId;
}) {
	const task = await vibexe.getWorkspaceInprogressTask(input);
	return { task };
}

export async function getTaskGenerationIndexes(input: { taskId: TaskId }) {
	return await vibexe.getTaskGenerationIndexes(input);
}

export async function getWorkspaceTasks(input: { workspaceId: WorkspaceId }) {
	const tasks = await vibexe.getWorkspaceTasks({
		workspaceId: input.workspaceId,
	});
	return { tasks };
}

export async function patchTask(input: {
	taskId: string;
	patches: Array<{ path: string; set: unknown }>;
}) {
	return await vibexe.patchTask({
		taskId: input.taskId as TaskId,
		patches: input.patches,
	});
}

export async function retryTask(input: { taskId: string }) {
	return await vibexe.retryTask({ taskId: input.taskId as TaskId });
}
