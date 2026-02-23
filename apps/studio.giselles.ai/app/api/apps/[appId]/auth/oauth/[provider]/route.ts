/**
 * App-level OAuth Initiation
 *
 * GET /api/apps/{appId}/auth/oauth/{provider}
 *
 * Validates the provider is enabled for this app, reads the app's own
 * OAuth credentials from builder_app_auth_settings, builds an HMAC-signed
 * state parameter carrying the appId, and redirects to the provider's
 * authorization URL.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppAuthSettings } from "@/db/schema";
import {
	isValidProvider,
	getAppOAuthCredentials,
	buildOAuthState,
} from "@/lib/app-auth/oauth-utils";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

interface RouteParams {
	params: Promise<{ appId: string; provider: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, provider: providerParam } = await params;

		// Rate limit: 20 OAuth initiations per IP per hour
		const ip = getClientIp(_request);
		const rateCheck = checkRateLimit("oauth-init", `${appId}:${ip}`, 20, 60 * 60 * 1000);
		if (!rateCheck.allowed) {
			return NextResponse.json(
				{ error: "Too many OAuth attempts. Please try again later." },
				{ status: 429 },
			);
		}

		if (!isValidProvider(providerParam)) {
			return NextResponse.json(
				{ error: "Invalid provider. Supported: google, github" },
				{ status: 400 },
			);
		}
		const provider = providerParam;

		// Look up app and check provider is enabled
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const authSettings = await db.query.builderAppAuthSettings.findFirst({
			where: eq(builderAppAuthSettings.appDbId, app.dbId),
		});

		const isEnabled =
			provider === "google"
				? authSettings?.googleEnabled
				: authSettings?.githubEnabled;

		if (!isEnabled) {
			return NextResponse.json(
				{ error: `${provider} authentication is not enabled for this app` },
				{ status: 403 },
			);
		}

		// Get per-app OAuth credentials
		const creds = await getAppOAuthCredentials(appId, provider);
		if (!creds) {
			return NextResponse.json(
				{ error: `${provider} OAuth credentials are not configured for this app. Set them in Dashboard > Settings > Auth.` },
				{ status: 400 },
			);
		}

		// Build HMAC-signed state
		const state = buildOAuthState(appId);
		const redirectUri = `${SITE_URL}/api/apps/oauth/callback/${provider}`;

		let authUrl: string;
		if (provider === "google") {
			const params = new URLSearchParams({
				client_id: creds.clientId,
				redirect_uri: redirectUri,
				response_type: "code",
				scope: "openid email profile",
				state,
				prompt: "select_account",
			});
			authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
		} else {
			const params = new URLSearchParams({
				client_id: creds.clientId,
				redirect_uri: redirectUri,
				scope: "user:email",
				state,
			});
			authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
		}

		return NextResponse.redirect(authUrl);
	} catch (error) {
		console.error("[App OAuth] Initiation error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
