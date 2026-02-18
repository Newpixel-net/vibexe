// Chat persistence API endpoint for App Builder
//
// - GET: Retrieve chat messages for an app
// - PUT: Save chat messages for an app

import { NextResponse } from "next/server";
import {
	getAppById,
	getChatForApp,
	saveChatMessages,
} from "@/app/(main)/app-builder/lib/queries";
import { getUser } from "@/lib/auth/get-user";

interface RouteContext {
	params: Promise<{ appId: string }>;
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

		// Save messages
		await saveChatMessages(chat.id, messages ?? []);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Chat API] PUT error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
