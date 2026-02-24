/**
 * Webhook Delivery Logs API
 *
 * GET /api/apps/{appId}/webhooks/{webhookId}/logs — Paginated delivery logs
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { builderAppWebhooks, builderAppWebhookLogs } from "@/db/schema";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";

interface RouteParams {
	params: Promise<{ appId: string; webhookId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, webhookId } = await params;
		const webhookDbId = Number.parseInt(webhookId, 10);
		if (Number.isNaN(webhookDbId)) {
			return NextResponse.json(
				{ error: "Invalid webhook ID" },
				{ status: 400 },
			);
		}

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

		// Verify webhook belongs to this app
		const webhook = await db.query.builderAppWebhooks.findFirst({
			where: and(
				eq(builderAppWebhooks.dbId, webhookDbId),
				eq(builderAppWebhooks.appDbId, appDbId),
			),
			columns: { dbId: true },
		});
		if (!webhook) {
			return NextResponse.json(
				{ error: "Webhook not found" },
				{ status: 404 },
			);
		}

		const url = new URL(request.url);
		const page = Math.max(
			1,
			Number.parseInt(url.searchParams.get("page") || "1", 10),
		);
		const limit = Math.min(
			100,
			Math.max(
				1,
				Number.parseInt(url.searchParams.get("limit") || "20", 10),
			),
		);
		const offset = (page - 1) * limit;

		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(builderAppWebhookLogs)
			.where(eq(builderAppWebhookLogs.webhookDbId, webhookDbId));
		const total = Number(countResult?.count ?? 0);

		const logs = await db.query.builderAppWebhookLogs.findMany({
			where: eq(builderAppWebhookLogs.webhookDbId, webhookDbId),
			orderBy: [desc(builderAppWebhookLogs.createdAt)],
			limit,
			offset,
		});

		return NextResponse.json({
			logs,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		console.error("[Webhooks API] GET logs error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
