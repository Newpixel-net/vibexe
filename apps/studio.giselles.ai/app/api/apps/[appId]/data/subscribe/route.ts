/**
 * Real-Time Data Subscription — SSE Endpoint
 *
 * GET /api/apps/{appId}/data/subscribe?entities=tasks,projects
 *
 * Streams data mutation events (created/updated/deleted) to connected clients
 * via Server-Sent Events. Auto-reconnect is handled by the browser's EventSource API.
 *
 * Auth: X-Vibexe-Api-Key header, builder session, or end-user Bearer token.
 */

import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { resolveAppUser } from "@/lib/app-database/rls";
import { getClientIp } from "@/lib/rate-limiter";
import {
	type DataChangeEvent,
	type DataEventCallback,
	onDataEvent,
	offDataEvent,
} from "@/lib/realtime/event-bus";

// ---- Concurrent SSE connection limiter ----
// Tracks active SSE connections per key to prevent resource exhaustion.
const activeConnections = new Map<string, number>();
const MAX_SSE_PER_IP = 10; // max concurrent SSE connections per IP per app

function acquireSSESlot(key: string): boolean {
	const current = activeConnections.get(key) ?? 0;
	if (current >= MAX_SSE_PER_IP) return false;
	activeConnections.set(key, current + 1);
	return true;
}

function releaseSSESlot(key: string): void {
	const current = activeConnections.get(key) ?? 1;
	if (current <= 1) {
		activeConnections.delete(key);
	} else {
		activeConnections.set(key, current - 1);
	}
}

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteParams) {
	const { appId } = await params;

	// Validate app exists
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { id: true, dbId: true },
	});
	if (!app) {
		return new Response(JSON.stringify({ error: "App not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Auth: API key, builder session, or end-user Bearer token
	let authenticated = false;
	const apiKey = request.headers.get("x-vibexe-api-key");
	if (apiKey) {
		authenticated = !!(await verifyApiKey(app.dbId, apiKey));
		if (!authenticated) {
			return new Response(JSON.stringify({ error: "Invalid API key" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}
	}
	if (!authenticated) {
		try {
			await verifyAppAccess(appId);
			authenticated = true;
		} catch {
			// Not a builder session — check end-user auth
		}
	}
	if (!authenticated) {
		// End-user Bearer token auth — need database name to look up sessions
		const authHeader = request.headers.get("authorization");
		if (authHeader?.startsWith("Bearer ")) {
			const appDb = await db.query.builderAppDatabases.findFirst({
				where: eq(builderAppDatabases.appDbId, app.dbId),
				columns: { databaseName: true },
			});
			if (appDb) {
				const user = await resolveAppUser(appDb.databaseName, request);
				if (user) authenticated = true;
			}
		}
	}
	if (!authenticated) {
		return new Response(JSON.stringify({ error: "Authentication required. Provide X-Vibexe-Api-Key header or Bearer token." }), {
			status: 401,
			headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
		});
	}

	// Concurrent connection limit per IP per app
	const ip = getClientIp(request);
	const sseKey = `${appId}:${ip}`;
	if (!acquireSSESlot(sseKey)) {
		return new Response(JSON.stringify({ error: "Too many active connections" }), {
			status: 429,
			headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
		});
	}

	// Parse entity filter from query string
	const url = new URL(request.url);
	const entitiesParam = url.searchParams.get("entities");
	const entityFilter = entitiesParam
		? new Set(entitiesParam.split(",").map((e) => e.trim()).filter(Boolean))
		: null; // null = subscribe to all entities

	const encoder = new TextEncoder();

	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let maxLifetimeTimer: ReturnType<typeof setTimeout> | null = null;
	let eventHandler: DataEventCallback | null = null;
	let cleaned = false;

	function cleanup() {
		if (cleaned) return;
		cleaned = true;
		if (heartbeat) clearInterval(heartbeat);
		if (maxLifetimeTimer) clearTimeout(maxLifetimeTimer);
		if (eventHandler) offDataEvent(appId, eventHandler);
		releaseSSESlot(sseKey);
		heartbeat = null;
		maxLifetimeTimer = null;
		eventHandler = null;
	}

	const stream = new ReadableStream({
		start(controller) {
			// Send initial connection event
			controller.enqueue(
				encoder.encode(
					`data: ${JSON.stringify({ type: "connected", appId })}\n\n`,
				),
			);

			// Heartbeat every 30s to keep connection alive
			heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": ping\n\n"));
				} catch {
					// enqueue failed = client disconnected
					cleanup();
					try { controller.close(); } catch { /* already closed */ }
				}
			}, 30_000);

			// Safety net: max connection lifetime of 30 minutes to prevent zombie leaks
			maxLifetimeTimer = setTimeout(() => {
				cleanup();
				try { controller.close(); } catch { /* already closed */ }
			}, 30 * 60 * 1000);

			// Listen for data events
			const onEvent: DataEventCallback = (event: DataChangeEvent) => {
				if (entityFilter && !entityFilter.has(event.entity)) return;
				try {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
					);
				} catch {
					cleanup();
				}
			};
			eventHandler = onEvent;

			onDataEvent(appId, onEvent);

			// Cleanup on disconnect (abort signal)
			request.signal.addEventListener("abort", () => {
				cleanup();
				try { controller.close(); } catch { /* already closed */ }
			});
		},
		cancel() {
			// ReadableStream cancel — called when consumer drops the stream
			cleanup();
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET",
			"Access-Control-Allow-Headers": "X-Vibexe-Api-Key, Authorization",
		},
	});
}

export async function OPTIONS() {
	return new Response(null, {
		status: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "X-Vibexe-Api-Key, Authorization",
			"Access-Control-Max-Age": "86400",
		},
	});
}
