import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchCurrentTeam } from "@/services/teams";
import { createCredential } from "@/services/integrations/credential-store";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	const appUrl =
		process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;

	if (error) {
		return NextResponse.redirect(
			`${appUrl}/settings/team/integrations?oauth_error=${encodeURIComponent(error)}`,
		);
	}

	if (!code || !state) {
		return NextResponse.redirect(
			`${appUrl}/settings/team/integrations?oauth_error=missing_params`,
		);
	}

	// Verify state
	const cookieStore = await cookies();
	const storedState = cookieStore.get("oauth2_state")?.value;
	const pieceName = cookieStore.get("oauth2_piece")?.value;

	if (!storedState || storedState !== state) {
		return NextResponse.redirect(
			`${appUrl}/settings/team/integrations?oauth_error=invalid_state`,
		);
	}

	if (!pieceName) {
		return NextResponse.redirect(
			`${appUrl}/settings/team/integrations?oauth_error=missing_piece`,
		);
	}

	// Clean up cookies
	cookieStore.delete("oauth2_state");
	cookieStore.delete("oauth2_piece");

	try {
		// Exchange code for tokens
		// The token URL and client credentials need to be provided per-piece
		// For now, store the authorization code and let the piece handle token exchange
		const team = await fetchCurrentTeam();

		await createCredential({
			teamDbId: team.dbId,
			pieceName,
			displayName: `${pieceName} (OAuth2)`,
			authType: "oauth2",
			config: {
				authorizationCode: code,
				redirectUri: `${appUrl}/api/integrations/oauth2/callback`,
				// The actual token exchange happens when the piece action runs
				// or can be done here with the piece's token URL
			},
		});

		return NextResponse.redirect(
			`${appUrl}/settings/team/integrations?oauth_success=true&piece=${encodeURIComponent(pieceName)}`,
		);
	} catch (err) {
		console.error("OAuth2 callback error:", err);
		return NextResponse.redirect(
			`${appUrl}/settings/team/integrations?oauth_error=token_exchange_failed`,
		);
	}
}
