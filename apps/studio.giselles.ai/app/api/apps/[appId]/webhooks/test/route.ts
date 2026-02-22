/**
 * Webhook Test Ping
 *
 * POST /api/apps/{appId}/webhooks/test — Send test event to a webhook
 */

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppWebhooks } from "@/db/schema";
import { executeWebhook } from "@/lib/app-webhooks/executor";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const body = await request.json();
		const { webhookDbId } = body as { webhookDbId: number };

		if (!webhookDbId) {
			return NextResponse.json(
				{ error: "webhookDbId is required" },
				{ status: 400 },
			);
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

		const result = await executeWebhook(
			{
				dbId: webhook.dbId,
				url: webhook.url,
				secret: webhook.secret,
				headers: webhook.headers as Record<string, string> | null,
			},
			"webhook.test",
			{
				event: "webhook.test",
				timestamp: new Date().toISOString(),
				app_id: appId,
				data: { message: "This is a test webhook delivery" },
			},
			1,
		);

		return NextResponse.json({
			success: result.success,
			status: result.status,
			durationMs: result.durationMs,
			errorMessage: result.errorMessage,
		});
	} catch (error) {
		console.error("[Webhooks API] Test error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
