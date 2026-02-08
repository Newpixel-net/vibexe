import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const pieceName = url.searchParams.get("pieceName");
	const authUrl = url.searchParams.get("authUrl");
	const clientId = url.searchParams.get("clientId");
	const scope = url.searchParams.get("scope") ?? "";

	if (!pieceName || !authUrl || !clientId) {
		return NextResponse.json(
			{ error: "pieceName, authUrl, and clientId are required" },
			{ status: 400 },
		);
	}

	const state = randomBytes(32).toString("hex");
	const appUrl =
		process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
	const redirectUri = `${appUrl}/api/integrations/oauth2/callback`;

	// Store state in a cookie for verification on callback
	const cookieStore = await cookies();
	cookieStore.set("oauth2_state", state, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 600, // 10 minutes
		path: "/",
	});
	cookieStore.set("oauth2_piece", pieceName, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 600,
		path: "/",
	});

	const authorizationUrl = new URL(authUrl);
	authorizationUrl.searchParams.set("client_id", clientId);
	authorizationUrl.searchParams.set("redirect_uri", redirectUri);
	authorizationUrl.searchParams.set("response_type", "code");
	authorizationUrl.searchParams.set("state", state);
	if (scope) {
		authorizationUrl.searchParams.set("scope", scope);
	}
	authorizationUrl.searchParams.set("access_type", "offline");
	authorizationUrl.searchParams.set("prompt", "consent");

	return NextResponse.redirect(authorizationUrl.toString());
}
