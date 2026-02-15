import type {
	Connection,
	GenerationId,
	GenerationOutput,
	NodeId,
	OperationNode,
} from "@giselles-ai/protocol";

// ---- Node state machine ----
export type DagNodeState =
	| "pending"
	| "waiting"
	| "running"
	| "completed"
	| "skipped"
	| "failed";

export interface DagNodeResult {
	outputs: Map<string, unknown>; // outputId -> data
	generationOutputs?: GenerationOutput[];
	error?: Error;
}

export interface DagNode {
	nodeId: NodeId;
	operationNode: OperationNode;
	generationId?: GenerationId;
	state: DagNodeState;
	result?: DagNodeResult;
	/** Which output port was activated (for If/Switch — e.g. "true", "false", "rule_0") */
	activeOutputPort?: string;
	/** Error config for retry/error handling */
	errorConfig?: {
		retryOnFail: boolean;
		maxRetries: number;
		retryDelay: number;
		onError: "stopWorkflow" | "continueOnFail" | "routeToError";
		errorOutputPort?: string;
		timeoutEnabled?: boolean;
		timeoutMs?: number;
	};
	retryCount: number;
	/** Execution timing */
	startedAt?: number;
	completedAt?: number;
}

export interface DagEdge {
	fromNodeId: NodeId;
	toNodeId: NodeId;
	fromOutputPort?: string; // for If/Switch: "true", "false", "rule_0", "fallback"
	toInputPort?: string;
	connection: Connection;
}

// ---- Callbacks ----
export interface DagExecutorCallbacks {
	onNodeStart?: (nodeId: NodeId) => void | Promise<void>;
	onNodeComplete?: (
		nodeId: NodeId,
		result: DagNodeResult,
	) => void | Promise<void>;
	onNodeSkipped?: (nodeId: NodeId) => void | Promise<void>;
	onNodeFailed?: (nodeId: NodeId, error: Error) => void | Promise<void>;
	executeNode: (
		node: DagNode,
		inputData: Map<string, unknown>,
	) => Promise<DagNodeResult>;
}

// ---- The DAG ----
export class ExecutionDAG {
	nodes: Map<NodeId, DagNode> = new Map();
	edges: DagEdge[] = [];
	/** Map from nodeId -> edges where this node is the target */
	private incomingEdges: Map<NodeId, DagEdge[]> = new Map();
	/** Map from nodeId -> edges where this node is the source */
	private outgoingEdges: Map<NodeId, DagEdge[]> = new Map();
	/** Pending error data for ErrorTrigger nodes (injected by error routing) */
	errorTriggerData: Map<NodeId, Map<string, unknown>> = new Map();

	addNode(node: DagNode): void {
		this.nodes.set(node.nodeId, node);
	}

	addEdge(edge: DagEdge): void {
		this.edges.push(edge);
		// Index incoming
		const incoming = this.incomingEdges.get(edge.toNodeId) ?? [];
		incoming.push(edge);
		this.incomingEdges.set(edge.toNodeId, incoming);
		// Index outgoing
		const outgoing = this.outgoingEdges.get(edge.fromNodeId) ?? [];
		outgoing.push(edge);
		this.outgoingEdges.set(edge.fromNodeId, outgoing);
	}

	getIncomingEdges(nodeId: NodeId): DagEdge[] {
		return this.incomingEdges.get(nodeId) ?? [];
	}

	getOutgoingEdges(nodeId: NodeId): DagEdge[] {
		return this.outgoingEdges.get(nodeId) ?? [];
	}

	getRootNodes(): NodeId[] {
		const roots: NodeId[] = [];
		for (const [nodeId] of this.nodes) {
			const incoming = this.getIncomingEdges(nodeId);
			if (incoming.length === 0) {
				roots.push(nodeId);
			}
		}
		return roots;
	}

	/**
	 * Check if all required inputs for a node are satisfied.
	 * For Merge nodes in chooseBranch mode: at least one input must be completed.
	 * For other nodes: all incoming edges must have their source completed or skipped.
	 */
	isNodeReady(nodeId: NodeId): boolean {
		const node = this.nodes.get(nodeId);
		if (!node || node.state !== "waiting") return false;

		// ErrorTrigger nodes with pending error data are always ready
		if (node.operationNode.content.type === "errorTrigger" && this.errorTriggerData.has(nodeId)) {
			return true;
		}

		const incoming = this.getIncomingEdges(nodeId);
		if (incoming.length === 0) return true;

		const isMergeNode = node.operationNode.content.type === "merge";
		const mergeMode = isMergeNode
			? (node.operationNode.content as { mode?: string }).mode ??
				"chooseBranch"
			: null;

		if (isMergeNode && (mergeMode === "waitAny" || mergeMode === "chooseBranch")) {
			// At least one source must be completed, OR all sources must be terminal
			const hasCompleted = incoming.some((edge) => {
				const sourceNode = this.nodes.get(edge.fromNodeId);
				return sourceNode?.state === "completed";
			});
			if (hasCompleted) return true;

			// If all sources are terminal (completed/failed/skipped), fire anyway
			// so the workflow doesn't hang when one branch fails
			return incoming.every((edge) => {
				const sourceNode = this.nodes.get(edge.fromNodeId);
				return (
					sourceNode?.state === "completed" ||
					sourceNode?.state === "failed" ||
					sourceNode?.state === "skipped"
				);
			});
		}

		// Default: all sources must be in a terminal state
		return incoming.every((edge) => {
			const sourceNode = this.nodes.get(edge.fromNodeId);
			return (
				sourceNode?.state === "completed" ||
				sourceNode?.state === "skipped" ||
				sourceNode?.state === "failed"
			);
		});
	}

	/**
	 * Get the collected input data for a node from its upstream completed nodes.
	 */
	collectInputData(nodeId: NodeId): Map<string, unknown> {
		const data = new Map<string, unknown>();

		// If this node has pending error data (ErrorTrigger), merge it first
		const errorData = this.errorTriggerData.get(nodeId);
		if (errorData) {
			for (const [key, val] of errorData) {
				data.set(key, val);
			}
		}

		const incoming = this.getIncomingEdges(nodeId);

		for (const edge of incoming) {
			const sourceNode = this.nodes.get(edge.fromNodeId);
			// Collect from completed nodes AND skipped nodes with results (disabled pass-through)
			const hasResult = sourceNode?.result != null;
			const isCompleted = sourceNode?.state === "completed";
			const isSkippedWithResult = sourceNode?.state === "skipped" && hasResult;
			if ((!isCompleted && !isSkippedWithResult) || !sourceNode?.result) continue;

			// If the edge specifies a fromOutputPort, get that specific output
			if (edge.fromOutputPort) {
				const val = sourceNode.result.outputs.get(edge.fromOutputPort);
				if (val !== undefined) {
					const key = edge.toInputPort ?? edge.fromOutputPort;
					data.set(key, val);
				}
			} else {
				// Pass all outputs from the source
				for (const [key, val] of sourceNode.result.outputs) {
					data.set(key, val);
				}
			}
		}

		return data;
	}

	/**
	 * Skip a node and all its exclusive downstream descendants.
	 * "Exclusive" means: only skip nodes whose ALL incoming edges come from skipped nodes.
	 */
	skipBranch(nodeId: NodeId, callbacks?: DagExecutorCallbacks): void {
		const node = this.nodes.get(nodeId);
		if (!node) return;
		if (node.state === "completed" || node.state === "running") return;

		node.state = "skipped";
		callbacks?.onNodeSkipped?.(nodeId);

		// Propagate skip to downstream nodes whose ALL inputs are now skipped
		const outgoing = this.getOutgoingEdges(nodeId);
		for (const edge of outgoing) {
			const downstreamNode = this.nodes.get(edge.toNodeId);
			if (
				!downstreamNode ||
				downstreamNode.state === "completed" ||
				downstreamNode.state === "running" ||
				downstreamNode.state === "skipped"
			)
				continue;

			// Check if ALL incoming edges to this downstream node come from skipped nodes
			const downstreamIncoming = this.getIncomingEdges(edge.toNodeId);
			const allSkipped = downstreamIncoming.every((inc) => {
				const src = this.nodes.get(inc.fromNodeId);
				return src?.state === "skipped";
			});

			if (allSkipped) {
				this.skipBranch(edge.toNodeId, callbacks);
			}
		}
	}

	/**
	 * Check if the DAG execution is complete (all nodes are completed, skipped, or failed).
	 */
	isComplete(): boolean {
		for (const [, node] of this.nodes) {
			if (
				node.state === "pending" ||
				node.state === "waiting" ||
				node.state === "running"
			) {
				return false;
			}
		}
		return true;
	}

	hasError(): boolean {
		for (const [, node] of this.nodes) {
			if (node.state === "failed") return true;
		}
		return false;
	}

	/** Find all ErrorTrigger nodes in the DAG */
	getErrorTriggerNodes(): DagNode[] {
		const results: DagNode[] = [];
		for (const [, node] of this.nodes) {
			if (node.operationNode.content.type === "errorTrigger") {
				results.push(node);
			}
		}
		return results;
	}

	/**
	 * Route error data to all ErrorTrigger nodes and mark them ready to fire.
	 * Called when a node fails and its onError strategy involves error routing.
	 */
	routeErrorToTriggers(
		failedNodeId: NodeId,
		failedNodeName: string,
		errorMessage: string,
		callbacks?: DagExecutorCallbacks,
	): void {
		const errorData = new Map<string, unknown>([
			["errorMessage", errorMessage],
			["failedNodeId", failedNodeId],
			["failedNodeName", failedNodeName],
			["timestamp", new Date().toISOString()],
		]);

		for (const triggerNode of this.getErrorTriggerNodes()) {
			// Only fire if not already completed or running
			if (triggerNode.state === "completed" || triggerNode.state === "running") continue;
			this.errorTriggerData.set(triggerNode.nodeId, errorData);
			triggerNode.state = "waiting";
		}
	}
}

// ---- DAG Executor ----

export async function executeDag(
	dag: ExecutionDAG,
	callbacks: DagExecutorCallbacks,
): Promise<{ hasError: boolean }> {
	// Initialize: roots become "waiting", others stay "pending"
	const roots = dag.getRootNodes();
	for (const [nodeId, node] of dag.nodes) {
		node.state = roots.includes(nodeId) ? "waiting" : "pending";
	}

	// Mark nodes whose inputs are all from roots as "waiting" after roots complete
	// But first, fire all root nodes
	const fireNode = async (nodeId: NodeId): Promise<void> => {
		const node = dag.nodes.get(nodeId);
		if (!node || node.state !== "waiting") return;

		// Disabled nodes: skip and pass input data through to downstream
		if (node.operationNode.disabled) {
			node.state = "skipped";
			const inputData = dag.collectInputData(nodeId);
			node.result = { outputs: inputData };
			await callbacks.onNodeSkipped?.(nodeId);
			await propagateDownstream(nodeId);
			return;
		}

		// Mock data: use stored mock data instead of executing the node
		if (node.operationNode.mockData != null) {
			node.state = "completed";
			node.result = {
				outputs: new Map([["output", node.operationNode.mockData]]),
			};
			await callbacks.onNodeComplete?.(nodeId, node.result);
			await propagateDownstream(nodeId);
			return;
		}

		// Pinned data: use frozen output data, skip execution
		if (node.operationNode.pinnedData != null) {
			node.state = "completed";
			node.result = {
				outputs: new Map([["output", node.operationNode.pinnedData]]),
			};
			await callbacks.onNodeComplete?.(nodeId, node.result);
			await propagateDownstream(nodeId);
			return;
		}

		// Guard: if this node has upstream edges and NONE of them completed,
		// skip the node instead of executing with empty data. This prevents
		// cascading failures when an upstream node fails with stopWorkflow.
		// Exceptions: Merge nodes (have their own multi-input logic) and
		// ErrorTrigger nodes (fire on injected error data).
		const nodeContentType = node.operationNode.content.type;
		if (nodeContentType !== "merge" && nodeContentType !== "errorTrigger") {
			const incomingEdges = dag.getIncomingEdges(nodeId);
			if (incomingEdges.length > 0) {
				const hasCompletedSource = incomingEdges.some((edge) => {
					const src = dag.nodes.get(edge.fromNodeId);
					return src?.state === "completed";
				});
				if (!hasCompletedSource) {
					node.state = "skipped";
					await callbacks.onNodeSkipped?.(nodeId);
					await propagateDownstream(nodeId);
					return;
				}
			}
		}

		node.state = "running";
		node.startedAt = Date.now();
		await callbacks.onNodeStart?.(nodeId);

		let inputData = dag.collectInputData(nodeId);

		// Execute Once: if enabled and input is an array, only pass the first item
		if (node.operationNode.executeOnce) {
			const trimmedData = new Map<string, unknown>();
			for (const [key, val] of inputData) {
				trimmedData.set(key, Array.isArray(val) ? val[0] : val);
			}
			inputData = trimmedData;
		}

		try {
			// Apply per-node timeout if configured
			const timeoutMs = node.errorConfig?.timeoutEnabled ? (node.errorConfig.timeoutMs ?? 30000) : 0;
			const nodePromise = callbacks.executeNode(node, inputData);
			const result = timeoutMs > 0
				? await Promise.race([
						nodePromise,
						new Promise<never>((_, reject) =>
							setTimeout(() => reject(new Error(`Node timed out after ${timeoutMs}ms`)), timeoutMs),
						),
					])
				: await nodePromise;
			node.state = "completed";
			node.completedAt = Date.now();
			node.result = result;

			// Always Output Data: if enabled and output is empty, emit empty item
			if (node.operationNode.alwaysOutputData && result.outputs.size === 0) {
				result.outputs.set("output", [{}]);
				result.generationOutputs = [
					{
						type: "structured-data",
						data: [{}],
					} as GenerationOutput,
				];
			}

			await callbacks.onNodeComplete?.(nodeId, result);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));

			// Retry logic
			const errorConfig = node.errorConfig;
			if (errorConfig?.retryOnFail && node.retryCount < errorConfig.maxRetries) {
				node.retryCount++;
				node.state = "waiting";
				node.result = undefined; // Clear failed result before retry
				if (errorConfig.retryDelay > 0) {
					await new Promise((resolve) =>
						setTimeout(resolve, errorConfig.retryDelay),
					);
				}
				// Re-fire after delay
				await fireNode(nodeId);
				return;
			}

			node.completedAt = Date.now();

			// Error handling strategies
			if (errorConfig?.onError === "continueOnFail") {
				node.state = "completed";
				node.result = {
					outputs: new Map([["error", err.message]]),
					error: err,
				};
				await callbacks.onNodeComplete?.(nodeId, node.result);
			} else if (errorConfig?.onError === "routeToError") {
				node.state = "failed";
				node.result = { outputs: new Map(), error: err };
				node.activeOutputPort = errorConfig.errorOutputPort ?? "__error__";
				await callbacks.onNodeFailed?.(nodeId, err);
				// Route error to all ErrorTrigger nodes
				const nodeName = node.operationNode.name ?? nodeId;
				dag.routeErrorToTriggers(nodeId, nodeName, err.message, callbacks);
				// Propagate failure downstream so Merge/other nodes can react
				const routeOutgoing = dag.getOutgoingEdges(nodeId);
				for (const edge of routeOutgoing) {
					const downstream = dag.nodes.get(edge.toNodeId);
					if (downstream && downstream.state === "pending") {
						downstream.state = "waiting";
					}
				}
			} else {
				// Default: stopWorkflow
				node.state = "failed";
				node.result = { outputs: new Map(), error: err };
				await callbacks.onNodeFailed?.(nodeId, err);
				// Still route to ErrorTrigger nodes (they always fire on failure)
				const nodeName = node.operationNode.name ?? nodeId;
				dag.routeErrorToTriggers(nodeId, nodeName, err.message, callbacks);
				// Propagate failure downstream so Merge/other nodes can see the
				// terminal state and fire if their other inputs are satisfied
				const outgoing = dag.getOutgoingEdges(nodeId);
				for (const edge of outgoing) {
					const downstream = dag.nodes.get(edge.toNodeId);
					if (downstream && downstream.state === "pending") {
						downstream.state = "waiting";
					}
				}
				await fireReadyNodes();
				return;
			}
		}

		// After node completes, handle branching (If/Switch)
		await propagateDownstream(nodeId);
	};

	const propagateDownstream = async (completedNodeId: NodeId): Promise<void> => {
		const completedNode = dag.nodes.get(completedNodeId);
		if (!completedNode) return;

		const outgoing = dag.getOutgoingEdges(completedNodeId);
		const contentType = completedNode.operationNode.content.type;

		// For Loop nodes: iterate over items and re-execute downstream per iteration.
		// Split edges: "loop" body port (index 1) vs "done" post-loop port (index 0).
		if (contentType === "loop" && completedNode.result) {
			const items =
				completedNode.result.outputs.get("items") ??
				completedNode.result.outputs.get("item");
			if (Array.isArray(items) && items.length > 0) {
				// Determine loop body port accessor by name (not index) for safety
				const loopOutputs = completedNode.operationNode.outputs;
				const loopBodyAccessor = loopOutputs.find((o) => o.accessor === "loop")?.accessor
					?? (loopOutputs.length > 1 ? loopOutputs[1].accessor : undefined);

				const loopBodyEdges = loopBodyAccessor
					? outgoing.filter((e) => e.fromOutputPort === loopBodyAccessor)
					: [];
				const postLoopEdges = loopBodyAccessor
					? outgoing.filter((e) => e.fromOutputPort !== loopBodyAccessor)
					: outgoing;

				if (loopBodyEdges.length > 0) {
					await executeLoopIterations(completedNodeId, items, loopBodyEdges);
				}

				// If the loop failed during iteration, don't activate post-loop edges
				if (completedNode.state === "failed") {
					await fireReadyNodes(); // Still fire ErrorTrigger nodes etc.
					return;
				}

				// Activate post-loop downstream normally (from "done" port)
				for (const edge of postLoopEdges) {
					const downstream = dag.nodes.get(edge.toNodeId);
					if (downstream && downstream.state === "pending") {
						downstream.state = "waiting";
					}
				}
				await fireReadyNodes();
				return;
			}
		}

		// For If nodes: activate only the matching branch, skip the other
		if (contentType === "if" && completedNode.activeOutputPort) {
			const activePort = completedNode.activeOutputPort; // "true" or "false"
			for (const edge of outgoing) {
				const port = edge.fromOutputPort ?? "";
				if (port === activePort) {
					// Activate this branch
					const downstream = dag.nodes.get(edge.toNodeId);
					if (downstream && downstream.state === "pending") {
						downstream.state = "waiting";
					}
				} else {
					// Skip this branch
					dag.skipBranch(edge.toNodeId, callbacks);
				}
			}
		}
		// For Switch/Filter nodes: activate matching branch, skip others
		else if ((contentType === "switch" || contentType === "filter") && completedNode.activeOutputPort) {
			const activePort = completedNode.activeOutputPort;
			for (const edge of outgoing) {
				const port = edge.fromOutputPort ?? "";
				if (port === activePort) {
					const downstream = dag.nodes.get(edge.toNodeId);
					if (downstream && downstream.state === "pending") {
						downstream.state = "waiting";
					}
				} else {
					dag.skipBranch(edge.toNodeId, callbacks);
				}
			}
		}
		// For all other nodes: activate all downstream nodes
		else {
			for (const edge of outgoing) {
				const downstream = dag.nodes.get(edge.toNodeId);
				if (downstream && downstream.state === "pending") {
					downstream.state = "waiting";
				}
			}
		}

		// Now fire any nodes that are ready
		await fireReadyNodes();
	};

	/**
	 * Execute loop iterations sequentially. For each item in the array:
	 * 1. Set the loop output to the current item
	 * 2. Mark downstream nodes as "waiting"
	 * 3. Fire and complete downstream sub-graph
	 * 4. Collect iteration results
	 * 5. After all iterations, set aggregated results and continue past loop
	 */
	const executeLoopIterations = async (
		loopNodeId: NodeId,
		items: unknown[],
		outgoing: DagEdge[],
	): Promise<void> => {
		const loopNode = dag.nodes.get(loopNodeId);
		if (!loopNode) return;

		// Find all downstream nodes reachable from the loop (the "loop body")
		const loopBodyNodeIds = new Set<NodeId>();
		const collectLoopBody = (nodeId: NodeId) => {
			for (const edge of dag.getOutgoingEdges(nodeId)) {
				if (!loopBodyNodeIds.has(edge.toNodeId)) {
					loopBodyNodeIds.add(edge.toNodeId);
					collectLoopBody(edge.toNodeId);
				}
			}
		};
		for (const edge of outgoing) {
			loopBodyNodeIds.add(edge.toNodeId);
			collectLoopBody(edge.toNodeId);
		}

		// Store original outputs from loop body nodes (to restore between iterations)
		const allIterationResults: unknown[] = [];

		for (let i = 0; i < items.length; i++) {
			const currentItem = items[i];

			// Update loop node's result to the current item (not the full array)
			loopNode.result = {
				outputs: new Map([
					["item", currentItem],
					["output", currentItem],
					["loop", currentItem],
					["items", items],
					["index", i],
					["totalItems", items.length],
					["data", currentItem],
				]),
			};

			// Reset all loop body nodes to "pending" for this iteration
			for (const bodyNodeId of loopBodyNodeIds) {
				const bodyNode = dag.nodes.get(bodyNodeId);
				if (bodyNode) {
					bodyNode.state = "pending";
					bodyNode.result = undefined;
					bodyNode.activeOutputPort = undefined;
					bodyNode.retryCount = 0;
				}
			}

			// Mark direct downstream of loop as "waiting"
			for (const edge of outgoing) {
				const downstream = dag.nodes.get(edge.toNodeId);
				if (downstream) {
					downstream.state = "waiting";
				}
			}

			// Fire ready nodes until the loop body sub-graph completes
			let maxSteps = 100; // safety limit
			let iterationFailed = false;
			while (maxSteps-- > 0) {
				const readyInBody: NodeId[] = [];
				for (const bodyNodeId of loopBodyNodeIds) {
					if (dag.isNodeReady(bodyNodeId)) {
						readyInBody.push(bodyNodeId);
					}
				}
				if (readyInBody.length === 0) {
					// Check if a body node failed (which would cause no ready nodes)
					for (const bodyNodeId of loopBodyNodeIds) {
						const bodyNode = dag.nodes.get(bodyNodeId);
						if (bodyNode?.state === "failed") {
							iterationFailed = true;
							break;
						}
					}
					break;
				}
				await Promise.all(readyInBody.map((nid) => fireNode(nid)));
			}

			if (maxSteps <= 0) {
				console.error(
					`[dag-executor] Loop body exceeded 100 fire steps at iteration ${i} — possible runaway sub-graph`,
				);
				// Treat as fatal — mark loop as failed to prevent resource exhaustion
				iterationFailed = true;
				loopNode.state = "failed";
				loopNode.result = {
					outputs: new Map([["error", `Loop body exceeded 100 fire steps at iteration ${i}`]]),
					error: new Error(`Loop body exceeded 100 fire steps at iteration ${i}`),
				};
				break; // Exit the for-loop over items
			}

			// If a body node failed with stopWorkflow, stop the loop entirely
			if (iterationFailed) {
				const failedBody = [...loopBodyNodeIds].find(
					(nid) => dag.nodes.get(nid)?.state === "failed",
				);
				const failedNode = failedBody ? dag.nodes.get(failedBody) : undefined;
				const errorMsg = failedNode?.result?.error?.message ?? "Loop body node failed";
				console.error(`[dag-executor] Loop iteration ${i} failed: ${errorMsg}`);
				// Mark loop itself as failed
				loopNode.state = "failed";
				loopNode.result = {
					outputs: new Map([["error", errorMsg]]),
					error: new Error(errorMsg),
				};
				const loopName = loopNode.operationNode.name ?? loopNodeId;
				dag.routeErrorToTriggers(loopNodeId, loopName, errorMsg, callbacks);
				await callbacks.onNodeFailed?.(loopNodeId, new Error(errorMsg));
				return;
			}

			// Collect results from the last node(s) in the loop body
			const lastOutputs: Record<string, unknown> = {};
			for (const bodyNodeId of loopBodyNodeIds) {
				const bodyNode = dag.nodes.get(bodyNodeId);
				if (bodyNode?.state === "completed" && bodyNode.result) {
					for (const [key, val] of bodyNode.result.outputs) {
						lastOutputs[key] = val;
					}
				}
			}
			allIterationResults.push(
				Object.keys(lastOutputs).length === 1
					? Object.values(lastOutputs)[0]
					: lastOutputs,
			);
		}

		// Set the loop node's final result to the aggregated array
		loopNode.result = {
			outputs: new Map([
				["item", allIterationResults],
				["output", allIterationResults],
				["done", allIterationResults],
				["loop", allIterationResults],
				["items", allIterationResults],
				["totalItems", allIterationResults.length],
				["data", allIterationResults],
			]),
		};

		// Now propagate past the loop body to any nodes beyond it
		// (nodes that are NOT in loopBodyNodeIds but connect from loop body nodes)
		// Reset: we've already run the loop body, so leave body nodes in their final iteration state
		// and fire any nodes waiting on those body outputs
		await fireReadyNodes();
	};

	const fireReadyNodes = async (): Promise<void> => {
		const readyNodes: NodeId[] = [];
		for (const [nodeId] of dag.nodes) {
			if (dag.isNodeReady(nodeId)) {
				readyNodes.push(nodeId);
			}
		}

		if (readyNodes.length === 0) return;

		// Fire all ready nodes in parallel
		await Promise.all(readyNodes.map((nodeId) => fireNode(nodeId)));
	};

	// Start execution: fire root nodes
	await Promise.all(roots.map((nodeId) => fireNode(nodeId)));

	// If there are still waiting/pending nodes, try to fire them
	// This handles cases where the initial propagation didn't reach all nodes
	if (!dag.isComplete()) {
		await fireReadyNodes();
	}

	// Detect stuck DAG: if nodes are still waiting/pending after full execution,
	// something went wrong (deadlock, missing connections, etc.)
	if (!dag.isComplete()) {
		const stuckNodes: string[] = [];
		for (const [nodeId, node] of dag.nodes) {
			if (node.state === "pending" || node.state === "waiting" || node.state === "running") {
				stuckNodes.push(`${node.operationNode.name ?? nodeId} (${node.state})`);
			}
		}
		if (stuckNodes.length > 0) {
			console.error(
				`[dag-executor] DAG stuck with ${stuckNodes.length} non-terminal node(s): ${stuckNodes.join(", ")}. ` +
				"This may indicate a deadlock or missing connection.",
			);
			// Mark stuck nodes as failed so the workflow doesn't hang
			for (const [nodeId, node] of dag.nodes) {
				if (node.state === "pending" || node.state === "waiting") {
					node.state = "failed";
					const errorMsg = "Node stuck: never reached by execution";
					node.result = {
						outputs: new Map(),
						error: new Error(errorMsg),
					};
					await callbacks.onNodeFailed?.(nodeId, node.result.error);
					// Route to ErrorTrigger nodes so error workflows can fire
					dag.routeErrorToTriggers(nodeId, node.operationNode.name ?? nodeId, errorMsg, callbacks);
				}
			}
			// Fire any error triggers that became ready
			await fireReadyNodes();
		}
	}

	return { hasError: dag.hasError() };
}
