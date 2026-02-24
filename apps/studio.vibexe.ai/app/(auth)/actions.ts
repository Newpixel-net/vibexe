"use server";

import { redirect } from "next/navigation";
import { getSiteOrigin, isValidReturnUrl } from "@/app/(auth)/lib";
import { logger } from "@/lib/logger";
import type { OAuthProvider } from "@/services/accounts";

// Use same env var priority as callback route to avoid client_id mismatch
const GITHUB_CLIENT_ID =
	process.env.GITHUB_APP_CLIENT_ID || process.env.GITHUB_CLIENT_ID || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

function authorizeOAuth(provider: OAuthProvider, formData?: FormData): never {
	const returnUrlEntry = formData?.get("returnUrl");
	// Validate returnUrl to prevent open redirect attacks
	const validReturnUrl = isValidReturnUrl(returnUrlEntry)
		? returnUrlEntry
		: "/";

	// Use bare callback URL without query params so it matches the redirect_uri
	// used in the token exchange (callback/[provider]/route.ts).
	// The return URL is carried via the OAuth state parameter instead.
	const redirectUri = `${getSiteOrigin()}/auth/callback/${provider}`;

	let oauthUrl: string;

	if (provider === "github") {
		const params = new URLSearchParams({
			client_id: GITHUB_CLIENT_ID,
			redirect_uri: redirectUri,
			scope: "read:user user:email repo",
			state: validReturnUrl as string,
		});
		oauthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
	} else if (provider === "google") {
		const params = new URLSearchParams({
			client_id: GOOGLE_CLIENT_ID,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "openid email profile",
			state: validReturnUrl as string,
		});
		oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
	} else {
		throw new Error(`Unsupported OAuth provider: ${provider}`);
	}

	logger.debug(`Redirecting to ${provider} OAuth: ${oauthUrl}`);
	redirect(oauthUrl);
}

export async function authorizeGitHub(formData: FormData) {
	return await authorizeOAuth("github", formData);
}

export async function authorizeGoogle(formData: FormData) {
	return await authorizeOAuth("google", formData);
}
