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

/** Extract text from a single message (AI SDK v5/v6 format). */
function extractMessageText(msg: Record<string, unknown>): string {
	if (typeof msg.content === "string") return msg.content;
	if (Array.isArray(msg.parts)) {
		const texts: string[] = [];
		for (const part of msg.parts as { type: string; text?: string }[]) {
			if (part.type === "text" && part.text) texts.push(part.text);
		}
		return texts.join("\n");
	}
	return "";
}

/** Extract all URLs from a string. */
function extractUrls(text: string): string[] {
	const urlRegex = /https?:\/\/[^\s"'<>)}\]]+/gi;
	return [...new Set(text.match(urlRegex) || [])];
}

/** Extract a rich summary from chat messages for the history log. */
function buildHistorySummary(messages: Record<string, unknown>[]) {
	const filesCreated: string[] = [];
	const filesModified: string[] = [];
	const filesDeleted: string[] = [];
	const userMessages: string[] = [];
	const urls: string[] = [];
	let assistantMessageCount = 0;

	for (const msg of messages) {
		const role = msg.role as string;
		if (role === "user") {
			const text = extractMessageText(msg);
			if (text.trim()) {
				userMessages.push(text.trim());
				urls.push(...extractUrls(text));
			}
		} else if (role === "assistant") {
			assistantMessageCount++;
			// Extract file tool calls from parts (AI SDK v5/v6 formats)
			if (Array.isArray(msg.parts)) {
				for (const part of msg.parts as { type: string; toolName?: string; args?: Record<string, string>; input?: Record<string, string>; result?: unknown }[]) {
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

	// Build rich summary
	const summaryParts: string[] = [];

	// File operations line
	const opParts: string[] = [];
	if (filesCreated.length > 0) opParts.push(`Created ${filesCreated.length} file${filesCreated.length > 1 ? "s" : ""}`);
	if (filesModified.length > 0) opParts.push(`Updated ${filesModified.length} file${filesModified.length > 1 ? "s" : ""}`);
	if (filesDeleted.length > 0) opParts.push(`Deleted ${filesDeleted.length} file${filesDeleted.length > 1 ? "s" : ""}`);
	if (opParts.length > 0) summaryParts.push(opParts.join(", "));

	// URLs mentioned
	if (urls.length > 0) {
		summaryParts.push(`Referenced: ${urls.join(", ")}`);
	}

	// All user requests (each truncated to 200 chars)
	for (let i = 0; i < userMessages.length; i++) {
		const text = userMessages[i];
		const truncated = text.length > 200 ? `${text.slice(0, 200)}...` : text;
		const prefix = userMessages.length > 1 ? `Request ${i + 1}: ` : "";
		summaryParts.push(`${prefix}"${truncated}"`);
	}

	const summary = summaryParts.length > 0
		? summaryParts.join("\n")
		: "Empty chat session";

	return {
		summary,
		details: {
			filesCreated,
			filesModified,
			filesDeleted,
			urls,
			userMessages: userMessages.map((m) => m.length > 500 ? `${m.slice(0, 500)}...` : m),
			messageCount: userMessages.length + assistantMessageCount,
			userMessageCount: userMessages.length,
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

		const app = await getAppById(appId, user.dbId);
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

		const app = await getAppById(appId, user.dbId);
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
