/**
 * App Webhooks API
 *
 * GET    /api/apps/{appId}/webhooks — List webhooks
 * POST   /api/apps/{appId}/webhooks — Create a webhook
 * PUT    /api/apps/{appId}/webhooks — Update a webhook
 * DELETE /api/apps/{appId}/webhooks — Delete a webhook
 */

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { builderAppWebhooks } from "@/db/schema";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
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

		const webhooks = await db.query.builderAppWebhooks.findMany({
			where: eq(builderAppWebhooks.appDbId, appDbId),
		});

		return NextResponse.json({
			webhooks: webhooks.map((w) => ({
				dbId: w.dbId,
				url: w.url,
				description: w.description,
				events: w.events,
				secret: w.secret ? "••••••••" : null,
				headers: w.headers,
				enabled: w.enabled,
				lastDeliveryAt: w.lastDeliveryAt,
				lastDeliveryOk: w.lastDeliveryOk,
				deliverySuccessCount: w.deliverySuccessCount,
				deliveryFailureCount: w.deliveryFailureCount,
				timeoutMs: w.timeoutMs,
				createdAt: w.createdAt,
			})),
		});
	} catch (error) {
		console.error("[Webhooks API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
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
		const { url, events, description, secret, headers } = body as {
			url?: string;
			events?: string[];
			description?: string;
			secret?: string;
			headers?: Record<string, string>;
		};

		if (!url || typeof url !== "string") {
			return NextResponse.json(
				{ error: "url is required" },
				{ status: 400 },
			);
		}

		// Basic URL validation
		try {
			new URL(url);
		} catch {
			return NextResponse.json(
				{ error: "Invalid URL format" },
				{ status: 400 },
			);
		}

		if (!events || !Array.isArray(events) || events.length === 0) {
			return NextResponse.json(
				{ error: "events must be a non-empty array" },
				{ status: 400 },
			);
		}

		const [webhook] = await db
			.insert(builderAppWebhooks)
			.values({
				appDbId,
				url,
				description: description || null,
				events,
				secret: secret || null,
				headers: headers || {},
			})
			.returning();

		return NextResponse.json(
			{
				webhook: {
					...webhook,
					secret: webhook.secret ? "••••••••" : null,
				},
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("[Webhooks API] POST error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function PUT(request: Request, { params }: RouteParams) {
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
		const { webhookDbId, ...updates } = body as {
			webhookDbId: number;
			url?: string;
			events?: string[];
			enabled?: boolean;
			description?: string;
			secret?: string;
			headers?: Record<string, string>;
			timeoutMs?: number;
		};

		if (!webhookDbId) {
			return NextResponse.json(
				{ error: "webhookDbId is required" },
				{ status: 400 },
			);
		}

		// Validate URL if provided
		if (updates.url) {
			try {
				new URL(updates.url);
			} catch {
				return NextResponse.json(
					{ error: "Invalid URL format" },
					{ status: 400 },
				);
			}
		}

		// Validate events if provided
		if (updates.events !== undefined) {
			if (
				!Array.isArray(updates.events) ||
				updates.events.length === 0 ||
				!updates.events.every(
					(e: unknown) => typeof e === "string" && e.length > 0,
				)
			) {
				return NextResponse.json(
					{ error: "events must be a non-empty array of strings" },
					{ status: 400 },
				);
			}
		}

		// Validate timeoutMs if provided
		if (updates.timeoutMs !== undefined) {
			if (
				typeof updates.timeoutMs !== "number" ||
				updates.timeoutMs < 1000 ||
				updates.timeoutMs > 30000
			) {
				return NextResponse.json(
					{ error: "timeoutMs must be between 1000 and 30000" },
					{ status: 400 },
				);
			}
		}

		const setValues: Record<string, unknown> = {};
		if (updates.url !== undefined) setValues.url = updates.url;
		if (updates.events !== undefined) setValues.events = updates.events;
		if (updates.enabled !== undefined) setValues.enabled = updates.enabled;
		if (updates.description !== undefined)
			setValues.description = updates.description;
		if (updates.secret !== undefined) setValues.secret = updates.secret;
		if (updates.headers !== undefined) setValues.headers = updates.headers;
		if (updates.timeoutMs !== undefined)
			setValues.timeoutMs = updates.timeoutMs;

		if (Object.keys(setValues).length === 0) {
			return NextResponse.json(
				{ error: "No updates provided" },
				{ status: 400 },
			);
		}

		const [updated] = await db
			.update(builderAppWebhooks)
			.set(setValues)
			.where(
				and(
					eq(builderAppWebhooks.dbId, webhookDbId),
					eq(builderAppWebhooks.appDbId, appDbId),
				),
			)
			.returning();

		if (!updated) {
			return NextResponse.json(
				{ error: "Webhook not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			webhook: {
				...updated,
				secret: updated.secret ? "••••••••" : null,
			},
		});
	} catch (error) {
		console.error("[Webhooks API] PUT error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function DELETE(request: Request, { params }: RouteParams) {
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

		const [deleted] = await db
			.delete(builderAppWebhooks)
			.where(
				and(
					eq(builderAppWebhooks.dbId, webhookDbId),
					eq(builderAppWebhooks.appDbId, appDbId),
				),
			)
			.returning({ dbId: builderAppWebhooks.dbId });

		if (!deleted) {
			return NextResponse.json(
				{ error: "Webhook not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Webhooks API] DELETE error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
