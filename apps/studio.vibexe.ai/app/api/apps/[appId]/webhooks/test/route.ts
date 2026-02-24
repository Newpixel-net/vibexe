/**
 * Webhook Test Ping
 *
 * POST /api/apps/{appId}/webhooks/test — Send test event to a webhook
 */

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { builderAppWebhooks } from "@/db/schema";
import { executeWebhook } from "@/lib/app-webhooks/executor";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;
		let appDbId: number;
		try {
			({ appDbId } = await verifyAppAccess(appId));
		} catch (e) {
			const msg = e instanceof Error ? e.message : "";
			if (msg.includes("session")) {
				return NextResponse.json(
					{ error: "Unauthorized" },
					{ status: 401 },
				);
			}
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
				eq(builderAppWebhooks.appDbId, appDbId),
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
				timeoutMs: webhook.timeoutMs ?? 10_000,
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

		// Update last delivery timestamp for UI visibility (don't count in stats)
		db.update(builderAppWebhooks)
			.set({
				lastDeliveryAt: new Date(),
				lastDeliveryOk: result.success,
			})
			.where(eq(builderAppWebhooks.dbId, webhook.dbId))
			.catch((e) =>
				console.error("[Webhook] Failed to update test stats:", e),
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
