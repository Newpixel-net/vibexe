import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getOAuthProvider } from "@giselles-ai/activepieces-adapter";
import { getOAuthAppConfig } from "@/services/integrations/oauth-app-config";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const pieceName = url.searchParams.get("pieceName");

	if (!pieceName) {
		return NextResponse.json(
			{ error: "pieceName query parameter is required" },
			{ status: 400 },
		);
	}

	// 1. Get OAuth app config for this piece's provider
	const provider = getOAuthProvider(pieceName);
	const appConfig = await getOAuthAppConfig(provider);
	if (!appConfig) {
		return NextResponse.json(
			{
				error: `No OAuth app configured for provider "${provider}". Ask your admin to configure it in Settings > OAuth Apps.`,
			},
			{ status: 404 },
		);
	}

	// 2. Get auth metadata from the piece (authUrl, tokenUrl, scope, etc.)
	const { getPieceOAuth2Metadata } = await import(
		"@giselles-ai/activepieces-adapter/server"
	);
	const authMeta = await getPieceOAuth2Metadata(pieceName);
	if (!authMeta) {
		return NextResponse.json(
			{
				error: `Piece "${pieceName}" does not have OAuth2 authentication metadata.`,
			},
			{ status: 400 },
		);
	}

	// 3. Generate state for CSRF protection
	const state = randomBytes(32).toString("hex");
	const appUrl =
		process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
	const redirectUri = `${appUrl}/api/integrations/oauth2/callback`;

	// 4. Store state + context in cookies
	const cookieStore = await cookies();
	cookieStore.set("oauth2_state", state, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 600,
		path: "/",
	});
	cookieStore.set("oauth2_piece", pieceName, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 600,
		path: "/",
	});
	cookieStore.set("oauth2_provider", provider, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 600,
		path: "/",
	});

	// 5. Build the authorization URL
	const authorizationUrl = new URL(authMeta.authUrl);
	authorizationUrl.searchParams.set("client_id", appConfig.clientId);
	authorizationUrl.searchParams.set("redirect_uri", redirectUri);
	authorizationUrl.searchParams.set("response_type", "code");
	authorizationUrl.searchParams.set("state", state);

	// Use admin-configured scopes if set, otherwise use piece defaults
	const scopeString = appConfig.scopes
		? appConfig.scopes
		: authMeta.scope.join(" ");
	if (scopeString) {
		authorizationUrl.searchParams.set("scope", scopeString);
	}

	// Apply provider-specific extra params from piece metadata
	if (authMeta.extra) {
		for (const [key, value] of Object.entries(authMeta.extra)) {
			authorizationUrl.searchParams.set(key, value);
		}
	}

	// Apply prompt preference from piece metadata
	if (authMeta.prompt && authMeta.prompt !== "omit") {
		authorizationUrl.searchParams.set("prompt", authMeta.prompt);
	}

	// Apply extra params from admin config (can override piece defaults)
	if (appConfig.extraParams) {
		for (const [key, value] of Object.entries(appConfig.extraParams)) {
			authorizationUrl.searchParams.set(key, value);
		}
	}

	return NextResponse.redirect(authorizationUrl.toString());
}
