/**
 * Connection Mapping: Converts N8N's name-based connections to Giselle's ID-based format.
 */

export interface N8NConnection {
	node: string;
	type: string;
	index: number;
}

export interface N8NConnections {
	[sourceNodeName: string]: {
		[connectionType: string]: Array<N8NConnection[]>;
	};
}

export interface GiselleConnection {
	id: string;
	outputNode: { id: string; type: string; content: { type: string } };
	outputId: string;
	inputNode: { id: string; type: string; content: { type: string } };
	inputId: string;
	connectionType?: "regular" | "subNode";
}

interface NodeIdMapping {
	[n8nNodeName: string]: {
		nodeId: string;
		nodeType: "operation" | "variable";
		contentType: string;
		outputIds: string[];
		inputIds: string[];
	};
}

/**
 * Convert N8N connections to Giselle connections.
 *
 * Uses a two-pass approach for sub-node connections:
 * - Pass 1: Create direct connections + build circleToAgent map for nested sub-nodes
 * - Pass 2: Flatten nested sub-node connections (circle→circle) to target the parent agent
 */
export function convertConnections(
	n8nConnections: N8NConnections,
	nodeIdMapping: NodeIdMapping,
	generateId: () => string,
): GiselleConnection[] {
	const connections: GiselleConnection[] = [];
	const CIRCLE_TYPES = new Set(["chatModel", "toolNode", "memoryNode"]);

	// Pass 1: Create direct connections + build circleToAgent map
	const circleToAgent = new Map<string, string>(); // circle N8N name → agent N8N name
	const deferredSubNodes: Array<{
		sourceName: string;
		targetName: string;
	}> = [];

	for (const [sourceName, connectionGroups] of Object.entries(
		n8nConnections,
	)) {
		const sourceMapping = nodeIdMapping[sourceName];
		if (!sourceMapping) continue;

		for (const [connectionType, outputArrays] of Object.entries(
			connectionGroups,
		)) {
			if (!Array.isArray(outputArrays)) continue;

			const isSubNode = connectionType.startsWith("ai_");

			for (
				let outputIndex = 0;
				outputIndex < outputArrays.length;
				outputIndex++
			) {
				const targets = outputArrays[outputIndex];
				if (!targets) continue;

				const outputId =
					sourceMapping.outputIds[outputIndex] ??
					sourceMapping.outputIds[0];
				if (!outputId) continue;

				for (const target of targets) {
					const targetMapping = nodeIdMapping[target.node];
					if (!targetMapping) continue;

					if (isSubNode) {
						const targetIsCircle = CIRCLE_TYPES.has(
							targetMapping.contentType,
						);

						if (targetIsCircle) {
							// NESTED: target is a circle → defer to pass 2
							deferredSubNodes.push({
								sourceName,
								targetName: target.node,
							});
						} else {
							// DIRECT: target is a WideNode (aiAgent) → create connection
							// Also record circle→agent mapping for pass 2
							circleToAgent.set(sourceName, target.node);

							const subInputId =
								targetMapping.inputIds[target.index] ??
								targetMapping.inputIds[0];
							if (!subInputId) continue;

							connections.push({
								id: generateId(),
								outputNode: {
									id: sourceMapping.nodeId,
									type: sourceMapping.nodeType,
									content: {
										type: sourceMapping.contentType,
									},
								},
								outputId,
								inputNode: {
									id: targetMapping.nodeId,
									type: targetMapping.nodeType,
									content: {
										type: targetMapping.contentType,
									},
								},
								inputId: subInputId,
								connectionType: "subNode",
							});
						}
					} else {
						// Regular main connection
						const inputId =
							targetMapping.inputIds[target.index] ??
							targetMapping.inputIds[0];
						if (!inputId) continue;

						connections.push({
							id: generateId(),
							outputNode: {
								id: sourceMapping.nodeId,
								type: sourceMapping.nodeType,
								content: { type: sourceMapping.contentType },
							},
							outputId,
							inputNode: {
								id: targetMapping.nodeId,
								type: targetMapping.nodeType,
								content: { type: targetMapping.contentType },
							},
							inputId,
						});
					}
				}
			}
		}
	}

	// Pass 2: Flatten nested sub-node connections to parent agent
	for (const deferred of deferredSubNodes) {
		const sourceMapping = nodeIdMapping[deferred.sourceName];
		if (!sourceMapping) continue;

		// Find the parent agent: target circle → agent
		const agentName = circleToAgent.get(deferred.targetName);
		if (!agentName) continue;

		const agentMapping = nodeIdMapping[agentName];
		if (!agentMapping) continue;

		const outputId = sourceMapping.outputIds[0];
		if (!outputId) continue;

		connections.push({
			id: generateId(),
			outputNode: {
				id: sourceMapping.nodeId,
				type: sourceMapping.nodeType,
				content: { type: sourceMapping.contentType },
			},
			outputId,
			inputNode: {
				id: agentMapping.nodeId,
				type: agentMapping.nodeType,
				content: { type: agentMapping.contentType },
			},
			inputId: agentMapping.inputIds[0] ?? "tool",
			connectionType: "subNode",
		});
	}

	return connections;
}
