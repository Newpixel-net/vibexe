/**
 * Creates AI SDK tool() definitions from Activepieces integration pieces.
 *
 * Converts piece action property schemas to Zod schemas so the AI model
 * can call integration tools during generation (e.g., "send a Slack message").
 */

import type { ToolSet } from "ai";
import { tool as defineTool } from "ai";
import z from "zod/v4";
import type { GiselleContext } from "../../../types";

interface PropertyInfo {
	name: string;
	displayName: string;
	description: string;
	type: string;
	required: boolean;
	defaultValue?: unknown;
	options?: { label: string; value: unknown }[];
}

/**
 * Convert an Activepieces PropertyInfo type to a Zod schema.
 */
function propertyInfoToZod(prop: PropertyInfo): z.ZodTypeAny {
	let schema: z.ZodTypeAny;

	switch (prop.type) {
		case "SHORT_TEXT":
		case "LONG_TEXT":
		case "DATE_TIME":
			schema = z.string().describe(prop.description || prop.displayName);
			break;
		case "NUMBER":
			schema = z.number().describe(prop.description || prop.displayName);
			break;
		case "CHECKBOX":
			schema = z.boolean().describe(prop.description || prop.displayName);
			break;
		case "STATIC_DROPDOWN": {
			if (prop.options && prop.options.length > 0) {
				// Use string with description listing the options
				const optionsList = prop.options
					.map((o) => `"${o.value}" (${o.label})`)
					.join(", ");
				schema = z
					.string()
					.describe(
						`${prop.description || prop.displayName}. Options: ${optionsList}`,
					);
			} else {
				schema = z.string().describe(prop.description || prop.displayName);
			}
			break;
		}
		case "JSON":
			schema = z
				.string()
				.describe(
					`${prop.description || prop.displayName} (JSON string)`,
				);
			break;
		case "ARRAY":
		case "MULTI_SELECT_DROPDOWN":
			schema = z
				.array(z.string())
				.describe(prop.description || prop.displayName);
			break;
		case "OBJECT":
			schema = z
				.record(z.string(), z.any())
				.describe(prop.description || prop.displayName);
			break;
		case "DYNAMIC":
			schema = z
				.record(z.string(), z.any())
				.describe(prop.description || prop.displayName);
			break;
		default:
			// Fallback: treat as string
			schema = z.string().describe(prop.description || prop.displayName);
			break;
	}

	if (!prop.required) {
		schema = schema.optional();
	}

	return schema;
}

/**
 * Build AI SDK tools from integration tool sub-nodes connected to an AI Agent.
 *
 * For each integration toolNode:
 * 1. Inspects the piece to get action property schemas
 * 2. Converts to Zod schema (excluding pre-configured properties)
 * 3. Creates an AI SDK tool() with execute function that calls executePieceAction()
 */
export async function buildIntegrationTools({
	integrationNodes,
	context,
}: {
	integrationNodes: Array<{
		pieceName: string;
		actionName: string;
		pieceVersion?: string;
		configuration: Record<string, unknown>;
	}>;
	context: GiselleContext;
}): Promise<ToolSet> {
	const toolSet: ToolSet = {};

	for (const node of integrationNodes) {
		// Handle code execution tools (not Activepieces pieces)
		if (node.pieceName === "__code__" && node.configuration.__codeExecution) {
			try {
				const config = node.configuration as {
					codeToolName: string;
					codeToolDescription: string;
					codeToolInputSchema: string;
					codeToolCode: string;
				};
				const toolName = config.codeToolName;

				// Parse user-defined JSON schema into Zod
				let inputSchema: z.ZodTypeAny = z.object({});
				try {
					const jsonSchema = JSON.parse(config.codeToolInputSchema || "{}");
					if (jsonSchema.properties) {
						const fields: Record<string, z.ZodTypeAny> = {};
						for (const [key, prop] of Object.entries(
							jsonSchema.properties as Record<string, { type?: string; description?: string }>,
						)) {
							const desc = prop.description ?? key;
							switch (prop.type) {
								case "number":
								case "integer":
									fields[key] = z.number().describe(desc);
									break;
								case "boolean":
									fields[key] = z.boolean().describe(desc);
									break;
								case "array":
									fields[key] = z.array(z.any()).describe(desc);
									break;
								case "object":
									fields[key] = z.record(z.string(), z.any()).describe(desc);
									break;
								default:
									fields[key] = z.string().describe(desc);
									break;
							}
						}
						// Mark required fields
						const required = (jsonSchema.required as string[]) ?? [];
						for (const key of Object.keys(fields)) {
							if (!required.includes(key)) {
								fields[key] = fields[key].optional();
							}
						}
						inputSchema = z.object(fields);
					}
				} catch {
					context.logger.warn(
						{ toolName },
						"Failed to parse code tool input schema, using empty schema",
					);
				}

				toolSet[toolName] = defineTool({
					description: config.codeToolDescription || `Custom code tool: ${toolName}`,
					inputSchema: inputSchema as z.ZodObject<Record<string, z.ZodTypeAny>>,
					execute: async (params: Record<string, unknown>) => {
						try {
							// Execute user code in a sandboxed Function
							const fn = new Function("params", config.codeToolCode);
							const result = await fn(params);
							return typeof result === "string"
								? result
								: JSON.stringify(result, null, 2);
						} catch (error) {
							const msg = error instanceof Error ? error.message : String(error);
							context.logger.error(
								{ error: msg, toolName },
								"Code tool execution failed",
							);
							return JSON.stringify({
								error: true,
								message: `Code tool "${toolName}" failed: ${msg}`,
							});
						}
					},
				});

				context.logger.info(
					{ toolName },
					"Created code execution tool for AI Agent",
				);
			} catch (error) {
				context.logger.error(
					{
						toolName: node.actionName,
						error: error instanceof Error ? error.message : String(error),
					},
					"Failed to create code tool, skipping",
				);
			}
			continue;
		}

		try {
			// Dynamic import to avoid pulling activepieces-adapter into every build
			const { inspectPiece } = await import(
				"@giselles-ai/activepieces-adapter/server"
			);

			const pieceInfo = await inspectPiece(node.pieceName);
			const action = pieceInfo.actions.find(
				(a: { name: string }) => a.name === node.actionName,
			);
			if (!action) {
				context.logger.warn(
					{ pieceName: node.pieceName, actionName: node.actionName },
					"Integration tool action not found, skipping",
				);
				continue;
			}

			// Build Zod schema from action props, excluding pre-configured fields
			const schemaFields: Record<string, z.ZodTypeAny> = {};
			for (const [key, prop] of Object.entries(
				action.props as Record<string, PropertyInfo>,
			)) {
				// Skip properties already set in static configuration
				if (
					node.configuration[key] !== undefined &&
					node.configuration[key] !== ""
				) {
					continue;
				}
				schemaFields[key] = propertyInfoToZod(prop);
			}

			const inputSchema = z.object(schemaFields);

			const toolName = `${node.pieceName}_${node.actionName}`;
			toolSet[toolName] = defineTool({
				description: `${pieceInfo.displayName}: ${action.displayName}. ${action.description}`,
				inputSchema,
				execute: async (params: Record<string, unknown>) => {
					try {
						const {
							executePieceAction,
							resolveAuth,
							ensureFreshToken,
						} = await import(
							"@giselles-ai/activepieces-adapter/server"
						);

						// Resolve credentials by piece name
						let auth: unknown = null;
						if (context.resolveCredentialByPieceName) {
							const rawCred =
								await context.resolveCredentialByPieceName(
									node.pieceName,
								);
							if (rawCred) {
								const credential = rawCred as {
									authType:
										| "oauth2"
										| "secret_text"
										| "basic"
										| "custom";
									config: Record<string, unknown>;
								};
								try {
									const { credential: freshCred, refreshed } =
										await ensureFreshToken(credential);
									if (
										refreshed &&
										context.updateIntegrationCredential
									) {
										// Can't update without credentialId — just use fresh token
										context.logger.info(
											"OAuth2 token refreshed for integration tool",
										);
									}
									auth = resolveAuth(freshCred);
								} catch {
									auth = resolveAuth(credential);
								}
							}
						}

						// Merge static configuration with AI-provided params
						const mergedProps = {
							...node.configuration,
							...params,
						};

						const result = await executePieceAction({
							pieceName: node.pieceName,
							actionName: node.actionName,
							pieceVersion: node.pieceVersion ?? "latest",
							properties: mergedProps,
							auth,
							store: context.createIntegrationStore?.(),
							connectionResolver:
								context.resolveCredentialByPieceName
									? async (key: string) => {
											const rawCred =
												await context.resolveCredentialByPieceName!(
													key,
												);
											if (rawCred) {
												return resolveAuth(
													rawCred as {
														authType:
															| "oauth2"
															| "secret_text"
															| "basic"
															| "custom";
														config: Record<
															string,
															unknown
														>;
													},
												);
											}
											return null;
										}
									: undefined,
						});

						// Return as string for the AI model
						return typeof result === "string"
							? result
							: JSON.stringify(result, null, 2);
					} catch (error) {
						const msg =
							error instanceof Error
								? error.message
								: String(error);
						context.logger.error(
							{ error: msg, pieceName: node.pieceName },
							"Integration tool execution failed",
						);
						return JSON.stringify({
							error: true,
							message: `Failed to execute ${node.pieceName}/${node.actionName}: ${msg}`,
						});
					}
				},
			});

			context.logger.info(
				{
					toolName,
					propsCount: Object.keys(schemaFields).length,
					configuredCount: Object.keys(node.configuration).length,
				},
				"Created integration tool for AI Agent",
			);
		} catch (error) {
			context.logger.error(
				{
					pieceName: node.pieceName,
					error:
						error instanceof Error ? error.message : String(error),
				},
				"Failed to create integration tool, skipping",
			);
		}
	}

	return toolSet;
}
