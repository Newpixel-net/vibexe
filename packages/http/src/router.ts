import {
	ConfigureTriggerInput,
	CreateAndStartTaskInputs,
	CreateTaskInputs,
	type Vibexe,
	type Patch,
	StartTaskInputs,
} from "@vibexe-ai/vibexe";
import {
	DataStore,
	DataStoreId,
	FetchingWebPage,
	FileId,
	Generation,
	GenerationId,
	GenerationOrigin,
	GitHubEventData,
	NodeId,
	QueuedGeneration,
	RunningGeneration,
	SecretId,
	TaskId,
	Trigger,
	TriggerId,
	Workspace,
	WorkspaceId,
} from "@vibexe-ai/protocol";
import * as z from "zod/v4";
import { createHandler, withUsageLimitErrorHandler } from "./create-handler";
import { JsonResponse } from "./json-response";

export const jsonRoutes = {
	createWorkspace: (vibexe: Vibexe) =>
		createHandler({
			handler: async () => {
				const workspace = await vibexe.createWorkspace();
				return JsonResponse.json(workspace);
			},
		}),
	getWorkspace: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				workspaceId: WorkspaceId.schema,
			}),
			handler: async ({ input }) => {
				const workspace = await vibexe.getWorkspace(input.workspaceId);
				return JsonResponse.json(workspace);
			},
		}),

	updateWorkspace: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				workspace: Workspace,
			}),
			handler: async ({ input }) => {
				const workspace = await vibexe.updateWorkspace(input.workspace);
				return JsonResponse.json(workspace);
			},
		}),
	getLanguageModelProviders: (vibexe: Vibexe) =>
		createHandler({
			handler: () => {
				const providers = vibexe.getLanguageModelProviders();
				return JsonResponse.json(providers);
			},
		}),
	getGeneration: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				generationId: GenerationId.schema,
			}),
			handler: async ({ input }) => {
				const generation = await vibexe.getGeneration(input.generationId);
				return JsonResponse.json(generation);
			},
		}),
	getNodeGenerations: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				origin: GenerationOrigin,
				nodeId: NodeId.schema,
			}),
			handler: async ({ input }) => {
				const generations = await vibexe.getNodeGenerations(
					input.origin,
					input.nodeId,
				);
				return JsonResponse.json(generations);
			},
		}),
	cancelGeneration: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				generationId: GenerationId.schema,
			}),
			handler: async ({ input }) => {
				const generation = await vibexe.cancelGeneration(input.generationId);
				return JsonResponse.json(generation);
			},
		}),
	removeFile: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				workspaceId: WorkspaceId.schema,
				fileId: FileId.schema,
			}),
			handler: async ({ input }) => {
				await vibexe.removeFile(input.workspaceId, input.fileId);
				return new Response(null, { status: 204 });
			},
		}),
	copyFile: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				workspaceId: WorkspaceId.schema,
				sourceFileId: FileId.schema,
				destinationFileId: FileId.schema,
			}),
			handler: async ({ input }) => {
				await vibexe.copyFile(
					input.workspaceId,
					input.sourceFileId,
					input.destinationFileId,
				);

				return new Response(null, { status: 204 });
			},
		}),
	generateImage: (vibexe: Vibexe) =>
		withUsageLimitErrorHandler(
			createHandler({
				input: z.object({
					generation: QueuedGeneration,
				}),
				handler: async ({ input, signal }) => {
					await vibexe.generateImage(input.generation, signal);
					return new Response(null, { status: 204 });
				},
			}),
		),
	setGeneration: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				generation: Generation,
			}),
			handler: async ({ input }) => {
				await vibexe.setGeneration(input.generation);
				return new Response(null, { status: 204 });
			},
		}),
	createSampleWorkspaces: (vibexe: Vibexe) =>
		createHandler({
			handler: async () => {
				const workspaces = await vibexe.createSampleWorkspaces();
				return JsonResponse.json(workspaces);
			},
		}),
	getGitHubRepositories: (vibexe: Vibexe) =>
		createHandler({
			handler: async () => {
				const repositories = await vibexe.getGitHubRepositories();
				return JsonResponse.json(repositories);
			},
		}),
	encryptSecret: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({ plaintext: z.string() }),
			handler: async ({ input }) => {
				return JsonResponse.json({
					encrypted: await vibexe.encryptSecret(input.plaintext),
				});
			},
		}),
	resolveTrigger: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				generation: QueuedGeneration,
			}),
			handler: async ({ input }) => {
				return JsonResponse.json({
					trigger: await vibexe.resolveTrigger(input),
				});
			},
		}),
	configureTrigger: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				trigger: ConfigureTriggerInput,
			}),
			handler: async ({ input }) => {
				return JsonResponse.json({
					triggerId: await vibexe.configureTrigger(input),
				});
			},
		}),
	getTrigger: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				triggerId: TriggerId.schema,
			}),
			handler: async ({ input }) => {
				return JsonResponse.json({
					trigger: await vibexe.getTrigger(input),
				});
			},
		}),
	getGitHubRepositoryFullname: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				repositoryNodeId: z.string(),
				installationId: z.number(),
			}),
			handler: async ({ input }) => {
				return JsonResponse.json({
					fullname: await vibexe.getGitHubRepositoryFullname(input),
				});
			},
		}),
	setTrigger: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				trigger: Trigger,
			}),
			handler: async ({ input }) => {
				return JsonResponse.json({
					triggerId: await vibexe.setTrigger(input),
				});
			},
		}),
	reconfigureGitHubTrigger: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				triggerId: TriggerId.schema,
				repositoryNodeId: z.string(),
				installationId: z.number(),
				event: GitHubEventData.optional(),
			}),
			handler: async ({ input }) => {
				return JsonResponse.json({
					triggerId: await vibexe.reconfigureGitHubTrigger(input),
				});
			},
		}),
	deleteTrigger: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				triggerId: TriggerId.schema,
			}),
			handler: async ({ input }) => {
				await vibexe.deleteTrigger(input);
				return new Response(null, { status: 204 });
			},
		}),
	executeAction: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				generation: QueuedGeneration,
			}),
			handler: async ({ input }) => {
				await vibexe.executeAction(input);
				return new Response(null, { status: 204 });
			},
		}),
	createAndStartTask: (vibexe: Vibexe) =>
		createHandler({
			input: CreateAndStartTaskInputs.omit({ callbacks: true }),
			handler: async ({ input }) => {
				await vibexe.createAndStartTask(input);
				return new Response(null, { status: 204 });
			},
		}),
	startTask: (vibexe: Vibexe) =>
		createHandler({
			input: StartTaskInputs,
			handler: async ({ input }) => {
				await vibexe.startTask(input);
				return new Response(null, { status: 204 });
			},
		}),
	executeQuery: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				generation: QueuedGeneration,
			}),
			handler: async ({ input }) => {
				await vibexe.executeQuery(input.generation);
				return new Response(null, { status: 204 });
			},
		}),
	executeDataQuery: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				generation: QueuedGeneration,
			}),
			handler: async ({ input }) => {
				await vibexe.executeDataQuery(input.generation);
				return new Response(null, { status: 204 });
			},
		}),
	addWebPage: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				webpage: FetchingWebPage,
				workspaceId: WorkspaceId.schema,
			}),
			handler: async ({ input }) =>
				JsonResponse.json(await vibexe.addWebPage(input)),
		}),
	getFileText: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				workspaceId: WorkspaceId.schema,
				fileId: FileId.schema,
			}),
			handler: async ({ input }) =>
				JsonResponse.json({
					text: await vibexe.getFileText({
						workspaceId: input.workspaceId,
						fileId: input.fileId,
					}),
				}),
		}),
	addSecret: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				workspaceId: WorkspaceId.schema.optional(),
				label: z.string(),
				value: z.string(),
				tags: z.array(z.string()).optional(),
			}),
			handler: async ({ input }) =>
				JsonResponse.json({
					secret: await vibexe.addSecret(input),
				}),
		}),
	getWorkspaceSecrets: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				workspaceId: WorkspaceId.schema,
				tags: z.array(z.string()).optional(),
			}),
			handler: async ({ input }) =>
				JsonResponse.json({
					secrets: await vibexe.getWorkspaceSecrets(input),
				}),
		}),
	createTask: (vibexe: Vibexe) =>
		createHandler({
			input: CreateTaskInputs,
			handler: async ({ input }) =>
				JsonResponse.json(await vibexe.createTask(input)),
		}),
	patchTask: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				taskId: TaskId.schema,
				patches: z.array(z.custom<Patch>()),
			}),
			handler: async ({ input }) =>
				JsonResponse.json({
					task: await vibexe.patchTask(input),
				}),
		}),
	getWorkspaceTasks: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				workspaceId: WorkspaceId.schema,
			}),
			handler: async ({ input }) =>
				JsonResponse.json({
					tasks: await vibexe.getWorkspaceTasks(input),
				}),
		}),
	deleteSecret: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				secretId: SecretId.schema,
			}),
			handler: async ({ input }) => {
				await vibexe.deleteSecret(input);
				return new Response(null, { status: 204 });
			},
		}),
	streamTask: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				taskId: TaskId.schema,
			}),
			handler: ({ input }) => {
				const stream = vibexe.streamTask(input);
				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache, no-transform",
						Connection: "keep-alive",
					},
				});
			},
		}),
	generateContent: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				generation: RunningGeneration,
			}),
			handler: async ({ input }) => {
				const runningGeneration = await vibexe.generateContent({
					...input,
				});
				return JsonResponse.json({ generation: runningGeneration });
			},
		}),
	getGenerationMessageChunks: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				generationId: GenerationId.schema,
				startByte: z.number().optional(),
			}),
			handler: async ({ input, signal: abortSignal }) => {
				const data = await vibexe.getGenerationMessageChunks({
					...input,
					abortSignal,
				});
				return JsonResponse.json(data);
			},
		}),
	startContentGeneration: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				generation: Generation,
			}),
			handler: async ({ input }) => {
				const runningGeneration = await vibexe.startContentGeneration({
					...input,
				});
				return JsonResponse.json({ generation: runningGeneration });
			},
		}),
	getWorkspaceInprogressTask: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				workspaceId: WorkspaceId.schema,
			}),
			handler: async ({ input }) => {
				const task = await vibexe.getWorkspaceInprogressTask({
					workspaceId: input.workspaceId,
				});
				return JsonResponse.json({ task });
			},
		}),
	getTaskGenerationIndexes: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				taskId: TaskId.schema,
			}),
			handler: async ({ input }) => {
				const result = await vibexe.getTaskGenerationIndexes({
					taskId: input.taskId,
				});
				return JsonResponse.json(result);
			},
		}),
	saveApp: (vibexe: Vibexe) =>
		createHandler({
			input: vibexe.saveApp.inputSchema,
			handler: async ({ input }) => {
				await vibexe.saveApp(input);
				return new Response(null, { status: 204 });
			},
		}),
	deleteApp: (vibexe: Vibexe) =>
		createHandler({
			input: vibexe.deleteApp.inputSchema,
			handler: async ({ input }) => {
				await vibexe.deleteApp(input);
				return new Response(null, { status: 204 });
			},
		}),
	getApp: (vibexe: Vibexe) =>
		createHandler({
			input: vibexe.getApp.inputSchema,
			handler: async ({ input }) => {
				const app = await vibexe.getApp(input);
				return JsonResponse.json({ app });
			},
		}),
	createDataStore: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				provider: DataStore.shape.provider,
				configuration: DataStore.shape.configuration,
			}),
			handler: async ({ input }) => {
				const dataStore = await vibexe.createDataStore(input);
				return JsonResponse.json({ dataStore });
			},
		}),
	getDataStore: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				dataStoreId: DataStoreId.schema,
			}),
			handler: async ({ input }) => {
				const dataStore = await vibexe.getDataStore(input);
				if (!dataStore) {
					return JsonResponse.json(
						{ error: `DataStore not found: ${input.dataStoreId}` },
						{ status: 404 },
					);
				}
				return JsonResponse.json({ dataStore });
			},
		}),
	updateDataStore: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				dataStoreId: DataStoreId.schema,
				configuration: DataStore.shape.configuration,
			}),
			handler: async ({ input }) => {
				const dataStore = await vibexe.updateDataStore(input);
				return JsonResponse.json({ dataStore });
			},
		}),
	deleteDataStore: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				dataStoreId: DataStoreId.schema,
			}),
			handler: async ({ input }) => {
				const dataStore = await vibexe.deleteDataStore(input);
				if (!dataStore) {
					// For idempotent DELETE, treat not found as success
					return new Response(null, { status: 204 });
				}
				return JsonResponse.json({ dataStore });
			},
		}),
} as const;

// Export the types at module level
export type JsonRoutePath = keyof typeof jsonRoutes;
export type JsonRouteHandlers = {
	[P in JsonRoutePath]: ReturnType<(typeof jsonRoutes)[P]>;
};
export type JsonRouteHandlersInput = {
	[P in JsonRoutePath]: Parameters<JsonRouteHandlers[P]>[0]["input"];
};
export function isJsonRoutePath(path: string): path is JsonRoutePath {
	return path in jsonRoutes;
}

export const formDataRoutes = {
	uploadFile: (vibexe: Vibexe) =>
		createHandler({
			input: z.object({
				workspaceId: WorkspaceId.schema,
				fileId: FileId.schema,
				fileName: z.string(),
				file: z.instanceof(File),
			}),
			handler: async ({ input }) => {
				await vibexe.uploadFile(
					input.file,
					input.workspaceId,
					input.fileId,
					input.fileName,
				);
				return new Response(null, { status: 202 });
			},
		}),
} as const;

// Export the types at module level
export type FormDataRoutePath = keyof typeof formDataRoutes;
export type FormDataRouteHandlers = {
	[P in FormDataRoutePath]: ReturnType<(typeof formDataRoutes)[P]>;
};
export type FormDataRouteHandlersInput = {
	[P in FormDataRoutePath]: Parameters<FormDataRouteHandlers[P]>[0]["input"];
};
export function isFormDataRoutePath(path: string): path is FormDataRoutePath {
	return path in formDataRoutes;
}
