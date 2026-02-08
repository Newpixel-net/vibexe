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
		main: Array<N8NConnection[]>;
	};
}

export interface GiselleConnection {
	id: string;
	outputNode: { id: string; type: string };
	outputId: string;
	inputNode: { id: string; type: string };
	inputId: string;
}

interface NodeIdMapping {
	[n8nNodeName: string]: {
		nodeId: string;
		nodeType: "operation" | "variable";
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

		if (!connectionGroups.main) continue;

		for (
			let outputIndex = 0;
			outputIndex < connectionGroups.main.length;
			outputIndex++
		) {
			const targets = connectionGroups.main[outputIndex];
			if (!targets) continue;

			// Use the outputIndex to pick the right output port, defaulting to first
			const outputId =
				sourceMapping.outputIds[outputIndex] ??
				sourceMapping.outputIds[0];
			if (!outputId) continue;

			for (const target of targets) {
				const targetMapping = nodeIdMapping[target.node];
				if (!targetMapping) continue;

				// Use the target's index to pick the right input port
				const inputId =
					targetMapping.inputIds[target.index] ??
					targetMapping.inputIds[0];
				if (!inputId) continue;

				connections.push({
					id: generateId(),
					outputNode: {
						id: sourceMapping.nodeId,
						type: sourceMapping.nodeType,
					},
					outputId,
					inputNode: {
						id: targetMapping.nodeId,
						type: targetMapping.nodeType,
					},
					inputId,
				});
			}
		}
	}

	return connections;
}
