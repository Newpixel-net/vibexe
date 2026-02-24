"use client";

import type { Vibexe } from "@vibexe-ai/vibexe";
import type {
	FileId,
	Generation,
	GenerationId,
	GenerationOrigin,
	NodeGenerationIndex,
	NodeId,
	QueuedGeneration,
	Task,
	Workspace,
	WorkspaceId,
} from "@vibexe-ai/protocol";

export interface VibexeClient {
	// bootstrap (used in playground home)
	createWorkspace: Vibexe["createWorkspace"];
	createSampleWorkspaces: Vibexe["createSampleWorkspaces"];

	// workspaces
	getWorkspace(input: {
		workspaceId: WorkspaceId;
	}): ReturnType<Vibexe["getWorkspace"]>;
	updateWorkspace(input: {
		workspace: Workspace;
	}): ReturnType<Vibexe["updateWorkspace"]>;

	// apps
	getApp(
		input: Parameters<Vibexe["getApp"]>[0],
	): Promise<{ app: Awaited<ReturnType<Vibexe["getApp"]>> }>;
	saveApp(input: Parameters<Vibexe["saveApp"]>[0]): Promise<void>;
	deleteApp(input: Parameters<Vibexe["deleteApp"]>[0]): Promise<void>;

	// tasks
	createTask: Vibexe["createTask"];
	startTask(input: Parameters<Vibexe["startTask"]>[0]): Promise<void>;
	getWorkspaceInprogressTask(
		input: Parameters<Vibexe["getWorkspaceInprogressTask"]>[0],
	): Promise<{ task: Task | undefined }>;
	getTaskGenerationIndexes(
		input: Parameters<Vibexe["getTaskGenerationIndexes"]>[0],
	): Promise<{ task: Task; generationIndexes?: NodeGenerationIndex[] }>;
	getWorkspaceTasks(input: {
		workspaceId: WorkspaceId;
	}): Promise<{ tasks: Task[] }>;
	patchTask(input: {
		taskId: string;
		patches: Array<{ path: string; set: unknown }>;
	}): Promise<Task>;
	retryTask(input: {
		taskId: string;
	}): Promise<{ taskId: string; task: Task }>;
	// streamTask omitted (not currently used in Studio editor UI)

	// generations
	getGeneration(input: {
		generationId: GenerationId;
	}): ReturnType<Vibexe["getGeneration"]>;
	getNodeGenerations(input: {
		origin: GenerationOrigin;
		nodeId: NodeId;
	}): ReturnType<Vibexe["getNodeGenerations"]>;
	cancelGeneration(input: {
		generationId: GenerationId;
	}): ReturnType<Vibexe["cancelGeneration"]>;
	setGeneration(input: { generation: Generation }): Promise<void>;
	generateImage(input: { generation: QueuedGeneration }): Promise<void>;
	startContentGeneration(
		input: Parameters<Vibexe["startContentGeneration"]>[0],
	): Promise<{
		generation: Awaited<ReturnType<Vibexe["startContentGeneration"]>>;
	}>;
	getGenerationMessageChunks(
		input: Omit<
			Parameters<Vibexe["getGenerationMessageChunks"]>[0],
			"abortSignal"
		>,
	): ReturnType<Vibexe["getGenerationMessageChunks"]>;
	generateContent(
		input: Parameters<Vibexe["generateContent"]>[0],
	): Promise<{ generation: Awaited<ReturnType<Vibexe["generateContent"]>> }>;

	// triggers + ops
	resolveTrigger(
		input: Parameters<Vibexe["resolveTrigger"]>[0],
	): Promise<{ trigger: Awaited<ReturnType<Vibexe["resolveTrigger"]>> }>;
	configureTrigger(
		input: Parameters<Vibexe["configureTrigger"]>[0],
	): Promise<{ triggerId: Awaited<ReturnType<Vibexe["configureTrigger"]>> }>;
	getTrigger(
		input: Parameters<Vibexe["getTrigger"]>[0],
	): Promise<{ trigger: Awaited<ReturnType<Vibexe["getTrigger"]>> }>;
	setTrigger(
		input: Parameters<Vibexe["setTrigger"]>[0],
	): Promise<{ triggerId: Awaited<ReturnType<Vibexe["setTrigger"]>> }>;
	reconfigureGitHubTrigger(
		input: Parameters<Vibexe["reconfigureGitHubTrigger"]>[0],
	): Promise<{
		triggerId: Awaited<ReturnType<Vibexe["reconfigureGitHubTrigger"]>>;
	}>;
	executeAction(input: Parameters<Vibexe["executeAction"]>[0]): Promise<void>;
	executeIntegration(input: {
		generation: QueuedGeneration;
	}): Promise<void>;
	executeQuery(input: { generation: QueuedGeneration }): Promise<void>;
	executeDataQuery(input: { generation: QueuedGeneration }): Promise<void>;
	getGitHubRepositoryFullname(
		input: Parameters<Vibexe["getGitHubRepositoryFullname"]>[0],
	): Promise<{
		fullname: Awaited<ReturnType<Vibexe["getGitHubRepositoryFullname"]>>;
	}>;

	// files
	uploadFile(formData: FormData): Promise<void>;
	removeFile(input: {
		workspaceId: WorkspaceId;
		fileId: FileId;
	}): Promise<void>;
	copyFile(input: {
		workspaceId: WorkspaceId;
		sourceFileId: FileId;
		destinationFileId: FileId;
	}): Promise<void>;
	getFileText(
		input: Parameters<Vibexe["getFileText"]>[0],
	): Promise<{ text: Awaited<ReturnType<Vibexe["getFileText"]>> }>;
	addWebPage(
		input: Parameters<Vibexe["addWebPage"]>[0],
	): ReturnType<Vibexe["addWebPage"]>;

	// secrets
	addSecret(
		input: Parameters<Vibexe["addSecret"]>[0],
	): Promise<{ secret: Awaited<ReturnType<Vibexe["addSecret"]>> }>;
	deleteSecret(input: Parameters<Vibexe["deleteSecret"]>[0]): Promise<void>;
	getWorkspaceSecrets(
		input: Parameters<Vibexe["getWorkspaceSecrets"]>[0],
	): Promise<{ secrets: Awaited<ReturnType<Vibexe["getWorkspaceSecrets"]>> }>;

	// data stores
	createDataStore(input: Parameters<Vibexe["createDataStore"]>[0]): Promise<{
		dataStore: Awaited<ReturnType<Vibexe["createDataStore"]>>;
	}>;
	getDataStore(input: Parameters<Vibexe["getDataStore"]>[0]): Promise<{
		dataStore: Awaited<ReturnType<Vibexe["getDataStore"]>>;
	}>;
	updateDataStore(input: Parameters<Vibexe["updateDataStore"]>[0]): Promise<{
		dataStore: Awaited<ReturnType<Vibexe["updateDataStore"]>>;
	}>;
	deleteDataStore(input: Parameters<Vibexe["deleteDataStore"]>[0]): Promise<{
		dataStore: Awaited<ReturnType<Vibexe["deleteDataStore"]>>;
	}>;
}
