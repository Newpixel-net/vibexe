/**
 * Shared OAuth Utilities for App End-User Authentication
 *
 * Provides helper functions used by both the OAuth initiation and callback routes.
 * Reuses platform OAuth credentials with optional per-app overrides.
 */

import { createHmac, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { type BuilderAppId, builderAppDatabases, builderApps } from "@/db/schema";

// OAuth credentials — prefer app-specific env vars, fall back to platform credentials
const GOOGLE_CLIENT_ID =
	process.env.APP_OAUTH_GOOGLE_CLIENT_ID ??
	process.env.GOOGLE_CLIENT_ID ??
	"";
const GOOGLE_CLIENT_SECRET =
	process.env.APP_OAUTH_GOOGLE_CLIENT_SECRET ??
	process.env.GOOGLE_CLIENT_SECRET ??
	"";
const GITHUB_CLIENT_ID =
	process.env.APP_OAUTH_GITHUB_CLIENT_ID ??
	process.env.GITHUB_APP_CLIENT_ID ??
	process.env.GITHUB_CLIENT_ID ??
	"";
const GITHUB_CLIENT_SECRET =
	process.env.APP_OAUTH_GITHUB_CLIENT_SECRET ??
	process.env.GITHUB_APP_CLIENT_SECRET ??
	process.env.GITHUB_CLIENT_SECRET ??
	"";

const HMAC_SECRET = process.env.COOKIE_SECRET ?? "fallback-secret";

export type OAuthProvider = "google" | "github";

export function isValidProvider(p: string): p is OAuthProvider {
	return p === "google" || p === "github";
}

export function getClientId(provider: OAuthProvider): string {
	return provider === "google" ? GOOGLE_CLIENT_ID : GITHUB_CLIENT_ID;
}

/**
 * Resolve app database name from appId.
 * Shared across all app auth routes to avoid duplication.
 */
export async function resolveAppDb(
	appId: string,
): Promise<{ databaseName: string; appDbId: number } | null> {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});
	if (!app) return null;

	const appDb = await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, app.dbId),
	});
	if (!appDb || appDb.status !== "active") return null;

	return { databaseName: appDb.databaseName, appDbId: appDb.appDbId };
}

/**
 * Build an HMAC-signed OAuth state parameter.
 * Format: appId:nonce:timestamp:signature
 */
export function buildOAuthState(appId: string): string {
	const nonce = randomBytes(16).toString("hex");
	const ts = Date.now().toString();
	const payload = `${appId}:${nonce}:${ts}`;
	const sig = createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");
	return `${payload}:${sig}`;
}

/**
 * Verify and parse an HMAC-signed OAuth state parameter.
 * Returns the appId if valid, null if invalid or expired (5-minute window).
 */
export function verifyOAuthState(
	state: string,
): { appId: string } | null {
	const parts = state.split(":");
	if (parts.length !== 4) return null;

	const [appId, nonce, ts, sig] = parts;
	const payload = `${appId}:${nonce}:${ts}`;
	const expected = createHmac("sha256", HMAC_SECRET)
		.update(payload)
		.digest("hex");

	// Timing-safe comparison
	if (sig.length !== expected.length) return null;
	let match = true;
	for (let i = 0; i < sig.length; i++) {
		if (sig[i] !== expected[i]) match = false;
	}
	if (!match) return null;

	// Check 5-minute expiry
	const elapsed = Date.now() - Number.parseInt(ts, 10);
	if (elapsed > 5 * 60 * 1000 || elapsed < 0) return null;

	return { appId };
}

interface OAuthTokenResponse {
	access_token: string;
	token_type: string;
	scope?: string;
	error?: string;
	error_description?: string;
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeCodeForToken(
	provider: OAuthProvider,
	code: string,
	redirectUri: string,
): Promise<OAuthTokenResponse> {
	if (provider === "github") {
		const res = await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				client_id: GITHUB_CLIENT_ID,
				client_secret: GITHUB_CLIENT_SECRET,
				code,
				redirect_uri: redirectUri,
			}),
		});
		return res.json();
	}

	const res = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: GOOGLE_CLIENT_ID,
			client_secret: GOOGLE_CLIENT_SECRET,
			code,
			redirect_uri: redirectUri,
			grant_type: "authorization_code",
		}),
	});
	return res.json();
}

export interface OAuthUserInfo {
	id: string;
	email: string;
	name: string | null;
	avatar: string | null;
}

/**
 * Fetch user info from the OAuth provider using the access token.
 */
export async function fetchUserInfo(
	provider: OAuthProvider,
	accessToken: string,
): Promise<OAuthUserInfo> {
	if (provider === "github") {
		const userRes = await fetch("https://api.github.com/user", {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		const user = (await userRes.json()) as {
			id: number;
			email: string | null;
			name: string | null;
			avatar_url: string | null;
		};

		let email = user.email;
		if (!email) {
			const emailsRes = await fetch("https://api.github.com/user/emails", {
				headers: { Authorization: `Bearer ${accessToken}` },
			});
			const emails = await emailsRes.json();
			if (Array.isArray(emails)) {
				const primary = emails.find(
					(e: { primary?: boolean; verified?: boolean; email?: string }) =>
						e.primary && e.verified,
				);
				email = primary?.email || emails[0]?.email || "";
			}
		}

		return {
			id: String(user.id),
			email: email || "",
			name: user.name,
			avatar: user.avatar_url,
		};
	}

	// Google
	const res = await fetch(
		"https://www.googleapis.com/oauth2/v2/userinfo",
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);
	const user = (await res.json()) as {
		id: string;
		email: string;
		name: string;
		picture: string;
	};
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		avatar: user.picture,
	};
}
