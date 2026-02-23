/**
 * Webhook Executor — Single HTTP POST attempt with HMAC signing + logging
 */

import { createHmac } from "node:crypto";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { builderAppWebhookLogs } from "@/db/schema";

export interface WebhookRecord {
	dbId: number;
	url: string;
	secret: string | null;
	headers: Record<string, string> | null;
	timeoutMs?: number;
}

export interface WebhookPayload {
	event: string;
	timestamp: string;
	app_id: string;
	data: unknown;
}

export interface ExecutionResult {
	success: boolean;
	status?: number;
	responseBody?: string;
	durationMs: number;
	errorMessage?: string;
}

/**
 * Execute a single webhook delivery attempt.
 * Signs the payload with HMAC-SHA256 if a secret is configured.
 * Logs the result to builder_app_webhook_logs.
 */
export async function executeWebhook(
	webhook: WebhookRecord,
	eventType: string,
	payload: WebhookPayload,
	attempt: number,
): Promise<ExecutionResult> {
	// Defense-in-depth: reject non-http(s) URLs and internal/private networks
	try {
		const parsed = new URL(webhook.url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return {
				success: false,
				durationMs: 0,
				errorMessage: `Rejected webhook URL scheme: ${parsed.protocol}`,
			};
		}
		const BLOCKED_HOSTS = new Set([
			"localhost", "127.0.0.1", "[::1]", "0.0.0.0",
			"metadata.google.internal", "169.254.169.254",
		]);
		const parts = parsed.hostname.split(".").map(Number);
		const isPrivate = parts.length === 4 && parts.every((p) => !Number.isNaN(p)) && (
			parts[0] === 10 ||
			(parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
			(parts[0] === 192 && parts[1] === 168) ||
			parts[0] === 0
		);
		if (BLOCKED_HOSTS.has(parsed.hostname) || isPrivate) {
			return {
				success: false,
				durationMs: 0,
				errorMessage: "Rejected: webhook URL targets internal/private network",
			};
		}
	} catch {
		return {
			success: false,
			durationMs: 0,
			errorMessage: "Invalid webhook URL",
		};
	}

	const body = JSON.stringify(payload);
	const deliveryId = nanoid();
	const timestampHeader = payload.timestamp;

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"X-Vibexe-Event": eventType,
		"X-Vibexe-Delivery": deliveryId,
		"X-Vibexe-Timestamp": timestampHeader,
		...(webhook.headers || {}),
	};

	// HMAC-SHA256 signing — includes timestamp to prevent replay attacks
	if (webhook.secret) {
		const signedPayload = `${timestampHeader}.${body}`;
		const signature = createHmac("sha256", webhook.secret)
			.update(signedPayload)
			.digest("hex");
		headers["X-Vibexe-Signature"] = `sha256=${signature}`;
	}

	const start = Date.now();
	let result: ExecutionResult;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			webhook.timeoutMs || 10_000,
		);

		const res = await fetch(webhook.url, {
			method: "POST",
			headers,
			body,
			signal: controller.signal,
		});
		clearTimeout(timeout);

		const durationMs = Date.now() - start;
		const responseText = await res.text().catch(() => "");
		const responseBody = responseText.slice(0, 2048);

		result = {
			success: res.status >= 200 && res.status < 300,
			status: res.status,
			responseBody,
			durationMs,
		};
	} catch (err) {
		const durationMs = Date.now() - start;
		result = {
			success: false,
			durationMs,
			errorMessage:
				err instanceof Error ? err.message : "Unknown fetch error",
		};
	}

	// Build safe payload for logging — strip any sensitive data from headers
	const safePayload = { ...payload } as Record<string, unknown>;
	if (webhook.headers) {
		const maskedHeaders: Record<string, string> = {};
		for (const [k, v] of Object.entries(webhook.headers)) {
			const lower = k.toLowerCase();
			maskedHeaders[k] =
				lower === "authorization" || lower.includes("secret") || lower.includes("token")
					? "••••••••"
					: v;
		}
		safePayload._request_headers = maskedHeaders;
	}

	// Log to database (fire-and-forget)
	db.insert(builderAppWebhookLogs)
		.values({
			webhookDbId: webhook.dbId,
			eventType,
			payload: safePayload,
			responseStatus: result.status ?? null,
			responseBody: result.responseBody ?? null,
			attempt,
			success: result.success,
			durationMs: result.durationMs,
			errorMessage: result.errorMessage ?? null,
		})
		.catch((e) => console.error("[Webhook] Failed to log delivery:", e));

	return result;
}
