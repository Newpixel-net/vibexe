import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchCurrentTeam } from "@/services/teams";
import {
	createCredential,
	getCredentialForPiece,
	updateCredential,
} from "@/services/integrations/credential-store";
import { getOAuthAppConfig } from "@/services/integrations/oauth-app-config";
import { closePopupHtml } from "./close-popup";

function htmlResponse(html: string, status = 200) {
	return new NextResponse(html, {
		status,
		headers: { "Content-Type": "text/html" },
	});
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	if (error) {
		return htmlResponse(
			closePopupHtml(false, `Provider denied access: ${error}`),
		);
	}

	if (!code || !state) {
		return htmlResponse(
			closePopupHtml(false, "Missing authorization code or state parameter."),
		);
	}

	// Verify state against cookie
	const cookieStore = await cookies();
	const storedState = cookieStore.get("oauth2_state")?.value;
	const pieceName = cookieStore.get("oauth2_piece")?.value;
	const provider = cookieStore.get("oauth2_provider")?.value;

	if (!storedState || storedState !== state) {
		return htmlResponse(
			closePopupHtml(
				false,
				"Security verification failed. Please try again.",
			),
		);
	}

	if (!pieceName || !provider) {
		return htmlResponse(
			closePopupHtml(false, "Session expired. Please try again."),
		);
	}

	// Clean up cookies
	cookieStore.delete("oauth2_state");
	cookieStore.delete("oauth2_piece");
	cookieStore.delete("oauth2_provider");

	try {
		// 1. Get the OAuth app config (client_id + client_secret)
		const appConfig = await getOAuthAppConfig(provider);
		if (!appConfig) {
			return htmlResponse(
				closePopupHtml(
					false,
					`No OAuth app configured for "${provider}". Ask your admin to set it up.`,
				),
			);
		}

		// 2. Get piece auth metadata for tokenUrl
		const { getPieceOAuth2Metadata } = await import(
			"@giselles-ai/activepieces-adapter/server"
		);
		const authMeta = await getPieceOAuth2Metadata(pieceName);
		if (!authMeta) {
			return htmlResponse(
				closePopupHtml(
					false,
					`Could not find auth metadata for "${pieceName}".`,
				),
			);
		}

		// 3. Exchange authorization code for tokens
		const appUrl =
			process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
		const redirectUri = `${appUrl}/api/integrations/oauth2/callback`;
		const tokenBody = new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: redirectUri,
		});

		// Add client credentials based on authorization method
		const useHeaderAuth = authMeta.authorizationMethod === "HEADER";
		const headers: Record<string, string> = {
			"Content-Type": "application/x-www-form-urlencoded",
		};

		if (useHeaderAuth) {
			headers.Authorization = `Basic ${Buffer.from(
				`${appConfig.clientId}:${appConfig.clientSecret}`,
			).toString("base64")}`;
		} else {
			tokenBody.set("client_id", appConfig.clientId);
			tokenBody.set("client_secret", appConfig.clientSecret);
		}

		const tokenResponse = await fetch(authMeta.tokenUrl, {
			method: "POST",
			headers,
			body: tokenBody.toString(),
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse
				.text()
				.catch(() => "Unknown error");
			console.error(
				`OAuth2 token exchange failed (${tokenResponse.status}):`,
				errorText,
			);
			return htmlResponse(
				closePopupHtml(
					false,
					"Token exchange failed. The provider rejected the request.",
				),
			);
		}

		const tokens = (await tokenResponse.json()) as Record<string, unknown>;

		// 4. Build credential config with all necessary data for future refreshes
		const now = Date.now();
		const expiresIn = tokens.expires_in as number | undefined;
		const credentialConfig: Record<string, unknown> = {
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			tokenType: tokens.token_type ?? "Bearer",
			expiresIn,
			expiresAt: expiresIn ? now + expiresIn * 1000 : undefined,
			scope: tokens.scope,
			// Store info needed for token refresh
			tokenUrl: authMeta.tokenUrl,
			clientId: appConfig.clientId,
			clientSecret: appConfig.clientSecret,
			authorizationMethod: authMeta.authorizationMethod,
			// Store any additional data the provider returned
			data: tokens,
		};

		// 5. Store or update the credential
		const team = await fetchCurrentTeam();
		const existing = await getCredentialForPiece(team.dbId, pieceName);

		if (existing) {
			await updateCredential({
				teamDbId: team.dbId,
				credentialId: existing.dbId,
				config: credentialConfig,
			});
		} else {
			await createCredential({
				teamDbId: team.dbId,
				pieceName,
				displayName: `${pieceName} (OAuth2)`,
				authType: "oauth2",
				config: credentialConfig,
			});
		}

		return htmlResponse(
			closePopupHtml(
				true,
				`Successfully connected ${pieceName}! Your credential has been saved.`,
				pieceName,
			),
		);
	} catch (err) {
		console.error("OAuth2 callback error:", err);
		return htmlResponse(
			closePopupHtml(
				false,
				"An unexpected error occurred during connection. Please try again.",
			),
		);
	}
}
