import { redirect } from "next/navigation";
import { deleteOauthCredential, getAuthCallbackUrl } from "@/app/(auth)/lib";
import type { OAuthProvider } from "./oauth-credentials";

// Prefer GitHub App client ID for OAuth - tokens from GitHub App OAuth
// have permission to call GET /user/installations (needed for vector stores)
const GITHUB_CLIENT_ID =
	process.env.GITHUB_APP_CLIENT_ID || process.env.GITHUB_CLIENT_ID || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

/**
 * Build direct OAuth URL for GitHub/Google
 */
function buildDirectOAuthUrl(
	provider: OAuthProvider,
	callbackUrl: string,
	next: string,
): string {
	if (provider === "github") {
		const params = new URLSearchParams({
			client_id: GITHUB_CLIENT_ID,
			redirect_uri: callbackUrl,
			scope: "read:user user:email repo",
			state: next,
		});
		return `https://github.com/login/oauth/authorize?${params.toString()}`;
	} else if (provider === "google") {
		const params = new URLSearchParams({
			client_id: GOOGLE_CLIENT_ID,
			redirect_uri: callbackUrl,
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
	const redirectTo = getAuthCallbackUrl({ next, provider });
	const oauthUrl = buildDirectOAuthUrl(provider, redirectTo, next);
	redirect(oauthUrl);
}

export function reconnectIdentity(
	provider: OAuthProvider,
	next: string,
): never {
	const redirectTo = getAuthCallbackUrl({ next, provider });
	const oauthUrl = buildDirectOAuthUrl(provider, redirectTo, next);
	redirect(oauthUrl);
}

export async function disconnectIdentity(
	provider: OAuthProvider,
	next: string,
) {
	await deleteOauthCredential(provider);
	redirect(next);
}
