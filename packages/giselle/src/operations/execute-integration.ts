import {
	type GenerationContext,
	type GenerationOutput,
	isAppEntryNode,
	isIntegrationNode,
	isTextNode,
	type NodeId,
	type OutputId,
	type QueuedGeneration,
} from "@giselles-ai/protocol";
import {
	isJsonContent,
	jsonContentToText,
} from "@giselles-ai/text-editor-utils";
import { useGenerationExecutor } from "../generations/internal/use-generation-executor";
import type { AppEntryResolver } from "../generations/types";
import type { GiselleContext } from "../types";

async function resolveIntegrationInputs(args: {
	generationContext: GenerationContext;
	generationContentResolver: (
		nodeId: NodeId,
		outputId: OutputId,
	) => Promise<string | undefined>;
	appEntryResolver: AppEntryResolver;
}): Promise<Record<string, string>> {
	const inputs: Record<string, string> = {};
	const generationContext = args.generationContext;

	console.log("[integration-debug] resolveIntegrationInputs called");
	console.log("[integration-debug] operationNode inputs:", generationContext.operationNode.inputs.map(i => ({ id: i.id, accessor: i.accessor })));
	console.log("[integration-debug] connections:", generationContext.connections.map(c => ({ inputId: c.inputId, outputNodeId: c.outputNode.id, outputId: c.outputId })));
	console.log("[integration-debug] sourceNodes:", generationContext.sourceNodes.map(s => ({ id: s.id, type: s.type, contentType: s.content?.type })));
	console.log("[integration-debug] generationContext.inputs:", JSON.stringify(generationContext.inputs));

	for (const input of generationContext.operationNode.inputs) {
		const connection = generationContext.connections.find(
			(connection) => connection.inputId === input.id,
		);
		if (connection === undefined) {
			console.log(`[integration-debug] No connection for input ${input.accessor} (${input.id})`);
			continue;
		}
		const sourceNode = generationContext.sourceNodes.find(
			(sourceNode) => sourceNode.id === connection.outputNode.id,
		);
		if (sourceNode === undefined) {
			console.log(`[integration-debug] No source node for connection outputNode ${connection.outputNode.id}`);
			continue;
		}

		console.log(`[integration-debug] Processing source node: type=${sourceNode.type}, contentType=${sourceNode.content?.type}, isAppEntry=${isAppEntryNode(sourceNode)}`);

		switch (sourceNode.type) {
			case "operation": {
				if (isAppEntryNode(sourceNode)) {
					console.log(`[integration-debug] Calling appEntryResolver for nodeId=${connection.outputNode.id}, outputId=${connection.outputId}`);
					try {
						const parts = await args.appEntryResolver(
							connection.outputNode.id,
							connection.outputId,
						);
						console.log(`[integration-debug] appEntryResolver returned ${parts.length} parts:`, JSON.stringify(parts));
						if (parts.length > 0) {
							const textParts = parts.filter((p) => p.type === "text");
							if (textParts.length > 0) {
								inputs[input.accessor] = textParts
									.map((p) => p.text)
									.join(" ");
								console.log(`[integration-debug] Set input "${input.accessor}" = "${inputs[input.accessor]?.substring(0, 100)}..."`);
							}
						}
					} catch (err) {
						console.error(`[integration-debug] appEntryResolver ERROR:`, err);
					}
					break;
				}

				const content = await args.generationContentResolver(
					connection.outputNode.id,
					connection.outputId,
				);
				console.log(`[integration-debug] generationContentResolver returned: ${content !== undefined ? content.substring(0, 100) : "undefined"}`);
				if (content !== undefined) {
					inputs[input.accessor] = content;
				}
				break;
			}
			case "variable":
				switch (sourceNode.content.type) {
					case "text": {
						if (!isTextNode(sourceNode)) {
							throw new Error(`Unexpected node data: ${sourceNode.id}`);
						}
						const jsonOrText = sourceNode.content.text;
						inputs[input.accessor] = isJsonContent(jsonOrText)
							? jsonContentToText(JSON.parse(jsonOrText))
							: jsonOrText;
						break;
					}
					default:
						break;
				}
				break;
			default:
				break;
		}
	}
	return inputs;
}

function createIntegrationOutput(
	result: unknown,
	generationContext: GenerationContext,
): GenerationOutput[] {
	const resultOutput = generationContext.operationNode.outputs.find(
		(output) => output.accessor === "action-result",
	);
	if (resultOutput === undefined) {
		return [];
	}
	return [
		{
			type: "generated-text",
			content:
				typeof result === "string" ? result : JSON.stringify(result, null, 2),
			outputId: resultOutput.id,
		},
	];
}

export function executeIntegration(args: {
	context: GiselleContext;
	generation: QueuedGeneration;
}) {
	return useGenerationExecutor({
		context: args.context,
		generation: args.generation,
		execute: async ({
			generationContext,
			generationContentResolver,
			appEntryResolver,
			finishGeneration,
		}) => {
			const operationNode = generationContext.operationNode;
			if (!isIntegrationNode(operationNode)) {
				throw new Error("Invalid generation type: expected integration node");
			}

			const { pieceName, actionName, pieceVersion, configuration } =
				operationNode.content;

			const resolvedInputs = await resolveIntegrationInputs({
				generationContext,
				generationContentResolver,
				appEntryResolver,
			});

			console.log("[integration-debug] resolvedInputs:", JSON.stringify(resolvedInputs));
			console.log("[integration-debug] configuration:", JSON.stringify(configuration));

			// Merge configuration with resolved inputs
			const mergedConfig = {
				...configuration,
				...resolvedInputs,
			};
			console.log("[integration-debug] mergedConfig keys:", Object.keys(mergedConfig));

			let result: unknown;
			try {
				// Dynamic import of activepieces adapter
				const { executePieceAction } = await import(
					"@giselles-ai/activepieces-adapter"
				);
				result = await executePieceAction({
					pieceName,
					actionName,
					pieceVersion,
					properties: mergedConfig,
					auth: null,
				});
			} catch (error) {
				console.error("Integration execution failed:", error);
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				result = {
					error: true,
					message: `Integration execution failed: ${errorMessage}`,
					pieceName,
					actionName,
				};
			}

			const generationOutputs = createIntegrationOutput(
				result,
				generationContext,
			);
			await finishGeneration({
				inputMessages: [],
				outputs: generationOutputs,
			});
		},
	});
}
