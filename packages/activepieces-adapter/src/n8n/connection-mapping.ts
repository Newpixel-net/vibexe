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
 */
export function convertConnections(
	n8nConnections: N8NConnections,
	nodeIdMapping: NodeIdMapping,
	generateId: () => string,
): GiselleConnection[] {
	const connections: GiselleConnection[] = [];

	for (const [sourceName, connectionGroups] of Object.entries(
		n8nConnections,
	)) {
		const sourceMapping = nodeIdMapping[sourceName];
		if (!sourceMapping) continue;

		// Iterate ALL connection type keys (main, ai_languageModel, ai_outputParser, ai_tool, etc.)
		for (const [connectionType, outputArrays] of Object.entries(
			connectionGroups,
		)) {
			if (!Array.isArray(outputArrays)) continue;

			// Detect sub-node connections by N8N connection type key
			const isSubNode = connectionType.startsWith("ai_");

			for (
				let outputIndex = 0;
				outputIndex < outputArrays.length;
				outputIndex++
			) {
				const targets = outputArrays[outputIndex];
				if (!targets) continue;

				// Use the outputIndex to pick the right output port, defaulting to first
				const outputId =
					sourceMapping.outputIds[outputIndex] ??
					sourceMapping.outputIds[0];
				if (!outputId) continue;

				for (const target of targets) {
					const targetMapping = nodeIdMapping[target.node];
					if (!targetMapping) continue;

					if (isSubNode) {
						// Sub-node connection: route from circle's top handle to agent's bottom handle
						let targetHandle: string;
						if (connectionType === "ai_languageModel") {
							targetHandle = "chatModel";
						} else if (connectionType === "ai_memory") {
							targetHandle = "memory";
						} else {
							// ai_outputParser, ai_tool, and any other ai_* types → tool handle
							targetHandle = "tool";
						}

						connections.push({
							id: generateId(),
							outputNode: {
								id: sourceMapping.nodeId,
								type: sourceMapping.nodeType,
								content: { type: sourceMapping.contentType },
							},
							outputId: "parent",
							inputNode: {
								id: targetMapping.nodeId,
								type: targetMapping.nodeType,
								content: { type: targetMapping.contentType },
							},
							inputId: targetHandle,
							connectionType: "subNode",
						});
					} else {
						// Regular main connection — existing logic
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

	return connections;
}
