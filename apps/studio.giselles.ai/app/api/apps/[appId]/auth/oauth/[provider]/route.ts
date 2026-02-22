/**
 * App-level OAuth Initiation
 *
 * GET /api/apps/{appId}/auth/oauth/{provider}
 *
 * Validates the provider is enabled for this app, builds an HMAC-signed
 * state parameter carrying the appId, and redirects to the OAuth provider's
 * authorization URL.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppAuthSettings } from "@/db/schema";
import {
	isValidProvider,
	getClientId,
	buildOAuthState,
} from "@/lib/app-auth/oauth-utils";

interface RouteParams {
	params: Promise<{ appId: string; provider: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, provider: providerParam } = await params;

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

		// Check that we have credentials configured
		const clientId = getClientId(provider);
		if (!clientId) {
			return NextResponse.json(
				{ error: `${provider} OAuth is not configured on this server` },
				{ status: 500 },
			);
		}

		// Build HMAC-signed state
		const state = buildOAuthState(appId);
		const redirectUri = `${SITE_URL}/api/apps/oauth/callback/${provider}`;

		let authUrl: string;
		if (provider === "google") {
			const params = new URLSearchParams({
				client_id: clientId,
				redirect_uri: redirectUri,
				response_type: "code",
				scope: "openid email profile",
				state,
				prompt: "select_account",
			});
			authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
		} else {
			const params = new URLSearchParams({
				client_id: clientId,
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
