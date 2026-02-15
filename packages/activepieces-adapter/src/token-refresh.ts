/**
 * Token Refresh: Handles OAuth2 token refresh for expired credentials.
 */

import type { StoredCredential } from "./auth-resolver";

interface OAuth2Config {
	accessToken?: string;
	refreshToken?: string;
	tokenType?: string;
	expiresAt?: number;
	expiresIn?: number;
	tokenUrl?: string;
	clientId?: string;
	clientSecret?: string;
	[key: string]: unknown;
}

/**
 * Check if an OAuth2 token is expired or about to expire (within 5 minutes).
 */
function isTokenExpired(config: OAuth2Config): boolean {
	if (!config.expiresAt || Number.isNaN(config.expiresAt)) return false;
	const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
	return Date.now() >= config.expiresAt - bufferMs;
}

/**
 * Refresh an OAuth2 token using the refresh_token grant.
 */
async function refreshOAuth2Token(
	config: OAuth2Config,
): Promise<Partial<OAuth2Config>> {
	if (!config.refreshToken) {
		throw new Error("No refresh token available");
	}
	if (!config.tokenUrl) {
		throw new Error("No token URL configured for refresh");
	}

	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: config.refreshToken,
	});

	if (config.clientId) {
		body.set("client_id", config.clientId);
	}
	if (config.clientSecret) {
		body.set("client_secret", config.clientSecret);
	}

	const response = await fetch(config.tokenUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(
			`Token refresh failed (${response.status}): ${errorText}`,
		);
	}

	const tokens = (await response.json()) as Record<string, unknown>;

	const rawExpiresIn = tokens.expires_in;
	const expiresIn = typeof rawExpiresIn === "number" && rawExpiresIn > 0
		? rawExpiresIn
		: typeof rawExpiresIn === "string" && Number(rawExpiresIn) > 0
			? Number(rawExpiresIn)
			: undefined;

	return {
		accessToken: (tokens.access_token as string) ?? config.accessToken,
		refreshToken:
			(tokens.refresh_token as string) ?? config.refreshToken,
		tokenType: (tokens.token_type as string) ?? config.tokenType ?? "Bearer",
		expiresIn,
		expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
	};
}

/**
 * Ensure a credential has a fresh token. If the token is expired and
 * a refresh token is available, performs a refresh.
 *
 * Returns the credential unchanged if not OAuth2 or not expired.
 * Returns an updated credential with new tokens if refreshed.
 */
export async function ensureFreshToken(
	credential: StoredCredential,
): Promise<{ credential: StoredCredential; refreshed: boolean }> {
	if (credential.authType !== "oauth2") {
		return { credential, refreshed: false };
	}

	const config = credential.config as OAuth2Config;

	if (!isTokenExpired(config)) {
		return { credential, refreshed: false };
	}

	if (!config.refreshToken || !config.tokenUrl) {
		// Can't refresh - return as-is and hope the token still works
		return { credential, refreshed: false };
	}

	try {
		const newTokens = await refreshOAuth2Token(config);
		return {
			credential: {
				...credential,
				config: { ...config, ...newTokens },
			},
			refreshed: true,
		};
	} catch (error) {
		console.error("OAuth2 token refresh failed:", error);
		// Return original credential - the action will fail with an auth error
		return { credential, refreshed: false };
	}
}
