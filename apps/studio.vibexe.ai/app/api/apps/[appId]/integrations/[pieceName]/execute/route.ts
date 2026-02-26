/**
 * Integration Execution API
 *
 * POST /api/apps/{appId}/integrations/{pieceName}/execute
 *   — Execute an Activepieces integration action
 *
 * Auth: X-Vibexe-Api-Key header, builder session, or Bearer token.
 */

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppDatabases,
	builderAppIntegrations,
} from "@/db/schema";
import {
	isInstalledPiece,
	getCatalogEntry,
} from "@vibexe-ai/activepieces-adapter";
import {
	executePieceAction,
	resolveAuth,
} from "@vibexe-ai/activepieces-adapter/server";
import type { AuthType } from "@vibexe-ai/activepieces-adapter";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { resolveAppUser } from "@/lib/app-database/rls";
import { getCredentialForPiece } from "@/services/integrations/credential-store";
import { decryptToken } from "@/lib/token-encryption";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers":
		"Content-Type, Authorization, X-Vibexe-Api-Key",
	"Access-Control-Max-Age": "86400",
} as const;

interface RouteParams {
	params: Promise<{ appId: string; pieceName: string }>;
}

function withCors(response: NextResponse): NextResponse {
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		response.headers.set(key, value);
	}
	return response;
}

export function OPTIONS() {
	return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, pieceName } = await params;

		// Rate limit: 30 integration executions per IP per minute
		const ip = getClientIp(request);
		const rateCheck = checkRateLimit(
			"integration-exec",
			`${appId}:${ip}`,
			30,
			60 * 1000,
		);
		if (!rateCheck.allowed) {
			return withCors(
				NextResponse.json(
					{ error: "Too many requests. Please try again later." },
					{
						status: 429,
						headers: {
							"Retry-After": String(
								Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000),
							),
						},
					},
				),
			);
		}

		// Validate piece is installed
		if (!isInstalledPiece(pieceName)) {
			return withCors(
				NextResponse.json(
					{ error: `Integration "${pieceName}" is not available` },
					{ status: 404 },
				),
			);
		}

		// Verify app exists
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true, teamDbId: true },
		});
		if (!app) {
			return withCors(
				NextResponse.json({ error: "App not found" }, { status: 404 }),
			);
		}

		// Verify app database is active
		const appDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, app.dbId),
		});
		if (!appDb || appDb.status !== "active") {
			return withCors(
				NextResponse.json(
					{ error: "App database not available" },
					{ status: 503 },
				),
			);
		}

		// Three-layer auth: API key → Builder session → App user Bearer token
		const apiKey = request.headers.get("x-vibexe-api-key");
		if (apiKey) {
			const valid = await verifyApiKey(app.dbId, apiKey);
			if (!valid) {
				return withCors(
					NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
				);
			}
		} else {
			let isBuilder = false;
			try {
				const { verifyAppAccess } = await import(
					"@/lib/auth/verify-app-access"
				);
				await verifyAppAccess(appId);
				isBuilder = true;
			} catch {
				// Not a builder session
			}

			if (!isBuilder) {
				const user = await resolveAppUser(appDb.databaseName, request);
				if (!user) {
					return withCors(
						NextResponse.json(
							{ error: "Authentication required" },
							{ status: 401 },
						),
					);
				}
			}
		}

		// Parse request body
		let body: { action?: string; properties?: Record<string, unknown> };
		try {
			body = await request.json();
		} catch {
			return withCors(
				NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
			);
		}

		const { action, properties } = body;
		if (!action || typeof action !== "string") {
			return withCors(
				NextResponse.json(
					{ error: 'Missing required field: "action"' },
					{ status: 400 },
				),
			);
		}

		// Resolve credentials: app-level first (Dashboard > Integrations), then team-level
		let resolvedAuth: unknown = undefined;

		// 1. Check app-level credentials (from builder_app_integrations)
		const appIntegration = await db.query.builderAppIntegrations.findFirst({
			where: and(
				eq(builderAppIntegrations.appDbId, app.dbId),
				eq(builderAppIntegrations.pieceName, pieceName),
			),
		});

		if (appIntegration?.encryptedCredentials) {
			try {
				const config = JSON.parse(
					decryptToken(appIntegration.encryptedCredentials),
				);
				// Map catalog auth type to resolver auth type
				const catalogAuth = getCatalogEntry(pieceName)?.authType;
				const authType: AuthType =
					catalogAuth === "api_key"
						? "secret_text"
						: (catalogAuth as AuthType) ?? "custom";
				resolvedAuth = resolveAuth({ authType, config });
			} catch (err) {
				console.warn(
					`[Integrations API] Failed to decrypt app-level credential for ${pieceName}:`,
					err,
				);
			}
		}

		// 2. Fallback: team-level credentials (from integration_credentials)
		if (resolvedAuth === undefined || resolvedAuth === null) {
			const credential = await getCredentialForPiece(
				app.teamDbId,
				pieceName,
			);
			if (credential) {
				resolvedAuth = resolveAuth({
					authType: credential.authType as AuthType,
					config: credential.config,
				});
			}
		}

		// Execute the integration action
		let result: unknown;
		try {
			result = await executePieceAction({
				pieceName,
				actionName: action,
				pieceVersion: "latest",
				properties: properties ?? {},
				auth: resolvedAuth ?? {},
			});
		} catch (execError) {
			// Integration execution failed (e.g. upstream API returned 401/403/500)
			const rawMsg =
				execError instanceof Error
					? execError.message
					: "Integration execution failed";

			// Parse the error to extract a human-readable message
			// Pieces often throw JSON like: {"response":{"status":401,"body":{"errors":[{"message":"..."}]}},...}
			let friendlyMsg = rawMsg;
			try {
				const parsed = JSON.parse(rawMsg);
				if (parsed?.response?.body?.errors?.[0]?.message) {
					friendlyMsg = `${pieceName} error: ${parsed.response.body.errors[0].message}`;
				} else if (parsed?.response?.body?.message) {
					friendlyMsg = `${pieceName} error: ${parsed.response.body.message}`;
				} else if (parsed?.response?.body?.error) {
					friendlyMsg = `${pieceName} error: ${parsed.response.body.error}`;
				} else if (parsed?.message) {
					friendlyMsg = `${pieceName} error: ${parsed.message}`;
				}
			} catch {
				// Not JSON — use raw message as-is
			}

			console.error(
				`[Integrations API] ${pieceName}/${action} failed:`,
				rawMsg,
			);
			return withCors(
				NextResponse.json(
					{ error: friendlyMsg, piece: pieceName, action },
					{ status: 422 },
				),
			);
		}

		return withCors(NextResponse.json({ data: result }));
	} catch (error) {
		const errMsg =
			error instanceof Error
				? error.message
				: "Integration execution failed";
		console.error("[Integrations API] Execute error:", error);
		return withCors(
			NextResponse.json({ error: errMsg }, { status: 500 }),
		);
	}
}
