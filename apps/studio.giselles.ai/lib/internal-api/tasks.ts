"use server";

import type { CreateTaskInputs, StartTaskInputs } from "@giselles-ai/giselle";
import type { TaskId, WorkspaceId } from "@giselles-ai/protocol";
import { giselle } from "@/app/giselle";

export async function createTask(input: CreateTaskInputs) {
	return await giselle.createTask(input);
}

export async function startTask(input: StartTaskInputs) {
	await giselle.startTask(input);
}

export async function getWorkspaceInprogressTask(input: {
	workspaceId: WorkspaceId;
}) {
	const task = await giselle.getWorkspaceInprogressTask(input);
	return { task };
}

export async function getTaskGenerationIndexes(input: { taskId: TaskId }) {
	return await giselle.getTaskGenerationIndexes(input);
}

export async function getWorkspaceTasks(input: { workspaceId: WorkspaceId }) {
	const tasks = await giselle.getWorkspaceTasks({
		workspaceId: input.workspaceId,
	});
	return { tasks };
}

export async function patchTask(input: {
	taskId: string;
	patches: Array<{ path: string; set: unknown }>;
}) {
	return await giselle.patchTask({
		taskId: input.taskId as TaskId,
		patches: input.patches,
	});
}

export async function retryTask(input: { taskId: string }) {
	return await giselle.retryTask({ taskId: input.taskId as TaskId });
}
