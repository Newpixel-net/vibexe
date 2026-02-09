import { redirect } from "next/navigation";
import { deleteOauthCredential, getSiteOrigin } from "@/app/(auth)/lib";
import type { OAuthProvider } from "./oauth-credentials";

// Prefer GitHub App client ID for OAuth - tokens from GitHub App OAuth
// have permission to call GET /user/installations (needed for vector stores)
const GITHUB_CLIENT_ID =
	process.env.GITHUB_APP_CLIENT_ID || process.env.GITHUB_CLIENT_ID || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

/**
 * Build direct OAuth URL for GitHub/Google.
 * Uses bare callback URL (no query params) so it matches the redirect_uri
 * used in the token exchange (callback/[provider]/route.ts).
 * The return URL is carried via the OAuth state parameter.
 */
function buildDirectOAuthUrl(
	provider: OAuthProvider,
	redirectUri: string,
	next: string,
): string {
	if (provider === "github") {
		const params = new URLSearchParams({
			client_id: GITHUB_CLIENT_ID,
			redirect_uri: redirectUri,
			scope: "read:user user:email repo",
			state: next,
		});
		return `https://github.com/login/oauth/authorize?${params.toString()}`;
	} else if (provider === "google") {
		const params = new URLSearchParams({
			client_id: GOOGLE_CLIENT_ID,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "openid email profile",
			state: next,
			access_type: "offline",
			prompt: "consent",
		});
		return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
	}
	throw new Error(`Unsupported OAuth provider: ${provider}`);
}

export function connectIdentity(provider: OAuthProvider, next: string): never {
	const redirectUri = `${getSiteOrigin()}/auth/callback/${provider}`;
	const oauthUrl = buildDirectOAuthUrl(provider, redirectUri, next);
	redirect(oauthUrl);
}

export function reconnectIdentity(
	provider: OAuthProvider,
	next: string,
): never {
	const redirectUri = `${getSiteOrigin()}/auth/callback/${provider}`;
	const oauthUrl = buildDirectOAuthUrl(provider, redirectUri, next);
	redirect(oauthUrl);
}

export async function disconnectIdentity(
	provider: OAuthProvider,
	next: string,
) {
	await deleteOauthCredential(provider);
	redirect(next);
}
