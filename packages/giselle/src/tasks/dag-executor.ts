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
	};
	retryCount: number;
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

		const incoming = this.getIncomingEdges(nodeId);
		if (incoming.length === 0) return true;

		const isMergeNode = node.operationNode.content.type === "merge";
		const mergeMode = isMergeNode
			? (node.operationNode.content as { mode?: string }).mode ??
				"chooseBranch"
			: null;

		if (isMergeNode && (mergeMode === "waitAny" || mergeMode === "chooseBranch")) {
			// At least one source must be completed (not just skipped)
			return incoming.some((edge) => {
				const sourceNode = this.nodes.get(edge.fromNodeId);
				return sourceNode?.state === "completed";
			});
		}

		// Default: all sources must be completed or skipped
		return incoming.every((edge) => {
			const sourceNode = this.nodes.get(edge.fromNodeId);
			return (
				sourceNode?.state === "completed" || sourceNode?.state === "skipped"
			);
		});
	}

	/**
	 * Get the collected input data for a node from its upstream completed nodes.
	 */
	collectInputData(nodeId: NodeId): Map<string, unknown> {
		const data = new Map<string, unknown>();
		const incoming = this.getIncomingEdges(nodeId);

		for (const edge of incoming) {
			const sourceNode = this.nodes.get(edge.fromNodeId);
			if (sourceNode?.state !== "completed" || !sourceNode.result) continue;

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

		node.state = "running";
		await callbacks.onNodeStart?.(nodeId);

		const inputData = dag.collectInputData(nodeId);

		try {
			const result = await callbacks.executeNode(node, inputData);
			node.state = "completed";
			node.result = result;
			await callbacks.onNodeComplete?.(nodeId, result);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));

			// Retry logic
			const errorConfig = node.errorConfig;
			if (errorConfig?.retryOnFail && node.retryCount < errorConfig.maxRetries) {
				node.retryCount++;
				node.state = "waiting";
				if (errorConfig.retryDelay > 0) {
					await new Promise((resolve) =>
						setTimeout(resolve, errorConfig.retryDelay),
					);
				}
				// Re-fire after delay
				await fireNode(nodeId);
				return;
			}

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
			} else {
				// Default: stopWorkflow
				node.state = "failed";
				node.result = { outputs: new Map(), error: err };
				await callbacks.onNodeFailed?.(nodeId, err);
				return; // Don't propagate further
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
		// For Switch nodes: activate matching rule's branch, skip others
		else if (contentType === "switch" && completedNode.activeOutputPort) {
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

	return { hasError: dag.hasError() };
}
