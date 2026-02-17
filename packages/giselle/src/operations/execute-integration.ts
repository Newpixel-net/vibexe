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
				if (isAppEntryNode(sourceNode)) {
					try {
						const parts = await args.appEntryResolver(
							connection.outputNode.id,
							connection.outputId,
						);
						if (parts.length > 0) {
							const textParts = parts.filter((p) => p.type === "text");
							if (textParts.length > 0) {
								inputs[input.accessor] = textParts
									.map((p) => p.text)
									.join(" ");
							}
						}
					} catch (err) {
						console.error("appEntryResolver failed for integration node:", err);
					}
					break;
				}

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

/**
 * Resolve a dotted path like "message.content.title" against an object.
 */
function resolvePath(obj: unknown, path: string): unknown {
	const parts = path.split(".");
	let current = obj;
	for (const part of parts) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

/**
 * Search for a key anywhere in a nested object (depth-first).
 */
function findByLeafKey(obj: unknown, leafKey: string): unknown {
	if (obj == null || typeof obj !== "object") return undefined;
	const record = obj as Record<string, unknown>;
	if (leafKey in record) return record[leafKey];
	for (const value of Object.values(record)) {
		if (value && typeof value === "object") {
			const found = findByLeafKey(value, leafKey);
			if (found !== undefined) return found;
		}
	}
	return undefined;
}

/**
 * Resolve [NodeName.field.path] expression placeholders in all string values
 * within a config object. Mutates the config in-place.
 *
 * These placeholders are created by the N8N converter from expressions like
 * {{ $('NodeName').item.json.field }}. We resolve them against all available
 * input data by trying: (1) exact dotted path, (2) leaf-key fallback.
 */
function resolveConfigExpressions(
	config: Record<string, unknown>,
	resolvedInputs: Record<string, string>,
): void {
	// Parse all inputs as JSON where possible for field extraction
	const parsedInputs: unknown[] = [];
	for (const value of Object.values(resolvedInputs)) {
		try {
			parsedInputs.push(JSON.parse(value));
		} catch {
			parsedInputs.push(value);
		}
	}

	if (parsedInputs.length === 0) return;

	const resolveField = (fieldPath: string): string | undefined => {
		for (const parsed of parsedInputs) {
			const exact = resolvePath(parsed, fieldPath);
			if (exact !== undefined) {
				return typeof exact === "string" ? exact : JSON.stringify(exact);
			}
		}
		const leafKey = fieldPath.split(".").pop() || fieldPath;
		for (const parsed of parsedInputs) {
			const found = findByLeafKey(parsed, leafKey);
			if (found !== undefined) {
				return typeof found === "string" ? found : JSON.stringify(found);
			}
		}
		return undefined;
	};

	// Recursively scan config for string values containing [Something.field] patterns
	function resolveInObject(obj: Record<string, unknown>): void {
		for (const [key, value] of Object.entries(obj)) {
			if (typeof value === "string" && value.includes("[")) {
				let resolved = value;
				// Replace [timestamp] with ISO date string
				resolved = resolved.replace(/\[timestamp\]/g, new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14));
				// Replace [execution.id] with a run ID
				resolved = resolved.replace(/\[execution\.id\]/g, `run-${Date.now()}`);
				// Replace [NodeName.field.path] and [input.field] patterns
				resolved = resolved.replace(
					/\[([^\]]+\.[\w.]+)\]/g,
					(match, fullPath: string) => {
						// Strip node name prefix: "Create Video.request_id" → "request_id"
						const dotIndex = fullPath.indexOf(".");
						if (dotIndex === -1) return match;
						const fieldPath = fullPath.substring(dotIndex + 1);
						return resolveField(fieldPath) ?? match;
					},
				);
				obj[key] = resolved;
			} else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
				resolveInObject(value as Record<string, unknown>);
			}
		}
	}

	resolveInObject(config);
}

/**
 * Built-in HTML template engine for n8n-nodes-base.html nodes.
 * Handles [input.xxx] and {{ $json.xxx }} template expressions.
 * Uses smart path resolution: tries exact path first, then leaf-key fallback.
 */
function executeHtmlTemplate(
	config: Record<string, unknown>,
	resolvedInputs: Record<string, string>,
): string {
	// Get template from config — could be under "html" key or any string value
	let template =
		(config.html as string) ||
		Object.values(config).find((v) => typeof v === "string" && v.includes("<")) as string ||
		"";

	if (!template) {
		return JSON.stringify({
			error: true,
			message: "HTML template node: no template found in configuration",
		});
	}

	// Parse all inputs as JSON where possible
	const parsedInputs: unknown[] = [];
	for (const value of Object.values(resolvedInputs)) {
		try {
			parsedInputs.push(JSON.parse(value));
		} catch {
			parsedInputs.push(value);
		}
	}

	// Resolver: try exact path, then leaf-key fallback
	function resolveExpression(path: string): string | undefined {
		for (const parsed of parsedInputs) {
			// 1. Try exact dotted path
			const exact = resolvePath(parsed, path);
			if (exact !== undefined) {
				return typeof exact === "string" ? exact : JSON.stringify(exact);
			}
		}
		// 2. Try leaf key (last segment) — handles N8N→Vibexe path mismatches
		const leafKey = path.split(".").pop() || path;
		for (const parsed of parsedInputs) {
			const found = findByLeafKey(parsed, leafKey);
			if (found !== undefined) {
				return typeof found === "string" ? found : JSON.stringify(found);
			}
		}
		return undefined;
	}

	// Replace [input.xxx.yyy] patterns (Vibexe-translated expressions)
	template = template.replace(
		/\[input(?:\.([^\]]+))?\]/g,
		(match, path) => {
			if (!path) {
				return Object.values(resolvedInputs)[0] || match;
			}
			return resolveExpression(path) ?? match;
		},
	);

	// Replace {{ $json.xxx }} patterns (untranslated N8N expressions)
	template = template.replace(
		/\{\{\s*\$json(?:\.([^\s}]+))?\s*\}\}/g,
		(match, path) => {
			if (!path) {
				return Object.values(resolvedInputs)[0] || match;
			}
			return resolveExpression(path) ?? match;
		},
	);

	return template;
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

	// Use structured-data for object/array results so raw data (including
	// binary references, file paths, etc.) flows through the DAG without
	// being stringified. Only use generated-text for plain string results.
	if (typeof result === "string") {
		return [
			{
				type: "generated-text",
				content: result,
				outputId: resultOutput.id,
			},
		];
	}

	return [
		{
			type: "structured-data",
			data: result,
			outputId: resultOutput.id,
		} as GenerationOutput,
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

			// Merge configuration with resolved inputs (inputs override config)
			const mergedConfig: Record<string, unknown> = {
				...configuration,
				...resolvedInputs,
			};

			// Resolve [NodeName.field] expression placeholders in string config values.
			// These are created by the N8N converter from {{ $('NodeName').item.json.field }}
			// expressions. We try to resolve them against all available input data.
			resolveConfigExpressions(mergedConfig, resolvedInputs);

			let result: unknown;
			const warnings: string[] = [];

			// Built-in handlers for N8N node types that don't map to Activepieces pieces
			if (pieceName === "html") {
				// N8N HTML node: template interpolation engine
				result = executeHtmlTemplate(
					configuration as Record<string, unknown>,
					resolvedInputs,
				);
			} else try {
				// Dynamic import of activepieces adapter
				const { executePieceAction, resolveAuth, ensureFreshToken } =
					await import("@giselles-ai/activepieces-adapter/server");

				// Resolve credentials if available, with automatic token refresh
				let auth: unknown = null;
				const credentialId = operationNode.content.credentialId;
				if (credentialId && args.context.resolveIntegrationCredential) {
					const rawCred =
						await args.context.resolveIntegrationCredential(credentialId);
					if (rawCred) {
						// Cast authType from string to the expected union type
						const credential = rawCred as {
							authType: "oauth2" | "secret_text" | "basic" | "custom";
							config: Record<string, unknown>;
						};
						// Refresh expired OAuth2 tokens before execution
						try {
							const { credential: freshCred, refreshed } =
								await ensureFreshToken(credential);
							if (refreshed && args.context.updateIntegrationCredential) {
								await args.context.updateIntegrationCredential(
									credentialId,
									freshCred.config,
								);
							}
							auth = resolveAuth(freshCred);
						} catch (refreshError) {
							console.error("Token refresh failed:", refreshError);
							warnings.push(
								`OAuth2 token refresh failed for ${pieceName}. You may need to re-authorize the credential.`,
							);
							// Use original credential despite refresh failure
							auth = resolveAuth(credential);
						}
					}
				}

				// Build a connection resolver that looks up credentials by piece name
				const connectionResolver = args.context.resolveCredentialByPieceName
					? async (key: string) => {
							const rawCred =
								await args.context.resolveCredentialByPieceName!(key);
							if (rawCred) {
								return resolveAuth(rawCred as {
									authType: "oauth2" | "secret_text" | "basic" | "custom";
									config: Record<string, unknown>;
								});
							}
							return null;
						}
					: undefined;

				// For HTTP piece with secret_text credential, inject Authorization header
				if (
					(pieceName === "http" || pieceName === "http-oauth2") &&
					auth &&
					typeof auth === "string"
				) {
					const existing = mergedConfig.headers;
					const headers: Record<string, string> =
						existing && typeof existing === "object" && !Array.isArray(existing)
							? { ...(existing as Record<string, string>) }
							: {};
					if (!headers.Authorization && !headers.authorization) {
						headers.Authorization = `Bearer ${auth}`;
						mergedConfig.headers = headers;
					}
				}

				// For HTTP piece, wrap body in { data: <content> } structure
				// The Activepieces HTTP piece defines `body` as DynamicProperties
				// which returns { data: Property.Json() }, so it accesses body['data']
				if (
					(pieceName === "http" || pieceName === "http-oauth2") &&
					mergedConfig.body_type &&
					mergedConfig.body_type !== "none" &&
					mergedConfig.body !== undefined
				) {
					const rawBody = mergedConfig.body;
					// If body is already wrapped in { data: ... }, leave it alone
					if (
						typeof rawBody === "object" &&
						rawBody !== null &&
						"data" in (rawBody as Record<string, unknown>)
					) {
						// Already in correct format
					} else {
						// Parse JSON string if needed, then wrap in { data: ... }
						let bodyContent = rawBody;
						if (
							mergedConfig.body_type === "json" &&
							typeof rawBody === "string"
						) {
							try {
								bodyContent = JSON.parse(rawBody);
							} catch {
								// Keep as string if parsing fails
							}
						}
						mergedConfig.body = { data: bodyContent };
					}
				}

				// Create persistent store if available
				const store = args.context.createIntegrationStore?.();

				result = await executePieceAction({
					pieceName,
					actionName,
					pieceVersion,
					properties: mergedConfig,
					auth,
					connectionResolver,
					store,
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

			// Append warnings to result if any
			if (warnings.length > 0) {
				if (typeof result === "object" && result !== null) {
					(result as Record<string, unknown>)._warnings = warnings;
				} else {
					result = {
						data: result,
						_warnings: warnings,
					};
				}
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
