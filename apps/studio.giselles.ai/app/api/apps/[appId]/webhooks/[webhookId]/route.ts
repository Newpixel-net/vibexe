/**
 * Single Webhook API
 *
 * GET /api/apps/{appId}/webhooks/{webhookId} — Get webhook details + recent logs
 */

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppWebhooks,
	builderAppWebhookLogs,
} from "@/db/schema";

interface RouteParams {
	params: Promise<{ appId: string; webhookId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { appId, webhookId } = await params;
		const webhookDbId = Number.parseInt(webhookId, 10);
		if (Number.isNaN(webhookDbId)) {
			return NextResponse.json(
				{ error: "Invalid webhook ID" },
				{ status: 400 },
			);
		}

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const webhook = await db.query.builderAppWebhooks.findFirst({
			where: and(
				eq(builderAppWebhooks.dbId, webhookDbId),
				eq(builderAppWebhooks.appDbId, app.dbId),
			),
		});
		if (!webhook) {
			return NextResponse.json(
				{ error: "Webhook not found" },
				{ status: 404 },
			);
		}

		// Fetch last 10 delivery logs
		const logs = await db.query.builderAppWebhookLogs.findMany({
			where: eq(builderAppWebhookLogs.webhookDbId, webhookDbId),
			orderBy: [desc(builderAppWebhookLogs.createdAt)],
			limit: 10,
		});

		return NextResponse.json({
			webhook: {
				...webhook,
				secret: webhook.secret ? "••••••••" : null,
			},
			logs,
		});
	} catch (error) {
		console.error("[Webhooks API] GET single error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
