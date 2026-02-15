import type { NextRequest } from "next/server";
import {
	type GenerationId,
	NodeId,
	WorkspaceId,
	isOperationNode,
} from "@giselles-ai/protocol";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, chatMessages, chatSessions } from "@/db/schema";
import { giselle } from "@/app/giselle";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/chat/[workspaceId]
 *
 * Chat API endpoint for the embeddable chat widget.
 * Accepts a user message, runs the workspace's AI agent, and streams back the response.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId: workspaceIdStr } = await params;

	const parseResult = WorkspaceId.safeParse(workspaceIdStr);
	if (!parseResult.success) {
		return Response.json(
			{ error: "Invalid workspace ID" },
			{ status: 400 },
		);
	}
	const workspaceId = parseResult.data;

	let body: { sessionId?: string; message?: string };
	try {
		body = await request.json();
	} catch {
		return Response.json(
			{ error: "Invalid JSON body" },
			{ status: 400 },
		);
	}

	const { sessionId, message } = body;
	if (!sessionId || !message) {
		return Response.json(
			{ error: "sessionId and message are required" },
			{ status: 400 },
		);
	}

	try {
		// Check if the associated agent is published
		const [chatAgent] = await db
			.select({ isPublished: agents.isPublished })
			.from(agents)
			.where(eq(agents.workspaceId, workspaceId))
			.limit(1);
		if (chatAgent && !chatAgent.isPublished) {
			return Response.json(
				{ error: "Workflow is not published. Chat is unavailable." },
				{ status: 503 },
			);
		}

		// Load workspace to find the AI agent/text generation node
		const workspace = await giselle.getWorkspace(workspaceId);
		if (!workspace) {
			return Response.json(
				{ error: "Workspace not found" },
				{ status: 404 },
			);
		}

		// Find the first operation node that can process text
		const operationNode = workspace.nodes.find(
			(node) =>
				isOperationNode(node) &&
				(node.content.type === "textGeneration" ||
					node.content.type === "contentGeneration" ||
					node.content.type === "aiAgent"),
		);

		if (!operationNode) {
			return Response.json(
				{ error: "No AI agent or text generation node found in workspace" },
				{ status: 404 },
			);
		}

		// Upsert chat session (insert-first to avoid TOCTOU race on concurrent requests)
		let sessionDbId: number;
		try {
			const [newSession] = await db
				.insert(chatSessions)
				.values({
					sessionId,
					sdkWorkspaceId: workspaceId,
					agentNodeId: operationNode.id,
				})
				.returning({ dbId: chatSessions.dbId });
			sessionDbId = newSession.dbId;
		} catch {
			// Session already exists (unique constraint) — update and use existing
			const [existingSession] = await db
				.select({ dbId: chatSessions.dbId })
				.from(chatSessions)
				.where(eq(chatSessions.sessionId, sessionId))
				.limit(1);
			if (!existingSession) {
				return Response.json(
					{ error: "Failed to create or find chat session" },
					{ status: 500 },
				);
			}
			sessionDbId = existingSession.dbId;
			await db
				.update(chatSessions)
				.set({ lastMessageAt: new Date() })
				.where(eq(chatSessions.dbId, existingSession.dbId));
		}

		// Save user message
		await db.insert(chatMessages).values({
			sessionDbId,
			role: "user",
			content: message,
		});

		// Load chat history for context (last 20 messages)
		const history = await db
			.select()
			.from(chatMessages)
			.where(eq(chatMessages.sessionDbId, sessionDbId))
			.orderBy(chatMessages.dbId)
			.limit(20);

		// Build conversation context as input
		const conversationContext = history
			.map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
			.join("\n");

		// Use SSE to stream the response
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				try {
					// Track generation IDs for polling
					let lastGenerationId: GenerationId | undefined;

					// Create and start the task
					const taskPromise = giselle.createAndStartTask({
						workspaceId,
						nodeId: NodeId.parse(operationNode.id),
						inputs: [
							{
								type: "parameters" as const,
								items: [
									{
										type: "string" as const,
										name: "message",
										value: message,
									},
									{
										type: "string" as const,
										name: "chat_history",
										value: conversationContext,
									},
								],
							},
						],
						generationOriginType: "api",
						callbacks: {
							sequenceComplete: async ({ sequence }) => {
								// Get the last step's generation ID
								const lastStep =
									sequence.steps[sequence.steps.length - 1];
								if (lastStep) {
									lastGenerationId = lastStep.generationId;
								}
							},
						},
					});

					// Wait for task to complete
					await taskPromise;

					// Read the generation output
					let responseText = "";
					if (lastGenerationId) {
						const generation =
							await giselle.getGeneration(lastGenerationId);
						if (
							generation &&
							generation.status === "completed" &&
							"messages" in generation
						) {
							const messages = generation.messages as Array<{
								role: string;
								content: unknown;
							}>;
							const assistantMsg = messages?.find(
								(m) => m.role === "assistant",
							);
							if (assistantMsg) {
								if (typeof assistantMsg.content === "string") {
									responseText = assistantMsg.content;
								} else if (Array.isArray(assistantMsg.content)) {
									responseText = assistantMsg.content
										.filter(
											(c: { type: string }) =>
												c.type === "text",
										)
										.map(
											(c: { type: string; text: string }) =>
												c.text,
										)
										.join("");
								}
							}
						}

						// If no messages found, try reading the message chunks
						if (!responseText) {
							const chunks =
								await giselle.getGenerationMessageChunks({
									generationId: lastGenerationId,
								});
							if (chunks.messageChunks.length > 0) {
								// Parse the chunks to extract text content
								for (const chunk of chunks.messageChunks) {
									try {
										const parsed = JSON.parse(chunk);
										if (
											parsed.type === "text-delta" &&
											parsed.textDelta
										) {
											responseText += parsed.textDelta;
										} else if (
											parsed.type === "text" &&
											parsed.text
										) {
											responseText += parsed.text;
										}
									} catch {
										// Not valid JSON, skip
									}
								}
							}
						}
					}

					if (!responseText) {
						responseText =
							"I apologize, but I was unable to generate a response. Please try again.";
					}

					// Save assistant response to DB
					await db.insert(chatMessages).values({
						sessionDbId,
						role: "assistant",
						content: responseText,
					});

					// Send the response
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ type: "message", content: responseText })}\n\n`,
						),
					);
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ type: "done" })}\n\n`,
						),
					);
					controller.close();
				} catch (error) {
					console.error("[Chat API] Error:", error);
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ type: "error", message: "An error occurred while processing your message." })}\n\n`,
						),
					);
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (error) {
		console.error("[Chat API] Fatal error:", error);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * GET /api/chat/[workspaceId]
 *
 * Returns chat widget configuration for the workspace.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId: workspaceIdStr } = await params;

	const parseResult = WorkspaceId.safeParse(workspaceIdStr);
	if (!parseResult.success) {
		return Response.json(
			{ error: "Invalid workspace ID" },
			{ status: 400 },
		);
	}

	const workspaceId = parseResult.data;

	try {
		const workspace = await giselle.getWorkspace(workspaceId);
		if (!workspace) {
			return Response.json(
				{ error: "Workspace not found" },
				{ status: 404 },
			);
		}

		// Look for a chat trigger node to get widget config
		const chatTriggerNode = workspace.nodes.find(
			(node) =>
				node.content.type === "trigger" &&
				(node.content as Record<string, unknown>).provider === "chat",
		);

		const config = chatTriggerNode
			? (chatTriggerNode.content as Record<string, unknown>).widgetConfig ?? {}
			: {};

		return Response.json({
			workspaceId,
			workspaceName: workspace.name ?? "Chat",
			config: {
				title: (config as Record<string, unknown>).title ?? "Chat with AI",
				placeholder:
					(config as Record<string, unknown>).placeholder ??
					"Type your message...",
				primaryColor:
					(config as Record<string, unknown>).primaryColor ?? "#6366f1",
				welcomeMessage:
					(config as Record<string, unknown>).welcomeMessage ?? undefined,
			},
		});
	} catch (error) {
		console.error("[Chat API] Error getting config:", error);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * OPTIONS /api/chat/[workspaceId]
 *
 * CORS preflight handler for cross-origin chat widget embeds.
 */
export async function OPTIONS() {
	return new Response(null, {
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}
