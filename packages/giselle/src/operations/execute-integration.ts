import {
	type GenerationContext,
	type GenerationOutput,
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

	for (const input of generationContext.operationNode.inputs) {
		const connection = generationContext.connections.find(
			(connection) => connection.inputId === input.id,
		);
		if (connection === undefined) {
			continue;
		}
		const sourceNode = generationContext.sourceNodes.find(
			(sourceNode) => sourceNode.id === connection.outputNode.id,
		);
		if (sourceNode === undefined) {
			continue;
		}

		switch (sourceNode.type) {
			case "operation": {
				const content = await args.generationContentResolver(
					connection.outputNode.id,
					connection.outputId,
				);
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
	console.log("[DEBUG-INT] executeIntegration (operations) called, generationId:", args.generation.id);
	return useGenerationExecutor({
		context: args.context,
		generation: args.generation,
		execute: async ({
			generationContext,
			generationContentResolver,
			appEntryResolver,
			finishGeneration,
		}) => {
			console.log("[DEBUG-INT] execute callback entered");
			const operationNode = generationContext.operationNode;
			if (!isIntegrationNode(operationNode)) {
				throw new Error("Invalid generation type: expected integration node");
			}

			const { pieceName, actionName, pieceVersion, configuration } =
				operationNode.content;
			console.log("[DEBUG-INT] piece:", pieceName, "action:", actionName, "config:", JSON.stringify(configuration));

			const resolvedInputs = await resolveIntegrationInputs({
				generationContext,
				generationContentResolver,
				appEntryResolver,
			});

			// Merge configuration with resolved inputs
			const mergedConfig = {
				...configuration,
				...resolvedInputs,
			};

			let result: unknown;
			try {
				console.log("[DEBUG-INT] About to import activepieces-adapter");
				// Dynamic import of activepieces adapter
				const { executePieceAction } = await import(
					"@giselles-ai/activepieces-adapter"
				);
				console.log("[DEBUG-INT] Adapter imported, calling executePieceAction");
				result = await executePieceAction({
					pieceName,
					actionName,
					pieceVersion,
					properties: mergedConfig,
					auth: null,
				});
				console.log("[DEBUG-INT] executePieceAction returned:", typeof result);
			} catch (error) {
				console.error("[DEBUG-INT] executePieceAction error:", error);
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
			console.log("[DEBUG-INT] Calling finishGeneration with outputs:", generationOutputs.length);
			await finishGeneration({
				inputMessages: [],
				outputs: generationOutputs,
			});
			console.log("[DEBUG-INT] finishGeneration completed");
		},
	});
}
