/**
 * MCP Client Tool — connects to an external MCP server and exposes its tools
 * to the AI Agent.
 *
 * Supports SSE transport (via URL) or stdio transport (via command + args).
 * Discovers available tools via client.listTools() and creates AI SDK tool()
 * wrappers for each one.
 */

import type { ToolSet } from "ai";
import { tool as defineTool } from "ai";
import z from "zod/v4";
import type { GiselleContext } from "../../../types";

/**
 * Build AI SDK tools from an MCP server connection.
 *
 * Returns both the toolSet and a cleanup function that disconnects the MCP client.
 */
export async function buildMcpClientTools({
	mcpServerUrl,
	mcpServerCommand,
	mcpServerArgs,
	logger,
}: {
	mcpServerUrl?: string;
	mcpServerCommand?: string;
	mcpServerArgs?: string[];
	logger: GiselleContext["logger"];
}): Promise<{ toolSet: ToolSet; cleanup: () => Promise<void> }> {
	const toolSet: ToolSet = {};

	try {
		// Dynamic import to avoid pulling MCP SDK into every build
		const { Client } = await import(
			"@modelcontextprotocol/sdk/client/index.js"
		);
		const { SSEClientTransport } = await import(
			"@modelcontextprotocol/sdk/client/sse.js"
		);
		const { StdioClientTransport } = await import(
			"@modelcontextprotocol/sdk/client/stdio.js"
		);

		const client = new Client({
			name: "vibexe-agent",
			version: "1.0.0",
		});

		// Connect via SSE or stdio
		if (mcpServerUrl) {
			const transport = new SSEClientTransport(new URL(mcpServerUrl));
			await client.connect(transport);
			logger.info({ url: mcpServerUrl }, "MCP client connected via SSE");
		} else if (mcpServerCommand) {
			const transport = new StdioClientTransport({
				command: mcpServerCommand,
				args: mcpServerArgs ?? [],
			});
			await client.connect(transport);
			logger.info(
				{ command: mcpServerCommand },
				"MCP client connected via stdio",
			);
		} else {
			logger.warn("MCP client: no URL or command provided");
			return { toolSet: {}, cleanup: async () => {} };
		}

		// Discover available tools
		const toolsList = await client.listTools();
		const mcpTools = toolsList.tools ?? [];

		logger.info(
			{ toolCount: mcpTools.length },
			"MCP client discovered tools",
		);

		for (const mcpTool of mcpTools) {
			const toolName = `mcp_${mcpTool.name}`;

			// Convert MCP JSON Schema to a Zod schema
			// MCP tools use standard JSON Schema for inputSchema
			const inputSchema = jsonSchemaToZod(mcpTool.inputSchema ?? {});

			toolSet[toolName] = defineTool({
				description:
					mcpTool.description ?? `MCP tool: ${mcpTool.name}`,
				inputSchema,
				execute: async (params: Record<string, unknown>) => {
					try {
						const result = await client.callTool({
							name: mcpTool.name,
							arguments: params,
						});

						// MCP tool results are arrays of content blocks
						if (result.content && Array.isArray(result.content)) {
							return result.content
								.map((block: { type: string; text?: string }) =>
									block.type === "text"
										? block.text
										: JSON.stringify(block),
								)
								.join("\n");
						}

						return typeof result === "string"
							? result
							: JSON.stringify(result, null, 2);
					} catch (error) {
						const msg =
							error instanceof Error
								? error.message
								: String(error);
						logger.error(
							{ error: msg, toolName: mcpTool.name },
							"MCP tool call failed",
						);
						return JSON.stringify({
							error: true,
							message: `MCP tool "${mcpTool.name}" failed: ${msg}`,
						});
					}
				},
			});
		}

		const cleanup = async () => {
			try {
				await client.close();
				logger.info("MCP client disconnected");
			} catch (error) {
				logger.warn(
					{
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
					"MCP client disconnect failed",
				);
			}
		};

		return { toolSet, cleanup };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.error({ error: msg }, "Failed to initialize MCP client");
		return { toolSet: {}, cleanup: async () => {} };
	}
}

/**
 * Convert a JSON Schema object to a Zod schema.
 * Handles common JSON Schema types used by MCP tools.
 */
function jsonSchemaToZod(
	schema: Record<string, unknown>,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
	const properties = (schema.properties ?? {}) as Record<
		string,
		Record<string, unknown>
	>;
	const required = (schema.required ?? []) as string[];
	const fields: Record<string, z.ZodTypeAny> = {};

	for (const [key, prop] of Object.entries(properties)) {
		const desc = (prop.description as string) ?? key;

		switch (prop.type) {
			case "string":
				fields[key] = z.string().describe(desc);
				break;
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
				// Fallback: accept any string
				fields[key] = z.string().describe(desc);
				break;
		}

		if (!required.includes(key)) {
			fields[key] = fields[key].optional();
		}
	}

	return z.object(fields);
}
