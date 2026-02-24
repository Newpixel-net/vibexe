import {
	type CompletedGeneration,
	GenerationContext,
	type GenerationContextInput,
	type GenerationOutput,
	isTriggerNode,
	type QueuedGeneration,
} from "@vibexe-ai/protocol";
import { githubEvents } from "@vibexe-ai/trigger-registry";
import { internalSetGeneration } from "../generations/internal/set-generation";
import { resolveTrigger as resolveGitHubTrigger } from "../github/trigger-utils";
import type { VibexeContext } from "../types";
import { getTrigger } from "./utils";

export async function resolveTrigger(args: {
	context: VibexeContext;
	generation: QueuedGeneration;
}) {
	const operationNode = args.generation.context.operationNode;
	if (!isTriggerNode(operationNode)) {
		throw new Error("Invalid generation type");
	}
	if (operationNode.content.state.status !== "configured") {
		throw new Error("Trigger node is not configured");
	}
	const triggerData = await getTrigger({
		triggerId: operationNode.content.state.flowTriggerId,
		storage: args.context.storage,
	});
	if (triggerData === undefined) {
		throw new Error("Trigger data not found");
	}

	const generationContext = GenerationContext.parse(args.generation.context);

	const outputs: GenerationOutput[] = [];
	switch (triggerData.configuration.provider) {
		case "github": {
			switch (args.generation.context.origin.type) {
				case "stage":
				case "github-app":
					{
						const githubWebhookEventInput = generationContext.inputs?.find(
							(input) => input.type === "github-webhook-event",
						);
						if (githubWebhookEventInput === undefined) {
							throw new Error("Missing github-webhook-event input");
						}
						if (triggerData.configuration.provider !== "github") {
							throw new Error("Invalid provider");
						}

						if (
							!args.context.integrationConfigs?.github?.authV2.appId ||
							!args.context.integrationConfigs?.github?.authV2.privateKey
						) {
							throw new Error("Missing GitHub App ID or Private Key");
						}
						for (const output of operationNode.outputs) {
							const resolveOutput = await resolveGitHubTrigger({
								output,
								githubEvent: githubEvents[triggerData.configuration.event.id],
								trigger: triggerData,
								webhookEvent: githubWebhookEventInput.webhookEvent,
								appId: args.context.integrationConfigs.github.authV2.appId,
								privateKey:
									args.context.integrationConfigs.github.authV2.privateKey,
								installationId: triggerData.configuration.installationId,
							});
							if (resolveOutput !== null) {
								outputs.push(resolveOutput);
							}
						}
					}

					break;
				case "studio": {
					const parameterInput = generationContext.inputs?.find(
						(input) => input.type === "parameters",
					);
					if (parameterInput === undefined) {
						throw new Error("Missing Parameters Input");
					}

					for (const output of operationNode.outputs) {
						const inputItem = parameterInput.items.find(
							(item) => item.name === output.accessor,
						);
						if (inputItem === undefined) {
							continue;
						}
						outputs.push({
							outputId: output.id,
							type: "generated-text",
							content: `${inputItem.value}`,
						});
					}

					break;
				}
				case "api": {
					const parameterInput = generationContext.inputs?.find(
						(input) => input.type === "parameters",
					);
					if (parameterInput === undefined) {
						throw new Error("Missing Parameters Input");
					}

					for (const output of operationNode.outputs) {
						const inputItem = parameterInput.items.find(
							(item) => item.name === output.accessor,
						);
						if (inputItem === undefined) {
							continue;
						}
						outputs.push({
							outputId: output.id,
							type: "generated-text",
							content: `${inputItem.value}`,
						});
					}

					break;
				}
				default: {
					const _exhaustiveCheck: never = args.generation.context.origin;
					throw new Error(`Unhandled origin type: ${_exhaustiveCheck}`);
				}
			}
			break;
		}
		case "manual": {
			// Find ParametersInput once outside the loop
			const parametersInput = generationContext.inputs?.find(
				(i): i is GenerationContextInput & { type: "parameters" } =>
					i.type === "parameters",
			);

			// Create Map of outputs by accessor for O(1) lookup
			const outputsByAccessor = new Map(
				operationNode.outputs.map((output) => [output.accessor, output]),
			);

			for (const parameter of triggerData.configuration.event.parameters) {
				let parameterValue: string | undefined;

				if (parametersInput) {
					const parameterItem = parametersInput.items.find(
						(item) => item.name === parameter.id,
					);
					if (parameterItem) {
						parameterValue = parameterItem.value.toString();
					}
				}

				if (parameterValue === undefined) {
					continue;
				}

				const output = outputsByAccessor.get(parameter.id);
				if (output === undefined) {
					continue;
				}

				outputs.push({
					type: "generated-text",
					outputId: output.id,
					content: parameterValue,
				});
			}
			break;
		}
		case "schedule": {
			// Schedule triggers don't have input parameters — they fire on cron.
			// Any configured output (e.g., "triggered_at") can be set here.
			const triggeredAtOutput = operationNode.outputs.find(
				(output) => output.accessor === "triggered_at",
			);
			if (triggeredAtOutput) {
				outputs.push({
					type: "generated-text",
					outputId: triggeredAtOutput.id,
					content: new Date().toISOString(),
				});
			}
			break;
		}
		case "webhook": {
			// Webhook triggers pass the request body as trigger output.
			// The body is available via ParametersInput (same as manual triggers).
			const webhookParamsInput = generationContext.inputs?.find(
				(i): i is GenerationContextInput & { type: "parameters" } =>
					i.type === "parameters",
			);

			if (webhookParamsInput) {
				// Map each item to an output by accessor name
				for (const item of webhookParamsInput.items) {
					const output = operationNode.outputs.find(
						(o) => o.accessor === item.name,
					);
					if (output) {
						outputs.push({
							type: "generated-text",
							outputId: output.id,
							content: `${item.value}`,
						});
					}
				}
			}

			// Also provide the raw body as a "body" output if it exists
			const bodyOutput = operationNode.outputs.find(
				(o) => o.accessor === "body",
			);
			if (bodyOutput && webhookParamsInput) {
				const bodyObj: Record<string, unknown> = {};
				for (const item of webhookParamsInput.items) {
					bodyObj[item.name] = item.value;
				}
				outputs.push({
					type: "generated-text",
					outputId: bodyOutput.id,
					content: JSON.stringify(bodyObj),
				});
			}
			break;
		}
		case "chat": {
			// Chat triggers pass the user message as trigger output.
			const chatParamsInput = generationContext.inputs?.find(
				(i): i is GenerationContextInput & { type: "parameters" } =>
					i.type === "parameters",
			);

			if (chatParamsInput) {
				for (const item of chatParamsInput.items) {
					const output = operationNode.outputs.find(
						(o) => o.accessor === item.name,
					);
					if (output) {
						outputs.push({
							type: "generated-text",
							outputId: output.id,
							content: `${item.value}`,
						});
					}
				}
			}
			break;
		}
		case "appEvent": {
			// App event triggers receive webhook data from third-party services
			// (Slack, Google Drive, Notion, etc.) via the Activepieces trigger system.
			// The webhook payload is passed as ParametersInput.
			const appEventInput = generationContext.inputs?.find(
				(i): i is GenerationContextInput & { type: "parameters" } =>
					i.type === "parameters",
			);

			if (appEventInput) {
				for (const item of appEventInput.items) {
					const output = operationNode.outputs.find(
						(o) => o.accessor === item.name,
					);
					if (output) {
						outputs.push({
							type: "generated-text",
							outputId: output.id,
							content: `${item.value}`,
						});
					}
				}
			}

			// Also provide the full event payload as JSON on the "payload" output
			const payloadOutput = operationNode.outputs.find(
				(o) => o.accessor === "payload",
			);
			if (payloadOutput && appEventInput) {
				const payloadObj: Record<string, unknown> = {};
				for (const item of appEventInput.items) {
					payloadObj[item.name] = item.value;
				}
				outputs.push({
					type: "generated-text",
					outputId: payloadOutput.id,
					content: JSON.stringify(payloadObj),
				});
			}
			break;
		}
		default: {
			const _exhaustiveCheck: never = triggerData.configuration;
			throw new Error(`Unhandled provider: ${_exhaustiveCheck}`);
		}
	}

	const completedGeneration = {
		...args.generation,
		status: "completed",
		messages: [],
		queuedAt: Date.now(),
		startedAt: Date.now(),
		completedAt: Date.now(),
		outputs,
	} satisfies CompletedGeneration;

	await internalSetGeneration({
		generation: completedGeneration,
		storage: args.context.storage,
	});
}
