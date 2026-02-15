import type { GiselleLogger } from "@giselles-ai/logger";
import {
	type Connection,
	type Generation,
	type GenerationId,
	type GenerationOutput,
	isCompletedGeneration,
	isFailedGeneration,
	isOperationNode,
	type NodeId,
	type OperationNode,
	type QueuedGeneration,
	type Sequence,
	type Task,
	TaskId,
} from "@giselles-ai/protocol";
import * as z from "zod/v4";
import {
	executeAggregate,
	executeCode,
	executeCompareDatasets,
	executeCustomVariables,
	executeDataTable,
	executeEditFields,
	executeErrorTrigger,
	executeExecuteSubWorkflow,
	executeFilter,
	executeIf,
	executeLimit,
	executeLoop,
	executeMerge,
	executeRemoveDuplicates,
	executeRenameKeys,
	executeRespondToWebhook,
	executeSort,
	executeSplitOut,
	executeSummarize,
	executeSwitch,
	executeWait,
} from "../flow-control";
import { executeCustomNode } from "../flow-control/execute-custom-node";
import {
	type GenerationMetadata,
	generateImage,
	getGeneration,
	type OnGenerationComplete,
	type OnGenerationError,
	setGeneration,
} from "../generations";
import { startContentGeneration } from "../generations/start-content-generation";
import {
	executeAction,
	executeDataQuery,
	executeIntegration,
} from "../operations";
import { executeQuery } from "../operations/execute-query";
import { resolveTrigger } from "../triggers";
import { isJsonContent } from "@giselles-ai/text-editor-utils";
import type { GiselleContext } from "../types";
import {
	type DagNode,
	type DagNodeResult,
	ExecutionDAG,
	executeDag,
} from "./dag-executor";
import { getTask } from "./get-task";
import { patches } from "./object/patch-creators";
import { createPatchQueue } from "./patch-queue";
import { executeTask } from "./shared/task-execution-utils";

async function waitUntilGenerationFinishes(args: {
	context: GiselleContext;
	generationId: GenerationId;
}) {
	const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
	const startTime = Date.now();
	while (Date.now() - startTime < TIMEOUT_MS) {
		const generation = await getGeneration({
			context: args.context,
			generationId: args.generationId,
		});

		if (!generation) {
			throw new Error(`Generation(id: ${args.generationId}) is not found`);
		}

		if (
			generation.status === "completed" ||
			generation.status === "failed" ||
			generation.status === "cancelled"
		) {
			return generation;
		}

		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	throw new Error(
		`Generation(id: ${args.generationId}) timed out after 10 minutes`,
	);
}

export interface RunTaskCallbacks {
	sequenceStart?: (args: { sequence: Sequence }) => void | Promise<void>;
	sequenceFail?: (args: { sequence: Sequence }) => void | Promise<void>;
	sequenceComplete?: (args: { sequence: Sequence }) => void | Promise<void>;
	sequenceSkip?: (args: { sequence: Sequence }) => void | Promise<void>;
	/** Called when the entire task fails — used to trigger error workflows */
	onTaskFailed?: (args: { taskId: string; workspaceId: string; error: string }) => void | Promise<void>;
}

async function executeStep(args: {
	context: GiselleContext;
	generation: QueuedGeneration;
	callbacks?: {
		onCompleted?: () => void | Promise<void>;
		onFailed?: (generation: Generation) => void | Promise<void>;
		onGenerationComplete?: OnGenerationComplete;
		onGenerationError?: OnGenerationError;
	};
	logger?: GiselleLogger;
	metadata?: GenerationMetadata;
}) {
	try {
		// Track whether the case block handled completion callbacks itself
		let handledCompletion = false;

		switch (args.generation.context.operationNode.content.type) {
			case "action":
				await executeAction(args);
				break;
			case "imageGeneration":
				await generateImage({ ...args });
				break;
			case "textGeneration":
			case "contentGeneration":
			case "aiAgent": {
				console.log(`[executeStep] Starting content generation for ${args.generation.context.operationNode.content.type}, genId=${args.generation.id}`);
				await startContentGeneration({
					generation: args.generation,
					context: args.context,
					metadata: args.metadata,
					onComplete: args.callbacks?.onGenerationComplete,
					onError: args.callbacks?.onGenerationError,
				});
				console.log(`[executeStep] startContentGeneration returned, now polling for completion...`);
				const finishedGeneration = await waitUntilGenerationFinishes({
					context: args.context,
					generationId: args.generation.id,
				});
				console.log(`[executeStep] Generation finished with status: ${finishedGeneration.status}`);
				if (isFailedGeneration(finishedGeneration)) {
					await args.callbacks?.onFailed?.(finishedGeneration);
				}
				if (isCompletedGeneration(finishedGeneration)) {
					console.log(`[executeStep] Calling onCompleted callback...`);
					await args.callbacks?.onCompleted?.();
					console.log(`[executeStep] onCompleted callback finished`);
				}
				handledCompletion = true;
				break;
			}
			case "trigger":
				await resolveTrigger({
					context: args.context,
					generation: args.generation,
				});
				break;
			case "query":
				await executeQuery(args);
				break;
			case "dataQuery":
				await executeDataQuery(args);
				break;
			case "integration":
				await executeIntegration(args);
				break;
			case "appEntry":
				break;
			case "end":
			case "chatModel":
			case "toolNode":
			case "memoryNode":
				break;
			// Flow control and data transform nodes — handled by DAG executor.
			// In legacy sequence path they are no-ops.
			case "if":
			case "switch":
			case "merge":
			case "loop":
			case "code":
			case "filter":
			case "editFields":
			case "sort":
			case "wait":
			case "errorTrigger":
			case "dataTable":
			case "formTrigger":
			case "executeSubWorkflow":
			case "respondToWebhook":
			case "customVariables":
			case "aggregate":
			case "summarize":
			case "limit":
			case "removeDuplicates":
			case "renameKeys":
			case "splitOut":
			case "compareDatasets":
				break;
			default: {
				const _exhaustiveCheck: never =
					args.generation.context.operationNode.content.type;
				throw new Error(`Unhandled step type: ${_exhaustiveCheck}`);
			}
		}
		if (!handledCompletion) {
			await args.callbacks?.onCompleted?.();
		}
	} catch (_e) {
		console.error("[executeStep] Error:", _e);
		// Construct a Generation-like object with error details so DAG executor
		// gets the real error message (not just "unknown error")
		const errorMsg = _e instanceof Error ? _e.message : String(_e);
		const failedGeneration = {
			...args.generation,
			status: "failed" as const,
			error: { name: "ExecutionError", message: errorMsg },
		};
		await args.callbacks?.onFailed?.(failedGeneration as Generation);
	}
}

export const RunTaskInputs = z.object({
	taskId: TaskId.schema,
	callbacks: z.optional(z.custom<RunTaskCallbacks>()),
	logger: z.optional(z.custom<GiselleLogger>()),
	metadata: z.optional(z.custom<GenerationMetadata>()),
});
export type RunTaskInputs = z.infer<typeof RunTaskInputs>;

export async function runTask(
	args: RunTaskInputs & {
		context: GiselleContext;
		onGenerationComplete?: OnGenerationComplete;
		onGenerationError?: OnGenerationError;
	},
) {
	const task = await getTask(args);
	console.log(`[runTask] Task ${task.id} loaded, useDagExecution=${task.useDagExecution}, sequences=${task.sequences.length}, status=${task.status}`);

	// Create patch queue for this task execution
	const patchQueue = createPatchQueue(args.context);
	const applyPatches = patchQueue.createApplyPatches();

	// Route to DAG executor or legacy executor
	if (task.useDagExecution) {
		console.log(`[runTask] Entering DAG execution path for task ${task.id}`);
		await runTaskWithDag(args, task, patchQueue);
		return;
	}
	console.log(`[runTask] Using LEGACY execution path for task ${task.id}`);

	let executionError: Error | null = null;
	try {
		await executeTask({
			task,
			applyPatches,
			startGeneration: async (generationId, callbacks) => {
				const generation = await getGeneration({
					context: args.context,
					generationId,
				});
				if (!generation || generation.status !== "created") {
					return;
				}
				const queuedGeneration: QueuedGeneration = {
					...generation,
					status: "queued",
					queuedAt: Date.now(),
				};
				await executeStep({
					context: args.context,
					generation: queuedGeneration,
					callbacks: {
						...callbacks,
						onGenerationComplete: args.onGenerationComplete,
						onGenerationError: args.onGenerationError,
					},
					metadata: args.metadata,
				});
			},
			onSequenceStart: async (sequence) => {
				args.context.logger.debug(
					{ sequence },
					`Starting sequence ${sequence.id}`,
				);
				await args.callbacks?.sequenceStart?.({ sequence });
			},
			onSequenceError: async (sequence) => {
				args.context.logger.error(
					{ sequence },
					`Sequence ${sequence.id} failed`,
				);
				await args.callbacks?.sequenceFail?.({ sequence });
			},
			onSequenceComplete: async (sequence) => {
				args.context.logger.debug(
					{ sequence },
					`Sequence ${sequence.id} completed`,
				);
				await args.callbacks?.sequenceComplete?.({ sequence });
			},
			onSequenceSkip: async (sequence) => {
				args.context.logger.debug(
					{ sequence },
					`Skipping sequence ${sequence.id}`,
				);
				await args.callbacks?.sequenceSkip?.({ sequence });
			},
			onTaskComplete: async () => {
				await patchQueue.flush();
			},
		});
	} catch (error) {
		executionError = error as Error;
	}

	await patchQueue.cleanup();
	if (executionError !== null) {
		// Trigger error workflow callback
		if (args.callbacks?.onTaskFailed) {
			try {
				await args.callbacks.onTaskFailed({
					taskId: task.id,
					workspaceId: task.workspaceId,
					error: executionError.message,
				});
			} catch (e) {
				console.error("Error workflow callback failed:", e);
			}
		}
		console.error("Execution failed:", executionError);
		throw executionError;
	}
}

// ---- DAG Execution Path ----

/**
 * Execute a task using the DAG executor for workflows with flow control nodes.
 * Builds the DAG from task metadata, executes flow control nodes directly,
 * and delegates regular nodes (AI, integration, etc.) to the existing executeStep.
 */
async function runTaskWithDag(
	args: RunTaskInputs & {
		context: GiselleContext;
		onGenerationComplete?: OnGenerationComplete;
		onGenerationError?: OnGenerationError;
	},
	task: Task,
	patchQueue: ReturnType<typeof createPatchQueue>,
) {
	const applyPatches = patchQueue.createApplyPatches();

	// Set task to inProgress
	await applyPatches(task.id, [patches.status.set("inProgress")]);

	console.log(`[runTaskWithDag] Starting DAG build for task ${task.id}`);
	const dag = new ExecutionDAG();
	const nodeGenMap = task.dagNodeGenerationMap ?? {};

	// Build DAG nodes from task sequences/steps
	for (const sequence of task.sequences) {
		for (const step of sequence.steps) {
			const generation = await getGeneration({
				context: args.context,
				generationId: step.generationId,
			});
			if (!generation) continue;

			const opNode = generation.context.operationNode as OperationNode;

			dag.addNode({
				nodeId: opNode.id,
				operationNode: opNode,
				generationId: step.generationId,
				state: "pending",
				retryCount: 0,
				errorConfig: opNode.errorConfig,
			});
		}
	}

	// Build DAG edges from connections stored in generation contexts
	const processedEdges = new Set<string>();
	for (const sequence of task.sequences) {
		for (const step of sequence.steps) {
			const generation = await getGeneration({
				context: args.context,
				generationId: step.generationId,
			});
			if (!generation) continue;

			const opNode = generation.context.operationNode as OperationNode;
			const connections = (generation.context.connections ?? []) as Connection[];

			for (const conn of connections) {
				// Only add edges between operation nodes that are in the DAG
				if (
					dag.nodes.has(conn.outputNode.id as NodeId) &&
					conn.inputNode.id === opNode.id
				) {
					const edgeKey = `${conn.outputNode.id}-${conn.inputNode.id}-${conn.outputId ?? ""}-${conn.inputId ?? ""}`;
					if (!processedEdges.has(edgeKey)) {
						processedEdges.add(edgeKey);

						// Resolve OutputId/InputId to accessor names.
						// Connections store port IDs (otp-xxx, inp-xxx) but the DAG executor
						// compares by accessor names ("true", "false", "data", etc.)
						const sourceNode = dag.nodes.get(conn.outputNode.id as NodeId);
						const outputPort = sourceNode?.operationNode.outputs.find(
							(o) => o.id === conn.outputId,
						);
						const inputPort = opNode.inputs.find(
							(i) => i.id === conn.inputId,
						);

						const resolvedOutputPort = outputPort?.accessor ?? (conn.outputId as string | undefined);
						const resolvedInputPort = inputPort?.accessor ?? (conn.inputId as string | undefined);
						if (!outputPort && conn.outputId) {
							console.warn(
								`[DAG] Port lookup failed: outputId "${conn.outputId}" not found in node ${conn.outputNode.id} outputs. Falling back to raw ID "${resolvedOutputPort}".`,
							);
						}
						dag.addEdge({
							fromNodeId: conn.outputNode.id as NodeId,
							toNodeId: conn.inputNode.id as NodeId,
							fromOutputPort: resolvedOutputPort,
							toInputPort: resolvedInputPort,
							connection: conn,
						});
					}
				}
			}
		}
	}

	const startTime = Date.now();

	// Helper: update a generation from "created" to "completed" so the client UI
	// reflects that the DAG executor has finished processing the node.
	// If dagResult is provided, stores actual data as structured-data outputs
	// so the properties panel can display meaningful content.
	const markGenerationCompleted = async (
		generationId: GenerationId | undefined,
		dagNode?: { operationNode: { outputs: Array<{ id: string; accessor: string }> } },
		dagResult?: { outputs: Map<string, unknown> },
	) => {
		if (!generationId) return;
		const gen = await getGeneration({ context: args.context, generationId });
		if (!gen || gen.status !== "created") return; // already handled by executeStep
		const now = Date.now();

		// Convert DAG result data to generation outputs for UI display
		const outputs: GenerationOutput[] = [];
		if (dagResult && dagNode) {
			const matchedAccessors = new Set<string>();
			for (const port of dagNode.operationNode.outputs) {
				const val = dagResult.outputs.get(port.accessor);
				matchedAccessors.add(port.accessor);
				if (val !== undefined && val !== null) {
					if (typeof val === "string") {
						outputs.push({
							type: "generated-text" as const,
							outputId: port.id as any,
							content: val,
						});
					} else {
						outputs.push({
							type: "structured-data" as const,
							outputId: port.id as any,
							data: val,
						});
					}
				}
			}
			// Extra executor outputs (e.g. "result", "data" from If/Switch) are used
			// internally by the DAG executor for routing but are NOT persisted —
			// their synthetic IDs would fail OutputId schema validation.
		}

		await setGeneration({
			context: args.context,
			generation: {
				...gen,
				status: "completed",
				queuedAt: now,
				startedAt: now,
				completedAt: now,
				messages: [],
				outputs,
			} as Generation,
		});
	};

	console.log(`[runTaskWithDag] DAG built with ${dag.nodes.size} nodes, ${dag.edges.length} edges. Starting executeDag...`);
	for (const [nodeId, node] of dag.nodes) {
		console.log(`[runTaskWithDag]   Node ${nodeId}: type=${node.operationNode.content.type}, genId=${node.generationId}`);
	}

	const result = await executeDag(dag, {
		onNodeStart: async (nodeId) => {
			console.log(`[DAG] Node ${nodeId} starting`);
			args.context.logger.debug(`[DAG] Node ${nodeId} starting`);
		},
		onNodeComplete: async (nodeId, nodeResult) => {
			console.log(`[DAG] Node ${nodeId} completed`);
			args.context.logger.debug(`[DAG] Node ${nodeId} completed`);
			const dagNode = dag.nodes.get(nodeId);
			await markGenerationCompleted(dagNode?.generationId, dagNode, nodeResult);
		},
		onNodeSkipped: async (nodeId) => {
			console.log(`[DAG] Node ${nodeId} skipped`);
			args.context.logger.debug(`[DAG] Node ${nodeId} skipped`);
			const dagNode = dag.nodes.get(nodeId);
			await markGenerationCompleted(dagNode?.generationId);
		},
		onNodeFailed: async (nodeId, error) => {
			args.context.logger.error(
				{ error },
				`[DAG] Node ${nodeId} failed: ${error.message}`,
			);
			// Mark generation as failed so the client shows failure status
			const dagNode = dag.nodes.get(nodeId);
			if (dagNode?.generationId) {
				const gen = await getGeneration({ context: args.context, generationId: dagNode.generationId });
				if (gen && gen.status === "created") {
					const now = Date.now();
					await setGeneration({
						context: args.context,
						generation: {
							...gen,
							status: "failed",
							queuedAt: now,
							startedAt: now,
							failedAt: now,
							messages: [],
							error: { message: error.message, name: error.name },
						} as Generation,
					});
				}
			}
		},
		executeNode: async (
			dagNode: DagNode,
			inputData: Map<string, unknown>,
		): Promise<DagNodeResult> => {
			const nodeType = dagNode.operationNode.content.type;

			// Flow control nodes: execute directly (no generation needed)
			switch (nodeType) {
				case "if":
					return executeIf(dagNode, inputData);
				case "switch":
					return executeSwitch(dagNode, inputData);
				case "merge":
					return executeMerge(dagNode, inputData);
				case "loop":
					return executeLoop(dagNode, inputData);
				case "code":
					return executeCode(dagNode, inputData);
				case "filter":
					return executeFilter(dagNode, inputData);
				case "editFields":
					return executeEditFields(dagNode, inputData);
				case "sort":
					return executeSort(dagNode, inputData);
				case "wait":
					return executeWait(dagNode, inputData, args.context.waitWebhookHelpers);
				case "errorTrigger":
					return executeErrorTrigger(dagNode, inputData);
				case "dataTable":
					return executeDataTable(dagNode, inputData);
				case "formTrigger":
					return { outputs: new Map() };
				case "trigger":
					// Manual/configured triggers are the DAG entry point.
					// Trigger data (if any) is injected as generation inputs by create-task.
					return { outputs: new Map() };
				case "executeSubWorkflow":
					return executeExecuteSubWorkflow(dagNode, inputData, task.workspaceId);
				case "respondToWebhook":
					return executeRespondToWebhook(dagNode, inputData);
				case "customVariables":
					return executeCustomVariables(dagNode, inputData);
				case "aggregate":
					return executeAggregate(dagNode, inputData);
				case "summarize":
					return executeSummarize(dagNode, inputData);
				case "limit":
					return executeLimit(dagNode, inputData);
				case "removeDuplicates":
					return executeRemoveDuplicates(dagNode, inputData);
				case "renameKeys":
					return executeRenameKeys(dagNode, inputData);
				case "splitOut":
					return executeSplitOut(dagNode, inputData);
				case "compareDatasets":
					return executeCompareDatasets(dagNode, inputData);
			}

			// Custom nodes: check if content has customNodeName
			if ((dagNode.operationNode.content as Record<string, unknown>).customNodeName) {
				return executeCustomNode(dagNode, inputData);
			}

			// Regular nodes: delegate to existing executeStep
			if (!dagNode.generationId) {
				throw new Error(`No generationId for node ${dagNode.nodeId}`);
			}

			const generation = await getGeneration({
				context: args.context,
				generationId: dagNode.generationId,
			});
			if (!generation || generation.status !== "created") {
				return { outputs: new Map() };
			}

			// GLITCH #6 FIX: Inject DAG inputData into textGen/aiAgent prompts.
			// When flow control nodes (Switch, Merge, Loop, etc.) pass data to
			// textGen nodes, the data must be injected into the prompt since
			// textGen nodes only resolve explicit {{nodeId:outputId}} references.
			if (inputData.size > 0) {
				const ct = dagNode.operationNode.content.type;
				if (ct === "textGeneration" || ct === "contentGeneration" || ct === "aiAgent") {
					const contextText = stringifyDagInputData(inputData);
					const opContent = generation.context.operationNode.content as Record<string, unknown>;
					const prompt = opContent.prompt as string | undefined;
					if (prompt) {
						if (isJsonContent(prompt)) {
							try {
								const doc = JSON.parse(prompt);
								const contextParagraph = {
									type: "paragraph",
									content: [{ type: "text", text: `[Upstream workflow data]\n${contextText}` }],
								};
								doc.content = [contextParagraph, { type: "paragraph" }, ...doc.content];
								opContent.prompt = JSON.stringify(doc);
							} catch {
								// If JSON parse fails, treat as plain text
								opContent.prompt = `[Upstream workflow data]\n${contextText}\n\n${prompt}`;
							}
						} else {
							opContent.prompt = `[Upstream workflow data]\n${contextText}\n\n${prompt}`;
						}
					}
				}
			}

			const queuedGeneration: QueuedGeneration = {
				...generation,
				status: "queued",
				queuedAt: Date.now(),
			};

			return new Promise<DagNodeResult>((resolve, reject) => {
				executeStep({
					context: args.context,
					generation: queuedGeneration,
					callbacks: {
						onCompleted: async () => {
							// Fetch completed generation to get outputs
							const completed = await getGeneration({
								context: args.context,
								generationId: dagNode.generationId!,
							});
							const outputs = new Map<string, unknown>();
							if (completed && "outputs" in completed) {
								for (const out of (completed as { outputs: GenerationOutput[] }).outputs) {
									// Resolve outputId (otp-xxx) to accessor name for DAG data flow
									const port = dagNode.operationNode.outputs.find(
										(o) => o.id === out.outputId,
									);
									const key = port?.accessor ?? out.outputId;
									if (out.type === "generated-text") {
										outputs.set(key, out.content);
									} else if (out.type === "structured-data") {
										outputs.set(key, (out as { data: unknown }).data);
									} else if (out.type === "data-query-result") {
										outputs.set(key, out.content);
									} else if (out.type === "query-result") {
										outputs.set(key, out.content);
									} else if (out.type === "generated-image") {
										outputs.set(key, out.contents);
									}
								}
							}
							resolve({ outputs });
						},
						onFailed: async (failedGen) => {
							const errMsg = failedGen && "error" in failedGen
								? (failedGen as { error?: { message?: string } }).error?.message ?? "unknown error"
								: "unknown error";
							reject(
								new Error(
									`Generation failed for node ${dagNode.nodeId}: ${errMsg}`,
								),
							);
						},
						onGenerationComplete: args.onGenerationComplete,
						onGenerationError: args.onGenerationError,
					},
					metadata: args.metadata,
				}).catch(reject);
			});
		},
	});

	// Persist per-node durations and statuses to task steps
	let totalTaskDuration = 0;
	let completedCount = 0;
	let failedCount = 0;
	let skippedCount = 0;
	for (const [seqIdx, sequence] of task.sequences.entries()) {
		for (const [stepIdx, step] of sequence.steps.entries()) {
			// Find DAG node by generationId
			for (const [, dagNode] of dag.nodes) {
				if (dagNode.generationId === step.generationId) {
					const stepPatches = [];

					// Set status based on DAG node state
					if (dagNode.state === "completed") {
						stepPatches.push(patches.sequences(seqIdx).steps(stepIdx).status.set("completed"));
						completedCount++;
					} else if (dagNode.state === "skipped") {
						stepPatches.push(patches.sequences(seqIdx).steps(stepIdx).status.set("skipped"));
						skippedCount++;
					} else if (dagNode.state === "failed") {
						stepPatches.push(patches.sequences(seqIdx).steps(stepIdx).status.set("failed"));
						failedCount++;
					}

					// Set duration if available
					if (dagNode.startedAt && dagNode.completedAt) {
						const nodeDuration = dagNode.completedAt - dagNode.startedAt;
						stepPatches.push(patches.sequences(seqIdx).steps(stepIdx).duration.set(nodeDuration));
						totalTaskDuration += nodeDuration;
					}

					if (stepPatches.length > 0) {
						await applyPatches(task.id, stepPatches);
					}
					break;
				}
			}
		}
	}

	// Finalize task
	const duration = Date.now() - startTime;
	const finalStatus = result.hasError ? "failed" : "completed";
	await applyPatches(task.id, [
		patches.status.set(finalStatus),
		patches.duration.wallClock.set(duration),
		patches.duration.totalTask.set(totalTaskDuration),
		patches.steps.completed.set(completedCount),
		patches.steps.failed.set(failedCount),
		patches.steps.skipped.set(skippedCount),
	]);

	await patchQueue.flush();
	await patchQueue.cleanup();

	// Trigger error workflow callback if task failed
	if (finalStatus === "failed" && args.callbacks?.onTaskFailed) {
		// Collect first error message from failed DAG nodes
		let errorMessage = "Workflow execution failed";
		for (const [, dagNode] of dag.nodes) {
			if (dagNode.state === "failed" && dagNode.result?.error) {
				errorMessage = dagNode.result.error.message;
				break;
			}
		}
		try {
			await args.callbacks.onTaskFailed({
				taskId: task.id,
				workspaceId: task.workspaceId,
				error: errorMessage,
			});
		} catch (e) {
			args.context.logger.error({ error: e }, "Error workflow callback failed");
		}
	}
}

/**
 * Serialize DAG inputData map to a human-readable string for injection
 * into textGen/aiAgent prompts when downstream of flow control nodes.
 */
function stringifyDagInputData(inputData: Map<string, unknown>): string {
	const lines: string[] = [];
	for (const [key, value] of inputData) {
		if (typeof value === "string") {
			lines.push(`${key}: ${value}`);
		} else if (value === undefined || value === null) {
			lines.push(`${key}: (empty)`);
		} else if (value instanceof Map) {
			// Convert Map to plain object for serialization
			const obj = Object.fromEntries(value);
			lines.push(`${key}: ${JSON.stringify(obj)}`);
		} else if (Array.isArray(value)) {
			lines.push(`${key}: ${JSON.stringify(value)}`);
		} else {
			try {
				lines.push(`${key}: ${JSON.stringify(value)}`);
			} catch {
				lines.push(`${key}: ${String(value)}`);
			}
		}
	}
	return lines.join("\n");
}
