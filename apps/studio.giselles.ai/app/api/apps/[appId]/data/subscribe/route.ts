/**
 * Real-Time Data Subscription — SSE Endpoint
 *
 * GET /api/apps/{appId}/data/subscribe?entities=tasks,projects
 *
 * Streams data mutation events (created/updated/deleted) to connected clients
 * via Server-Sent Events. Auto-reconnect is handled by the browser's EventSource API.
 *
 * Auth: X-Vibexe-Api-Key header or no auth (open for now, same as data routes).
 */

import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps } from "@/db/schema";
import {
	type DataChangeEvent,
	type DataEventCallback,
	onDataEvent,
	offDataEvent,
} from "@/lib/realtime/event-bus";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteParams) {
	const { appId } = await params;

	// Validate app exists
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { id: true },
	});
	if (!app) {
		return new Response(JSON.stringify({ error: "App not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Parse entity filter from query string
	const url = new URL(request.url);
	const entitiesParam = url.searchParams.get("entities");
	const entityFilter = entitiesParam
		? new Set(entitiesParam.split(",").map((e) => e.trim()).filter(Boolean))
		: null; // null = subscribe to all entities

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			// Send initial connection event
			controller.enqueue(
				encoder.encode(
					`data: ${JSON.stringify({ type: "connected", appId })}\n\n`,
				),
			);

			// Heartbeat every 30s to keep connection alive
			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": ping\n\n"));
				} catch {
					clearInterval(heartbeat);
				}
			}, 30_000);

			// Listen for data events
			const onEvent: DataEventCallback = (event: DataChangeEvent) => {
				// Filter by entity if specified
				if (entityFilter && !entityFilter.has(event.entity)) return;

				try {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
					);
				} catch {
					// Client disconnected — cleanup will happen via cancel()
				}
			};

			onDataEvent(appId, onEvent);

			// Cleanup on disconnect
			request.signal.addEventListener("abort", () => {
				clearInterval(heartbeat);
				offDataEvent(appId, onEvent);
				try {
					controller.close();
				} catch {
					// Already closed
				}
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET",
			"Access-Control-Allow-Headers": "X-Vibexe-Api-Key",
		},
	});
}
