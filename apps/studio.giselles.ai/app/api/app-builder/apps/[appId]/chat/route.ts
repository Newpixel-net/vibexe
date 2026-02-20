// Chat persistence API endpoint for App Builder
//
// - GET: Retrieve chat messages for an app
// - PUT: Save chat messages for an app (archives before clearing)

import { NextResponse } from "next/server";
import {
	createHistoryEntry,
	getAppById,
	getChatForApp,
	saveChatMessages,
} from "@/app/(main)/app-builder/lib/queries";
import { getUser } from "@/lib/auth/get-user";

interface RouteContext {
	params: Promise<{ appId: string }>;
}

/** Extract a summary from chat messages for the history log. */
function buildHistorySummary(messages: Record<string, unknown>[]) {
	const filesCreated: string[] = [];
	const filesModified: string[] = [];
	const filesDeleted: string[] = [];
	let userMessageCount = 0;
	let assistantMessageCount = 0;
	let firstUserText = "";

	for (const msg of messages) {
		const role = msg.role as string;
		if (role === "user") {
			userMessageCount++;
			if (!firstUserText) {
				// AI SDK v6: text is in parts[0].text or content
				if (typeof msg.content === "string") {
					firstUserText = msg.content;
				} else if (Array.isArray(msg.parts)) {
					const tp = (msg.parts as { type: string; text?: string }[]).find(
						(p) => p.type === "text",
					);
					if (tp?.text) firstUserText = tp.text;
				}
			}
		} else if (role === "assistant") {
			assistantMessageCount++;
			// Extract file tool calls from parts
			if (Array.isArray(msg.parts)) {
				for (const part of msg.parts as { type: string; toolName?: string; args?: Record<string, string>; input?: Record<string, string> }[]) {
					if (part.type === "tool-invocation" || part.type === "tool-call") {
						const args = part.input ?? part.args ?? {};
						const path = args.path || args.filePath || "";
						if (part.toolName === "create_file" || part.toolName === "createFile") {
							if (path) filesCreated.push(path);
						} else if (part.toolName === "update_file" || part.toolName === "updateFile") {
							if (path) filesModified.push(path);
						} else if (part.toolName === "delete_file" || part.toolName === "deleteFile") {
							if (path) filesDeleted.push(path);
						}
					}
				}
			}
		}
	}

	// Build summary string
	const parts: string[] = [];
	if (filesCreated.length > 0) parts.push(`Created ${filesCreated.length} file${filesCreated.length > 1 ? "s" : ""}`);
	if (filesModified.length > 0) parts.push(`Modified ${filesModified.length} file${filesModified.length > 1 ? "s" : ""}`);
	if (filesDeleted.length > 0) parts.push(`Deleted ${filesDeleted.length} file${filesDeleted.length > 1 ? "s" : ""}`);

	let summary = parts.length > 0 ? parts.join(", ") : "Chat session";
	if (firstUserText) {
		const truncated = firstUserText.length > 80 ? `${firstUserText.slice(0, 80)}...` : firstUserText;
		summary += ` — "${truncated}"`;
	}

	return {
		summary,
		details: {
			filesCreated,
			filesModified,
			filesDeleted,
			messageCount: userMessageCount + assistantMessageCount,
			userMessageCount,
			assistantMessageCount,
		},
	};
}

/**
 * GET /api/app-builder/apps/[appId]/chat
 *
 * Returns chat messages for a builder app.
 */
export async function GET(_request: Request, context: RouteContext) {
	try {
		const user = await getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { appId } = await context.params;

		const app = await getAppById(appId, user.id);
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const chat = await getChatForApp(appId);

		return NextResponse.json({
			chatId: chat.id,
			messages: chat.messages ?? [],
		});
	} catch (error) {
		console.error("[Chat API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * PUT /api/app-builder/apps/[appId]/chat
 *
 * Save chat messages for a builder app.
 * When messages=[] and current chat has messages, auto-archives to history.
 *
 * Request body: { messages: UIMessage[] }
 */
export async function PUT(request: Request, context: RouteContext) {
	try {
		const user = await getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { appId } = await context.params;

		const app = await getAppById(appId, user.id);
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const body = await request.json();
		const { messages } = body as { messages: unknown[] };

		// Ensure chat exists
		const chat = await getChatForApp(appId);

		// Archive before clearing: if new messages is empty and current chat has messages
		const incomingMessages = messages ?? [];
		if (
			incomingMessages.length === 0 &&
			Array.isArray(chat.messages) &&
			chat.messages.length > 0
		) {
			try {
				const { summary, details } = buildHistorySummary(
					chat.messages as Record<string, unknown>[],
				);
				await createHistoryEntry(app.dbId, summary, details, "generate");
			} catch (e) {
				// Non-blocking — don't fail the clear operation
				console.error("[Chat API] History archive error:", e);
			}
		}

		// Save messages
		await saveChatMessages(chat.id, incomingMessages);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Chat API] PUT error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
