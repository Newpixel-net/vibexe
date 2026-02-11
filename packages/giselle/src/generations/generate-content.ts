import { type AnthropicProviderOptions, anthropic } from "@ai-sdk/anthropic";
import {
	loadMemory,
	saveMemory,
	buildSessionKey,
} from "./v2/memory/memory-store";
import { google } from "@ai-sdk/google";
import {
	type OpenAIResponsesProviderOptions,
	createOpenAI,
	openai,
} from "@ai-sdk/openai";
import type { SharedV2ProviderMetadata } from "@ai-sdk/provider";
import { githubTools, octokit } from "@giselles-ai/github-tool";
import {
	Capability,
	hasCapability,
	languageModels,
} from "@giselles-ai/language-model";
import type {
	AwaitingReviewGeneration,
	CompletedGeneration,
	FailedGeneration,
	GenerationOutput,
	GenerationUsage,
	OutputFileBlob,
	RunningGeneration,
} from "@giselles-ai/protocol";
import {
	isAiAgentNode,
	isChatModelNode,
	isContentGenerationNode,
	isTextGenerationNode,
	type Output,
	type TextGenerationLanguageModelData,
} from "@giselles-ai/protocol";
import {
	AISDKError,
	type AsyncIterableStream,
	type ModelMessage,
	smoothStream,
	stepCountIs,
	streamText,
	type Tool,
	type UIMessage,
} from "ai";
import { generationUiMessageChunksPath } from "../path";
import { decryptSecret } from "../secrets";
import type { GiselleContext } from "../types";
import { batchWriter } from "../utils";
import {
	type OnGenerationComplete,
	type OnGenerationError,
	useGenerationExecutor,
} from "./internal/use-generation-executor";
import { internalSetGeneration } from "./internal/set-generation";
import { createPostgresTools } from "./tools/postgres";
import type { GenerationMetadata, PreparedToolSet } from "./types";
import { buildMessageObject, getGeneration } from "./utils";
import { transformGiselleLanguageModelToAiSdkLanguageModelCallOptions } from "./v2/language-model";
import { buildToolSet } from "./v2/tools";

/** Create providers lazily so they pick up API keys set after module load (e.g. via admin panel). */
function getPerplexityProvider() {
	return createOpenAI({
		apiKey: process.env.PERPLEXITY_API_KEY ?? "",
		baseURL: "https://api.perplexity.ai/",
	});
}

function getXaiProvider() {
	return createOpenAI({
		apiKey: process.env.XAI_API_KEY ?? "",
		baseURL: "https://api.x.ai/v1",
	});
}

function getNvidiaProvider() {
	return createOpenAI({
		apiKey: process.env.NVIDIA_API_KEY ?? "",
		baseURL: "https://integrate.api.nvidia.com/v1",
	});
}

type StreamItem<T> = T extends AsyncIterableStream<infer Inner> ? Inner : never;

type GenerateContentResult =
	| {
			success: true;
			completedGeneration: CompletedGeneration;
			inputMessages: ModelMessage[];
			outputFileBlobs: OutputFileBlob[];
			usage: GenerationUsage;
			generateMessages: UIMessage[];
			providerMetadata?: SharedV2ProviderMetadata;
	  }
	| {
			success: false;
			failedGeneration: FailedGeneration;
			inputMessages: ModelMessage[];
	  };

export function generateContent({
	context,
	generation,
	metadata,
	onComplete,
	onError,
}: {
	context: GiselleContext;
	generation: RunningGeneration;
	metadata?: GenerationMetadata;
	onComplete?: OnGenerationComplete;
	onError?: OnGenerationError;
}) {
	const logger = context.logger;

	logger.info(`generate content: ${generation.id}`);
	logger.info(`generation metadata: ${JSON.stringify(metadata)}`);

	if (
		isContentGenerationNode(generation.context.operationNode) ||
		isAiAgentNode(generation.context.operationNode)
	) {
		return generateContentV2({
			context,
			generation,
			metadata,
			onComplete,
			onError,
		});
	}
	// biome-ignore lint/correctness/useHookAtTopLevel: it's nodejs use
	return useGenerationExecutor({
		context,
		generation,
		metadata,
		onError,
		execute: async ({
			finishGeneration,
			runningGeneration,
			generationContext,
			setGeneration,
			fileResolver,
			generationContentResolver,
			imageGenerationResolver,
			appEntryResolver,
			dataStoreSchemaResolver,
		}) => {
			const operationNode = generationContext.operationNode;
			if (!isTextGenerationNode(operationNode)) {
				throw new Error("Invalid generation type");
			}

			const languageModel = languageModels.find(
				(lm) => lm.id === operationNode.content.llm.id,
			);
			if (!languageModel) {
				throw new Error("Invalid language model");
			}

			const messages = await buildMessageObject({
				node: operationNode,
				contextNodes: generationContext.sourceNodes,
				fileResolver,
				generationContentResolver,
				imageGenerationResolver,
				appEntryResolver,
				dataStoreSchemaResolver,
			});

			let preparedToolSet: PreparedToolSet = {
				toolSet: {},
				cleanupFunctions: [],
			};

			const githubTool = operationNode.content.tools?.github;
			if (githubTool) {
				let decryptToken: string | undefined;
				switch (githubTool.auth.type) {
					case "pat":
						decryptToken = await context.vault?.decrypt(githubTool.auth.token);
						break;
					case "secret":
						decryptToken = await decryptSecret({
							context,
							secretId: githubTool.auth.secretId,
						});
						break;
					default: {
						const _exhaustiveCheck: never = githubTool.auth;
						throw new Error(`Unhandled auth type: ${_exhaustiveCheck}`);
					}
				}
				const allGitHubTools = githubTools(
					octokit({
						strategy: "personal-access-token",
						personalAccessToken: decryptToken ?? "token",
					}),
				);
				for (const tool of githubTool.tools) {
					if (tool in allGitHubTools) {
						preparedToolSet = {
							...preparedToolSet,
							toolSet: {
								...preparedToolSet.toolSet,
								[tool]: allGitHubTools[tool as keyof typeof allGitHubTools],
							},
						};
					}
				}
			}

			const postgresToolData = operationNode.content.tools?.postgres;
			if (postgresToolData?.secretId) {
				const connectionString = await decryptSecret({
					context,
					secretId: postgresToolData.secretId,
				});
				if (connectionString === undefined) {
					throw new Error("Failed to decrypt secret");
				}

				const postgresTool = createPostgresTools(connectionString);
				for (const tool of postgresToolData.tools) {
					if (tool in postgresTool.toolSet) {
						preparedToolSet = {
							...preparedToolSet,
							toolSet: {
								...preparedToolSet.toolSet,
								[tool]:
									postgresTool.toolSet[
										tool as keyof typeof postgresTool.toolSet
									],
							},
						};
					}
					preparedToolSet = {
						...preparedToolSet,
						cleanupFunctions: [
							...preparedToolSet.cleanupFunctions,
							postgresTool.cleanup,
						],
					};
				}
			}

			if (
				operationNode.content.llm.provider === "openai" &&
				operationNode.content.tools?.openaiWebSearch &&
				hasCapability(languageModel, Capability.OptionalSearchGrounding)
			) {
				preparedToolSet = {
					...preparedToolSet,
					toolSet: {
						...preparedToolSet.toolSet,
						web_search: openai.tools.webSearch(
							operationNode.content.tools.openaiWebSearch,
						),
					},
				};
			}
			if (
				operationNode.content.llm.provider === "google" &&
				operationNode.content.llm.configurations.searchGrounding &&
				hasCapability(languageModel, Capability.OptionalSearchGrounding)
			) {
				preparedToolSet = {
					...preparedToolSet,
					toolSet: {
						...preparedToolSet.toolSet,
						// Cast needed: googleSearch returns Tool<{}, any> but ToolSet expects Tool<any, any>.
						// This is a type mismatch in AI SDK where {} is not assignable to the ToolSet union type.
						google_search: google.tools.googleSearch({}) as Tool<
							// biome-ignore lint/suspicious/noExplicitAny: AI SDK type compatibility workaround
							any,
							// biome-ignore lint/suspicious/noExplicitAny: AI SDK type compatibility workaround
							any
						>,
					},
				};
			}
			if (
				operationNode.content.llm.provider === "google" &&
				hasCapability(languageModel, Capability.UrlContext) &&
				(operationNode.content.llm.configurations.urlContext ?? false)
			) {
				preparedToolSet = {
					...preparedToolSet,
					toolSet: {
						...preparedToolSet.toolSet,
						// Cast needed: urlContext returns Tool<{}, any> but ToolSet expects Tool<any, any>.
						// This is a type mismatch in AI SDK where {} is not assignable to the ToolSet union type.
						url_context: google.tools.urlContext({}) as Tool<
							// biome-ignore lint/suspicious/noExplicitAny: AI SDK type compatibility workaround
							any,
							// biome-ignore lint/suspicious/noExplicitAny: AI SDK type compatibility workaround
							any
						>,
					},
				};
			}

			if (
				operationNode.content.llm.provider === "anthropic" &&
				operationNode.content.tools?.anthropicWebSearch
			) {
				preparedToolSet = {
					...preparedToolSet,
					toolSet: {
						...preparedToolSet.toolSet,
						web_search: anthropic.tools.webSearch_20250305(
							operationNode.content.tools.anthropicWebSearch,
						),
					},
				};
			}

			const providerOptions = getProviderOptions(operationNode.content.llm);

			const model = generationModel(operationNode.content.llm);
			logger.info({
				modelType: typeof model,
				modelProvider: (model as any)?.provider,
				modelId: (model as any)?.modelId,
				specVersion: (model as any)?.specificationVersion,
				constructorName: model?.constructor?.name,
				llmProvider: operationNode.content.llm.provider,
				llmId: operationNode.content.llm.id,
			}, "V1 streamText model debug");
			let generationError: unknown | undefined;
			const textGenerationStartTime = Date.now();

			const abortController = new AbortController();

			const streamTextResult = streamText({
				abortSignal: abortController.signal,
				model,
				providerOptions,
				messages,
				tools: preparedToolSet.toolSet,
				stopWhen: stepCountIs(Object.keys(preparedToolSet.toolSet).length + 1),
				onChunk: async () => {
					const currentGeneration = await getGeneration({
						storage: context.storage,
						generationId: generation.id,
					});
					if (currentGeneration?.status === "cancelled") {
						logger.debug(`${generation.id} will abort`);
						abortController.abort();
					}
				},
				onAbort: () => {
					logger.debug({ generationId: generation.id }, "streamText onAbort");
				},
				onError: ({ error }) => {
					generationError = error;
				},
				onFinish: () => {
					logger.info(
						`Text generation completed in ${Date.now() - textGenerationStartTime}ms`,
					);
				},
				experimental_transform: smoothStream({
					delayInMs: 1000,
					chunking: "line",
				}),
			});
			let uiMessageStreamResult: GenerateContentResult | undefined;
			const uiMessageStream = streamTextResult.toUIMessageStream({
				onFinish: async ({ messages: generateMessages }) => {
					logger.info(
						`Text generation stream completed in ${Date.now() - textGenerationStartTime}ms`,
					);
					const toolCleanupStartTime = Date.now();
					const cleanupResults = await Promise.allSettled(
						preparedToolSet.cleanupFunctions.map((cleanupFunction) =>
							cleanupFunction(),
						),
					);
					cleanupResults.forEach((result, idx) => {
						if (result.status === "rejected") {
							logger.error(
								{ error: result.reason },
								`Cleanup function at index ${idx} failed`,
							);
						} else {
							logger.debug(`Cleanup function at index ${idx} succeeded`);
						}
					});
					logger.info(
						`Tool cleanup completed in ${Date.now() - toolCleanupStartTime}ms`,
					);
					if (generationError) {
						if (AISDKError.isInstance(generationError)) {
							logger.error(generationError, `${generation.id} is failed`);
						}
						const errInfo = AISDKError.isInstance(generationError)
							? {
									name: generationError.name,
									message: generationError.message,
								}
							: {
									name: "UnknownError",
									message:
										generationError instanceof Error
											? generationError.message
											: String(generationError),
								};

						const failedGeneration = {
							...runningGeneration,
							status: "failed",
							failedAt: Date.now(),
							error: errInfo,
						} satisfies FailedGeneration;

						await Promise.all([
							setGeneration(failedGeneration),
							onError?.({
								generation: failedGeneration,
								inputMessages: messages,
							}),
						]);
						uiMessageStreamResult = {
							success: false,
							failedGeneration,
							inputMessages: messages,
						};
					}
					const generationOutputs: GenerationOutput[] = [];
					const generatedTextOutput =
						generationContext.operationNode.outputs.find(
							(output: Output) => output.accessor === "generated-text",
						);
					const textRetrievalStartTime = Date.now();
					const text = await streamTextResult.text;
					logger.info(
						`Text retrieval completed in ${Date.now() - textRetrievalStartTime}ms`,
					);
					if (generatedTextOutput !== undefined) {
						generationOutputs.push({
							type: "generated-text",
							content: text,
							outputId: generatedTextOutput.id,
						});
					}

					const reasoningRetrievalStartTime = Date.now();
					const reasoningText = await streamTextResult.reasoningText;
					logger.info(
						`Reasoning retrieval completed in ${Date.now() - reasoningRetrievalStartTime}ms`,
					);
					const reasoningOutput = generationContext.operationNode.outputs.find(
						(output: Output) => output.accessor === "reasoning",
					);
					if (reasoningOutput !== undefined && reasoningText !== undefined) {
						generationOutputs.push({
							type: "reasoning",
							content: reasoningText,
							outputId: reasoningOutput.id,
						});
					}

					const sourceRetrievalStartTime = Date.now();
					const sources = await streamTextResult.sources;
					logger.info(
						`Source retrieval completed in ${Date.now() - sourceRetrievalStartTime}ms`,
					);
					const sourceOutput = generationContext.operationNode.outputs.find(
						(output: Output) => output.accessor === "source",
					);
					if (sourceOutput !== undefined && sources.length > 0) {
						generationOutputs.push({
							type: "source",
							outputId: sourceOutput.id,
							sources,
						});
					}
					const generationCompletionStartTime = Date.now();
					const result = await finishGeneration({
						inputMessages: messages,
						outputs: generationOutputs,
						usage: await streamTextResult.usage,
						generateMessages: generateMessages,
						providerMetadata: await streamTextResult.providerMetadata,
						onComplete,
					});
					logger.info(
						`Generation completion processing finished in ${Date.now() - generationCompletionStartTime}ms`,
					);

					uiMessageStreamResult = {
						success: true,
						completedGeneration: result.completedGeneration,
						inputMessages: messages,
						outputFileBlobs: result.outputFileBlobs,
						usage: await streamTextResult.usage,
						generateMessages: generateMessages,
						providerMetadata: await streamTextResult.providerMetadata,
					};
				},
			});

			const writer = batchWriter<StreamItem<typeof uiMessageStream>>({
				process: (batch) => {
					logger.debug(`Processing batch with ${batch.length} items`);
					return context.storage.setBlob(
						generationUiMessageChunksPath(generation.id),
						new TextEncoder().encode(
							batch.map((chunk) => JSON.stringify(chunk)).join("\n"),
						),
					);
				},
				preserveItems: true,
				logger,
			});

			let chunkCount = 0;
			for await (const chunk of uiMessageStream) {
				chunkCount++;
				logger.debug(`Adding chunk ${chunkCount}: ${chunk.type}`);
				writer.add(chunk);
			}
			logger.debug(`Stream ended, total chunks: ${chunkCount}`);
			await writer.close();
			logger.debug(`Writer closed`);

			if (uiMessageStreamResult === undefined) {
				throw new Error("UI message stream result is undefined");
			}

			return uiMessageStreamResult;
		},
	});
}

function getProviderOptions(languageModelData: TextGenerationLanguageModelData):
	| {
			anthropic?: AnthropicProviderOptions;
			openai?: OpenAIResponsesProviderOptions;
	  }
	| undefined {
	const languageModel = languageModels.find(
		(model) => model.id === languageModelData.id,
	);
	if (
		languageModel &&
		languageModelData.provider === "anthropic" &&
		languageModelData.configurations.reasoningText &&
		hasCapability(languageModel, Capability.Reasoning)
	) {
		return {
			anthropic: {
				thinking: {
					type: "enabled",
					// Based on Zed's configuration: https://github.com/zed-industries/zed/blob/9d10489607df700c544c48cf09fea82f5d5aacf8/crates/anthropic/src/anthropic.rs#L212
					budgetTokens: 4096,
				},
			},
		};
	}
	if (languageModel && languageModelData.provider === "openai") {
		const openaiOptions: OpenAIResponsesProviderOptions = {};
		if (hasCapability(languageModel, Capability.Reasoning)) {
			openaiOptions.textVerbosity =
				languageModelData.configurations.textVerbosity;
			openaiOptions.reasoningSummary = "auto";
			openaiOptions.reasoningEffort =
				languageModelData.configurations.reasoningEffort;
		}

		return { openai: openaiOptions };
	}
	return undefined;
}

/**
 * Convert platform dot-notation model IDs to Anthropic API dash-notation.
 * The platform stores "claude-haiku-4.5" but the Anthropic API expects "claude-haiku-4-5".
 * On Vercel, the AI Gateway handles this mapping; for self-hosted we do it here.
 */
function toAnthropicApiModelId(platformModelId: string): string {
	return platformModelId.replace(/(\d+)\.(\d+)/, "$1-$2");
}

function generationModel(languageModel: TextGenerationLanguageModelData) {
	const llmProvider = languageModel.provider;
	switch (llmProvider) {
		case "openai":
			return openai(languageModel.id);
		case "anthropic":
			return anthropic(toAnthropicApiModelId(languageModel.id));
		case "google":
			return google(languageModel.id);
		case "perplexity":
			return getPerplexityProvider()(languageModel.id);
		case "nvidia":
			return getNvidiaProvider().chat(languageModel.id);
		case "xai":
			return getXaiProvider()(languageModel.id);
		default: {
			const _exhaustiveCheck: never = llmProvider;
			throw new Error(`Unknown LLM provider: ${_exhaustiveCheck}`);
		}
	}
}

function resolveModel(modelId: string) {
	const [provider, ...rest] = modelId.split("/");
	const model = rest.join("/");
	switch (provider) {
		case "openai":
			return openai(model);
		case "anthropic":
			return anthropic(toAnthropicApiModelId(model));
		case "google":
			return google(model);
		case "perplexity":
			return getPerplexityProvider()(model);
		case "nvidia":
			return getNvidiaProvider().chat(model);
		case "xai":
			return getXaiProvider()(model);
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}

function generateContentV2({
	context,
	generation,
	metadata,
	onComplete,
	onError,
}: {
	context: GiselleContext;
	generation: RunningGeneration;
	metadata?: GenerationMetadata;
	onComplete?: OnGenerationComplete;
	onError?: OnGenerationError;
}) {
	const logger = context.logger;
	// biome-ignore lint/correctness/useHookAtTopLevel: it's nodejs use
	return useGenerationExecutor({
		context,
		generation,
		metadata,
		onError,
		execute: async ({
			finishGeneration,
			runningGeneration,
			generationContext,
			setGeneration,
			fileResolver,
			generationContentResolver,
			imageGenerationResolver,
			appEntryResolver,
			dataStoreSchemaResolver,
		}) => {
			const operationNode = generationContext.operationNode;
			if (
				!isContentGenerationNode(operationNode) &&
				!isAiAgentNode(operationNode)
			) {
				throw new Error("Invalid generation type");
			}

			let messages = await buildMessageObject({
				node: operationNode,
				contextNodes: generationContext.sourceNodes,
				fileResolver,
				generationContentResolver,
				imageGenerationResolver,
				appEntryResolver,
				dataStoreSchemaResolver,
			});

			const { toolSet, cleanupFunctions } = await buildToolSet({
				context,
				generationId: generation.id,
				nodeId: operationNode.id,
				tools: operationNode.content.tools,
			});

			// AI Agent: resolve model from connected chatModel sub-node if available
			let resolvedContent = operationNode.content;
			const integrationToolNodes: Array<{
				pieceName: string;
				actionName: string;
				pieceVersion?: string;
				configuration: Record<string, unknown>;
			}> = [];
			if (isAiAgentNode(operationNode)) {
				// Find all sub-node connections to this AI Agent
				const subNodeConnections = generationContext.connections.filter(
					(conn) =>
						conn.connectionType === "subNode" &&
						conn.inputNode.id === operationNode.id,
				);

				for (const subConn of subNodeConnections) {
					const subNode = generationContext.sourceNodes.find(
						(n) => n.id === subConn.outputNode.id,
					);
					if (!subNode) continue;

					// Chat Model sub-node: override language model
					if (isChatModelNode(subNode)) {
						resolvedContent = {
							...operationNode.content,
							languageModel: subNode.content.languageModel,
						};
						logger.info(
							{ subNodeModelId: subNode.content.languageModel.id },
							"AI Agent using model from connected Chat Model sub-node",
						);
					}

					// Tool sub-nodes: add to tools array
					if (subNode.content.type === "toolNode") {
						const toolContent = subNode.content as {
							type: "toolNode";
							toolType: string;
							builtinToolName?: string;
							pieceName?: string;
							actionName?: string;
							pieceVersion?: string;
							configuration: Record<string, unknown>;
							targetAgentNodeId?: string;
							mcpServerUrl?: string;
							mcpServerCommand?: string;
							mcpServerArgs?: string[];
							reviewToolName?: string;
							reviewToolDescription?: string;
							targetWorkspaceId?: string;
							targetEntryNodeId?: string;
						};

						if (
							toolContent.toolType === "builtinTool" &&
							toolContent.builtinToolName
						) {
							// Add built-in tool to the tools array so buildToolSet picks it up
							resolvedContent = {
								...resolvedContent,
								tools: [
									...resolvedContent.tools,
									{
										name: toolContent.builtinToolName as any,
										configuration: toolContent.configuration,
									},
								],
							};
							logger.info(
								{ toolName: toolContent.builtinToolName },
								"AI Agent adding built-in tool from Tool sub-node",
							);
						} else if (
							toolContent.toolType === "webSearch" &&
							toolContent.builtinToolName
						) {
							resolvedContent = {
								...resolvedContent,
								tools: [
									...resolvedContent.tools,
									{
										name: toolContent.builtinToolName as any,
										configuration: toolContent.configuration,
									},
								],
							};
							logger.info(
								{ toolName: toolContent.builtinToolName },
								"AI Agent adding web search tool from Tool sub-node",
							);
						} else if (
							toolContent.toolType === "codeExecution" &&
							(toolContent as any).codeToolName &&
							(toolContent as any).codeToolCode
						) {
							const codeTool = toolContent as {
								codeToolName: string;
								codeToolDescription?: string;
								codeToolInputSchema?: string;
								codeToolCode: string;
							} & typeof toolContent;
							integrationToolNodes.push({
								pieceName: "__code__",
								actionName: codeTool.codeToolName,
								configuration: {
									__codeExecution: true,
									codeToolName: codeTool.codeToolName,
									codeToolDescription: codeTool.codeToolDescription ?? "",
									codeToolInputSchema: codeTool.codeToolInputSchema ?? "{}",
									codeToolCode: codeTool.codeToolCode,
								},
							});
							logger.info(
								{ toolName: codeTool.codeToolName },
								"AI Agent adding code execution tool from Tool sub-node",
							);
						} else if (
							toolContent.toolType === "integration" &&
							toolContent.pieceName &&
							toolContent.actionName
						) {
							// Collect integration tool sub-nodes for AI SDK tool conversion
							integrationToolNodes.push({
								pieceName: toolContent.pieceName,
								actionName: toolContent.actionName,
								pieceVersion: toolContent.pieceVersion,
								configuration: toolContent.configuration,
							});
							logger.info(
								{
									pieceName: toolContent.pieceName,
									actionName: toolContent.actionName,
								},
								"AI Agent collecting integration tool sub-node",
							);
						} else if (
							toolContent.toolType === "agentTool" &&
							toolContent.targetAgentNodeId
						) {
							// V3: Recursive Agent Tool
							try {
								const { buildAgentTool } = await import(
									"./v2/tools/agent-tool"
								);
								const agentTools = buildAgentTool({
									targetAgentNodeId: toolContent.targetAgentNodeId,
									context,
									generationContext,
									logger,
								});
								Object.assign(toolSet, agentTools);
								logger.info(
									{ targetAgentNodeId: toolContent.targetAgentNodeId },
									"AI Agent adding recursive agent tool from Tool sub-node",
								);
							} catch (error) {
								logger.error(
									{ error: error instanceof Error ? error.message : String(error) },
									"Failed to build agent tool",
								);
							}
						} else if (
							toolContent.toolType === "mcpClient" &&
							(toolContent.mcpServerUrl || toolContent.mcpServerCommand)
						) {
							// V3: MCP Client Tool
							try {
								const { buildMcpClientTools } = await import(
									"./v2/tools/mcp-client-tool"
								);
								const { toolSet: mcpTools, cleanup } = await buildMcpClientTools({
									mcpServerUrl: toolContent.mcpServerUrl,
									mcpServerCommand: toolContent.mcpServerCommand,
									mcpServerArgs: toolContent.mcpServerArgs,
									logger,
								});
								Object.assign(toolSet, mcpTools);
								cleanupFunctions.push(cleanup);
								logger.info(
									{
										url: toolContent.mcpServerUrl,
										command: toolContent.mcpServerCommand,
										toolCount: Object.keys(mcpTools).length,
									},
									"AI Agent adding MCP client tools from Tool sub-node",
								);
							} catch (error) {
								logger.error(
									{ error: error instanceof Error ? error.message : String(error) },
									"Failed to build MCP client tools",
								);
							}
						} else if (toolContent.toolType === "humanReview") {
							// V3: Human Review Tool
							try {
								const { buildHumanReviewTool } = await import(
									"./v2/tools/human-review-tool"
								);
								const reviewTools = buildHumanReviewTool({
									toolName: toolContent.reviewToolName || "request_human_review",
									description: toolContent.reviewToolDescription || "Request human review before proceeding with an action",
									generationId: generation.id,
									context,
									logger,
								});
								Object.assign(toolSet, reviewTools);
								logger.info(
									{ toolName: toolContent.reviewToolName },
									"AI Agent adding human review tool from Tool sub-node",
								);
							} catch (error) {
								logger.error(
									{ error: error instanceof Error ? error.message : String(error) },
									"Failed to build human review tool",
								);
							}
						} else if (
							toolContent.toolType === "subWorkflow" &&
							toolContent.targetWorkspaceId
						) {
							// V3: Sub-Workflow Tool
							try {
								const { buildSubWorkflowTool } = await import(
									"./v2/tools/sub-workflow-tool"
								);
								const subTools = buildSubWorkflowTool({
									targetWorkspaceId: toolContent.targetWorkspaceId,
									targetEntryNodeId: toolContent.targetEntryNodeId,
									context,
									logger,
								});
								Object.assign(toolSet, subTools);
								logger.info(
									{ targetWorkspaceId: toolContent.targetWorkspaceId },
									"AI Agent adding sub-workflow tool from Tool sub-node",
								);
							} catch (error) {
								logger.error(
									{ error: error instanceof Error ? error.message : String(error) },
									"Failed to build sub-workflow tool",
								);
							}
						}
					}
				}
			}

			// Build AI SDK tools from integration tool sub-nodes
			if (integrationToolNodes.length > 0) {
				try {
					const { buildIntegrationTools } = await import(
						"./v2/tools/integration-tool"
					);
					const integrationTools = await buildIntegrationTools({
						integrationNodes: integrationToolNodes,
						context,
					});
					Object.assign(toolSet, integrationTools);
					logger.info(
						{
							count: Object.keys(integrationTools).length,
							toolNames: Object.keys(integrationTools),
						},
						"Added integration tools to AI Agent toolSet",
					);
				} catch (error) {
					logger.error(
						{
							error:
								error instanceof Error
									? error.message
									: String(error),
						},
						"Failed to build integration tools",
					);
				}
			}

			const callOptions =
				transformGiselleLanguageModelToAiSdkLanguageModelCallOptions(
					resolvedContent,
				);

			const abortController = new AbortController();
			let generationError: unknown | undefined;
			const textGenerationStartTime = Date.now();

			const v2Model = resolveModel(resolvedContent.languageModel.id);
			logger.info({
				modelType: typeof v2Model,
				modelProvider: (v2Model as any)?.provider,
				modelId: (v2Model as any)?.modelId,
				specVersion: (v2Model as any)?.specificationVersion,
				constructorName: v2Model?.constructor?.name,
				languageModelId: resolvedContent.languageModel.id,
			}, "V2 streamText model debug");

			// AI Agent: extract system prompt and maxSteps
			let agentSystemPrompt =
				isAiAgentNode(operationNode) && operationNode.content.systemPrompt
					? operationNode.content.systemPrompt
					: undefined;
			const agentMaxSteps =
				isAiAgentNode(operationNode)
					? operationNode.content.maxSteps ?? 30
					: undefined;

			// AI Agent: structured output — inject JSON schema into system prompt
			if (
				isAiAgentNode(operationNode) &&
				operationNode.content.structuredOutput?.enabled &&
				operationNode.content.structuredOutput.schema.trim()
			) {
				const structuredOutputInstruction = `\n\nIMPORTANT: Your final response MUST be valid JSON matching this schema:\n\`\`\`json\n${operationNode.content.structuredOutput.schema.trim()}\n\`\`\`\nDo NOT include any text before or after the JSON in your final response. Only output the raw JSON object.`;
				agentSystemPrompt = agentSystemPrompt
					? agentSystemPrompt + structuredOutputInstruction
					: structuredOutputInstruction;
			}

			// AI Agent: load memory from connected memoryNode sub-node if available
			let memoryConfig: {
				sessionKey: string;
				contextWindowLength: number;
			} | null = null;

			if (isAiAgentNode(operationNode)) {
				const subNodeConns = generationContext.connections.filter(
					(conn) =>
						conn.connectionType === "subNode" &&
						conn.inputNode.id === operationNode.id,
				);
				for (const subConn of subNodeConns) {
					const subNode = generationContext.sourceNodes.find(
						(n) => n.id === subConn.outputNode.id,
					);
					if (subNode?.content.type === "memoryNode") {
						const memContent = subNode.content as {
							type: "memoryNode";
							memoryType: string;
							contextWindowLength: number;
							sessionScope: "agent" | "workspace";
						};
						const sessionKey = buildSessionKey(
							generationContext.origin.workspaceId ?? "",
							operationNode.id,
							memContent.sessionScope,
						);
						memoryConfig = {
							sessionKey,
							contextWindowLength: memContent.contextWindowLength,
						};

						// Load previous memory messages and prepend them
						const memoryMessages = await loadMemory(
							context.storage,
							sessionKey,
							memContent.contextWindowLength,
						);
						if (memoryMessages.length > 0) {
							const historicalMessages = memoryMessages.map((m) => ({
								role: m.role as "user" | "assistant" | "system",
								content: m.content,
							}));
							// Prepend historical messages before current messages
							messages = [...historicalMessages, ...messages];
							logger.info(
								{
									memoryMessageCount: memoryMessages.length,
									sessionKey,
								},
								"AI Agent loaded memory from connected Memory sub-node",
							);
						}
						break;
					}
				}
			}

			const streamTextResult = streamText({
				...callOptions,
				abortSignal: abortController.signal,
				model: v2Model,
				messages,
				...(agentSystemPrompt ? { system: agentSystemPrompt } : {}),
				...(agentMaxSteps ? { maxSteps: agentMaxSteps } : {}),
				tools: toolSet,
				stopWhen: ({ steps }) => {
					logger.debug(steps, "stopWhen");
					const lastStep = steps[steps.length - 1];
					return lastStep.finishReason !== "tool-calls";
				},
				onChunk: async () => {
					const currentGeneration = await getGeneration({
						storage: context.storage,
						generationId: generation.id,
					});
					if (currentGeneration?.status === "cancelled") {
						logger.debug(`${generation.id} will abort`);
						abortController.abort();
					}
				},
				onStepFinish: async (result) => {
					const toolCalls = result.toolCalls?.map((tc: { toolName: string }) => tc.toolName) ?? [];
					logger.info(
						{
							finishReason: result.finishReason,
							toolCalls,
							usage: result.usage,
						},
						"AI Agent step completed",
					);

					// V3: Detect human review marker in tool results
					for (const toolResult of result.toolResults ?? []) {
						try {
							const parsed = JSON.parse(String(toolResult.output));
							if (parsed.__human_review_requested__) {
								logger.info(
									{
										action: parsed.action,
										reason: parsed.reason,
										generationId: generation.id,
									},
									"Human review requested, pausing generation",
								);
								// Transition generation to awaiting_review
								await internalSetGeneration({
									storage: context.storage,
									generation: {
										id: generation.id,
										context: generation.context,
										status: "awaiting_review",
										createdAt: generation.createdAt,
										queuedAt: (generation as any).queuedAt ?? generation.startedAt,
										startedAt: generation.startedAt,
										awaitingReviewAt: Date.now(),
										messages: generation.messages,
										reviewContext: {
											toolCallId: toolResult.toolCallId,
											proposedAction: parsed.action,
											proposedArgs: parsed.details ?? {},
											reviewPrompt: parsed.reason,
										},
									} satisfies AwaitingReviewGeneration,
									logger,
								});
								// Abort the stream to stop further processing
								abortController.abort();
								return;
							}
						} catch {
							/* not JSON, ignore */
						}
					}
				},
				onAbort: () => {
					logger.debug({ generationId: generation.id }, "streamText onAbort");
				},
				onError: ({ error }) => {
					generationError = error;
				},
				onFinish: () => {
					logger.info(
						`Text generation completed in ${Date.now() - textGenerationStartTime}ms`,
					);
				},
				experimental_transform: smoothStream({
					delayInMs: 1000,
					chunking: "line",
				}),
			});
			let uiMessageStreamResult: GenerateContentResult | undefined;
			const uiMessageStream = streamTextResult.toUIMessageStream({
				onFinish: async ({ messages: generateMessages }) => {
					logger.info(
						`Text generation stream completed in ${Date.now() - textGenerationStartTime}ms`,
					);
					const toolCleanupStartTime = Date.now();
					const cleanupResults = await Promise.allSettled(
						cleanupFunctions.map((cleanupFunction) => cleanupFunction()),
					);
					cleanupResults.forEach((result, idx) => {
						if (result.status === "rejected") {
							logger.error(
								{ error: result.reason },
								`Cleanup function at index ${idx} failed`,
							);
						} else {
							logger.debug(`Cleanup function at index ${idx} succeeded`);
						}
					});
					logger.info(
						`Tool cleanup completed in ${Date.now() - toolCleanupStartTime}ms`,
					);
					if (generationError) {
						if (AISDKError.isInstance(generationError)) {
							logger.error(generationError, `${generation.id} is failed`);
						}
						// Log fallback model availability when primary model fails (V2 AI Agent path)
						if (
							isAiAgentNode(operationNode) &&
							operationNode.content.fallbackModel?.enabled &&
							operationNode.content.fallbackModel?.id
						) {
							logger.warn(
								{
									primaryModel: resolvedContent.languageModel.id,
									fallbackModel: operationNode.content.fallbackModel.id,
									generationId: generation.id,
								},
								"Primary model failed. Fallback model is configured — automatic retry will be available in a future update.",
							);
						}
						const errInfo = AISDKError.isInstance(generationError)
							? {
									name: generationError.name,
									message: generationError.message,
								}
							: {
									name: "UnknownError",
									message:
										generationError instanceof Error
											? generationError.message
											: String(generationError),
								};

						const failedGeneration = {
							...runningGeneration,
							status: "failed",
							failedAt: Date.now(),
							error: errInfo,
						} satisfies FailedGeneration;

						await Promise.all([
							setGeneration(failedGeneration),
							onError?.({
								generation: failedGeneration,
								inputMessages: messages,
							}),
						]);
						uiMessageStreamResult = {
							success: false,
							failedGeneration,
							inputMessages: messages,
						};
					}
					const generationOutputs: GenerationOutput[] = [];
					const generatedTextOutput =
						generationContext.operationNode.outputs.find(
							(output: Output) => output.accessor === "generated-text",
						);
					const textRetrievalStartTime = Date.now();
					const text = await streamTextResult.text;
					logger.info(
						`Text retrieval completed in ${Date.now() - textRetrievalStartTime}ms`,
					);
					if (generatedTextOutput !== undefined) {
						generationOutputs.push({
							type: "generated-text",
							content: text,
							outputId: generatedTextOutput.id,
						});
					}

					const reasoningRetrievalStartTime = Date.now();
					const reasoningText = await streamTextResult.reasoningText;
					logger.info(
						`Reasoning retrieval completed in ${Date.now() - reasoningRetrievalStartTime}ms`,
					);
					const reasoningOutput = generationContext.operationNode.outputs.find(
						(output: Output) => output.accessor === "reasoning",
					);
					if (reasoningOutput !== undefined && reasoningText !== undefined) {
						generationOutputs.push({
							type: "reasoning",
							content: reasoningText,
							outputId: reasoningOutput.id,
						});
					}

					const sourceRetrievalStartTime = Date.now();
					const sources = await streamTextResult.sources;
					logger.info(
						`Source retrieval completed in ${Date.now() - sourceRetrievalStartTime}ms`,
					);
					const sourceOutput = generationContext.operationNode.outputs.find(
						(output: Output) => output.accessor === "source",
					);
					if (sourceOutput !== undefined && sources.length > 0) {
						generationOutputs.push({
							type: "source",
							outputId: sourceOutput.id,
							sources,
						});
					}

					// Save memory if memoryNode is connected (V2 AI Agent path)
					if (memoryConfig && text) {
						try {
							const lastUserMsg = messages.findLast(
								(m: { role: string }) => m.role === "user",
							);
							const userContent =
								lastUserMsg && "content" in lastUserMsg
									? typeof lastUserMsg.content === "string"
										? lastUserMsg.content
										: JSON.stringify(lastUserMsg.content)
									: "";
							await saveMemory(
								context.storage,
								memoryConfig.sessionKey,
								[
									...(userContent
										? [
												{
													role: "user" as const,
													content: userContent,
													timestamp: Date.now(),
												},
											]
										: []),
									{
										role: "assistant" as const,
										content: text,
										timestamp: Date.now(),
									},
								],
								memoryConfig.contextWindowLength * 2,
							);
							logger.info(
								{ sessionKey: memoryConfig.sessionKey },
								"AI Agent saved memory after generation",
							);
						} catch (memErr) {
							logger.warn(
								{ error: memErr },
								"Failed to save memory after generation",
							);
						}
					}

					const generationCompletionStartTime = Date.now();
					const result = await finishGeneration({
						inputMessages: messages,
						outputs: generationOutputs,
						usage: await streamTextResult.usage,
						generateMessages: generateMessages,
						providerMetadata: await streamTextResult.providerMetadata,
						onComplete,
					});
					logger.info(
						`Generation completion processing finished in ${Date.now() - generationCompletionStartTime}ms`,
					);

					uiMessageStreamResult = {
						success: true,
						completedGeneration: result.completedGeneration,
						inputMessages: messages,
						outputFileBlobs: result.outputFileBlobs,
						usage: await streamTextResult.usage,
						generateMessages: generateMessages,
						providerMetadata: await streamTextResult.providerMetadata,
					};
				},
			});

			const writer = batchWriter<StreamItem<typeof uiMessageStream>>({
				process: (batch) => {
					logger.debug(`Processing batch with ${batch.length} items`);
					return context.storage.setBlob(
						generationUiMessageChunksPath(generation.id),
						new TextEncoder().encode(
							batch.map((chunk) => JSON.stringify(chunk)).join("\n"),
						),
					);
				},
				preserveItems: true,
				logger,
			});

			let chunkCount = 0;
			for await (const chunk of uiMessageStream) {
				chunkCount++;
				logger.debug(`Adding chunk ${chunkCount}: ${chunk.type}`);
				writer.add(chunk);
			}
			logger.debug(`Stream ended, total chunks: ${chunkCount}`);
			await writer.close();
			logger.debug(`Writer closed`);

			if (uiMessageStreamResult === undefined) {
				throw new Error("UI message stream result is undefined");
			}

			return uiMessageStreamResult;
		},
	});
}
