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
	executeCode,
	executeDataTable,
	executeEditFields,
	executeErrorTrigger,
	executeFilter,
	executeIf,
	executeLoop,
	executeMerge,
	executeSort,
	executeSwitch,
	executeWait,
} from "../flow-control";
import {
	type GenerationMetadata,
	generateImage,
	getGeneration,
	type OnGenerationComplete,
	type OnGenerationError,
} from "../generations";
import { startContentGeneration } from "../generations/start-content-generation";
import {
	executeAction,
	executeDataQuery,
	executeIntegration,
} from "../operations";
import { executeQuery } from "../operations/execute-query";
import { resolveTrigger } from "../triggers";
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
	while (true) {
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
}

export interface RunTaskCallbacks {
	sequenceStart?: (args: { sequence: Sequence }) => void | Promise<void>;
	sequenceFail?: (args: { sequence: Sequence }) => void | Promise<void>;
	sequenceComplete?: (args: { sequence: Sequence }) => void | Promise<void>;
	sequenceSkip?: (args: { sequence: Sequence }) => void | Promise<void>;
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
				await startContentGeneration({
					generation: args.generation,
					context: args.context,
					metadata: args.metadata,
					onComplete: args.callbacks?.onGenerationComplete,
					onError: args.callbacks?.onGenerationError,
				});
				const finishedGeneration = await waitUntilGenerationFinishes({
					context: args.context,
					generationId: args.generation.id,
				});
				if (isFailedGeneration(finishedGeneration)) {
					await args.callbacks?.onFailed?.(finishedGeneration);
				}
				if (isCompletedGeneration(finishedGeneration)) {
					await args.callbacks?.onCompleted?.();
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
		console.log(_e);
		await args.callbacks?.onFailed?.(args.generation);
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

	// Create patch queue for this task execution
	const patchQueue = createPatchQueue(args.context);
	const applyPatches = patchQueue.createApplyPatches();

	// Route to DAG executor or legacy executor
	if (task.useDagExecution) {
		await runTaskWithDag(args, task, patchQueue);
		return;
	}

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

	patchQueue.cleanup();
	if (executionError !== null) {
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

						dag.addEdge({
							fromNodeId: conn.outputNode.id as NodeId,
							toNodeId: conn.inputNode.id as NodeId,
							fromOutputPort: outputPort?.accessor ?? (conn.outputId as string | undefined),
							toInputPort: inputPort?.accessor ?? (conn.inputId as string | undefined),
							connection: conn,
						});
					}
				}
			}
		}
	}

	const startTime = Date.now();

	const result = await executeDag(dag, {
		onNodeStart: async (nodeId) => {
			args.context.logger.debug(`[DAG] Node ${nodeId} starting`);
		},
		onNodeComplete: async (nodeId, nodeResult) => {
			args.context.logger.debug(`[DAG] Node ${nodeId} completed`);
		},
		onNodeSkipped: async (nodeId) => {
			args.context.logger.debug(`[DAG] Node ${nodeId} skipped`);
		},
		onNodeFailed: async (nodeId, error) => {
			args.context.logger.error(
				{ error },
				`[DAG] Node ${nodeId} failed: ${error.message}`,
			);
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
					return executeWait(dagNode, inputData);
				case "errorTrigger":
					return executeErrorTrigger(dagNode, inputData);
				case "dataTable":
					return executeDataTable(dagNode, inputData);
				case "formTrigger":
					return { outputs: new Map() };
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
							reject(
								new Error(
									`Generation failed for node ${dagNode.nodeId}`,
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

	// Finalize task
	const duration = Date.now() - startTime;
	await applyPatches(task.id, [
		patches.status.set(result.hasError ? "failed" : "completed"),
		patches.duration.wallClock.set(duration),
	]);

	await patchQueue.flush();
	patchQueue.cleanup();
}
