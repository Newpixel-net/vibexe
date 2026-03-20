import type { NextRequest } from "next/server";
import {
	type NodeId,
	WorkspaceId,
	isOperationNode,
} from "@vibexe-ai/protocol";
import { vibexe } from "@/app/vibexe";
import { getUser } from "@/lib/auth/get-user";

export const dynamic = "force-dynamic";

/**
 * MCP Server endpoint for exposing Vibexe workflows as MCP tools.
 *
 * Implements the Model Context Protocol (MCP) JSON-RPC server spec.
 * Each workspace becomes an MCP server. Workflows with trigger/appEntry nodes
 * become callable MCP tools.
 *
 * POST /api/mcp/[workspaceId]
 *
 * Authentication: Session cookie (vibexe-auth) or Bearer token.
 *
 * JSON-RPC methods supported:
 * - initialize: server capabilities & info
 * - tools/list: list available tools (workflow nodes)
 * - tools/call: execute a tool (run a workflow node)
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	// Auth: require session cookie or Bearer token
	try {
		await getUser();
	} catch {
		return jsonRpcError(null, -32000, "Authentication required");
	}

	const { workspaceId: workspaceIdStr } = await params;

	const parseResult = WorkspaceId.safeParse(workspaceIdStr);
	if (!parseResult.success) {
		return jsonRpcError(null, -32600, "Invalid workspace ID");
	}

	const workspaceId = parseResult.data;

	let body: { jsonrpc?: string; id?: number | string; method?: string; params?: Record<string, unknown> };
	try {
		body = await request.json();
	} catch {
		return jsonRpcError(null, -32700, "Parse error");
	}

	const { jsonrpc, id, method, params: rpcParams } = body;

	if (jsonrpc !== "2.0") {
		return jsonRpcError(id ?? null, -32600, "Invalid Request: jsonrpc must be '2.0'");
	}

	if (!method || typeof method !== "string") {
		return jsonRpcError(id ?? null, -32600, "Invalid Request: method is required");
	}

	try {
		switch (method) {
			case "initialize":
				return jsonRpcResult(id, {
					protocolVersion: "2024-11-05",
					capabilities: {
						tools: {},
					},
					serverInfo: {
						name: "vibexe",
						version: "1.0.0",
					},
				});

			case "tools/list":
				return handleToolsList(id, workspaceId);

			case "tools/call":
				return handleToolsCall(id, workspaceId, rpcParams ?? {});

			case "notifications/initialized":
				// Client acknowledgment — no response needed for notifications
				return new Response(null, { status: 204 });

			default:
				return jsonRpcError(id ?? null, -32601, `Method not found: ${method}`);
		}
	} catch (error) {
		console.error("[MCP Server] Error:", error);
		return jsonRpcError(
			id ?? null,
			-32603,
			"Internal error",
		);
	}
}

/**
 * List available tools. Each operation node in the workspace becomes a tool.
 */
async function handleToolsList(
	id: number | string | undefined,
	workspaceId: string,
) {
	const workspace = await vibexe.getWorkspace(workspaceId as WorkspaceId);
	if (!workspace) {
		return jsonRpcError(id ?? null, -32602, "Workspace not found");
	}

	const tools: Array<{
		name: string;
		description: string;
		inputSchema: Record<string, unknown>;
	}> = [];

	for (const node of workspace.nodes) {
		if (!isOperationNode(node)) continue;

		// Only expose nodes that can meaningfully process input
		const exposableTypes = [
			"textGeneration",
			"contentGeneration",
			"aiAgent",
			"integration",
			"code",
			"trigger",
			"appEntry",
			"formTrigger",
		];

		if (!exposableTypes.includes(node.content.type)) continue;

		// Build input schema from node's input ports
		const properties: Record<string, { type: string; description: string }> = {};
		const required: string[] = [];

		for (const input of node.inputs) {
			properties[input.accessor] = {
				type: "string",
				description: `Input: ${input.label || input.accessor}`,
			};
			if (input.isRequired) {
				required.push(input.accessor);
			}
		}

		// If no explicit inputs, add a generic "message" input
		if (Object.keys(properties).length === 0) {
			properties.message = {
				type: "string",
				description: "Input message or data for this tool",
			};
		}

		tools.push({
			name: `${node.id}`,
			description:
				node.name ||
				`${node.content.type} node`,
			inputSchema: {
				type: "object",
				properties,
				required: required.length > 0 ? required : undefined,
			},
		});
	}

	return jsonRpcResult(id, { tools });
}

/**
 * Call a tool (execute a workflow node).
 */
async function handleToolsCall(
	id: number | string | undefined,
	workspaceId: string,
	params: Record<string, unknown>,
) {
	const { name, arguments: toolArgs } = params as {
		name?: string;
		arguments?: Record<string, string>;
	};

	if (!name) {
		return jsonRpcError(id ?? null, -32602, "Tool name is required");
	}

	const workspace = await vibexe.getWorkspace(workspaceId as WorkspaceId);
	if (!workspace) {
		return jsonRpcError(id ?? null, -32602, "Workspace not found");
	}

	// Find the target node
	const targetNode = workspace.nodes.find((n) => n.id === name);
	if (!targetNode || !isOperationNode(targetNode)) {
		return jsonRpcError(id ?? null, -32602, `Tool not found: ${name}`);
	}

	try {
		// Build input items from tool arguments
		const inputItems = Object.entries(toolArgs || {}).map(
			([key, value]) => ({
				type: "string" as const,
				name: key,
				value: String(value),
			}),
		);

		// Execute the workflow
		let resultText = "";
		let generationId: string | undefined;

		await vibexe.createAndStartTask({
			workspaceId: workspaceId as WorkspaceId,
			nodeId: targetNode.id as NodeId,
			inputs: [
				{
					type: "parameters" as const,
					items: inputItems,
				},
			],
			generationOriginType: "api",
			callbacks: {
				sequenceComplete: async ({ sequence }) => {
					const lastStep = sequence.steps[sequence.steps.length - 1];
					if (lastStep) {
						generationId = lastStep.generationId;
					}
				},
			},
		});

		// Retrieve generation output
		if (generationId) {
			const chunks = await vibexe.getGenerationMessageChunks({
				generationId: generationId as never,
			});
			if (chunks.messageChunks.length > 0) {
				for (const chunk of chunks.messageChunks) {
					try {
						const parsed = JSON.parse(chunk);
						if (parsed.type === "text-delta" && parsed.textDelta) {
							resultText += parsed.textDelta;
						} else if (parsed.type === "text" && parsed.text) {
							resultText += parsed.text;
						}
					} catch {
						// Not valid JSON chunk
					}
				}
			}
		}

		if (!resultText) {
			resultText = "Tool executed successfully (no text output)";
		}

		return jsonRpcResult(id, {
			content: [
				{
					type: "text",
					text: resultText,
				},
			],
		});
	} catch (error) {
		console.error("[MCP Server] Tool execution error:", error);
		return jsonRpcResult(id, {
			content: [
				{
					type: "text",
					text: `Error executing tool: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			],
			isError: true,
		});
	}
}

// ---- JSON-RPC Helpers ----

function jsonRpcResult(
	id: number | string | undefined | null,
	result: unknown,
) {
	return Response.json(
		{
			jsonrpc: "2.0",
			id: id ?? null,
			result,
		},
		{
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
		},
	);
}

function jsonRpcError(
	id: number | string | null,
	code: number,
	message: string,
) {
	return Response.json(
		{
			jsonrpc: "2.0",
			id,
			error: { code, message },
		},
		{
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
		},
	);
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
	return new Response(null, {
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}
