/**
 * Shared OAuth Utilities for App End-User Authentication
 *
 * Provides helper functions used by both the OAuth initiation and callback routes.
 * Each app configures its own OAuth credentials in Dashboard > Settings > Auth.
 */

import { createHmac, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderAppAuthSettings,
	builderAppDatabases,
	builderApps,
} from "@/db/schema";

const HMAC_SECRET = process.env.COOKIE_SECRET ?? "fallback-secret";

export type OAuthProvider = "google" | "github";

export function isValidProvider(p: string): p is OAuthProvider {
	return p === "google" || p === "github";
}

/** Per-app OAuth credentials stored in builder_app_auth_settings */
export interface AppOAuthCredentials {
	clientId: string;
	clientSecret: string;
}

/**
 * Fetch per-app OAuth credentials for a given provider.
 * Returns null if the app or credentials are not found.
 */
export async function getAppOAuthCredentials(
	appId: string,
	provider: OAuthProvider,
): Promise<AppOAuthCredentials | null> {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});
	if (!app) return null;

	const settings = await db.query.builderAppAuthSettings.findFirst({
		where: eq(builderAppAuthSettings.appDbId, app.dbId),
	});
	if (!settings) return null;

	if (provider === "google") {
		if (!settings.googleClientId || !settings.googleClientSecret) return null;
		return {
			clientId: settings.googleClientId,
			clientSecret: settings.googleClientSecret,
		};
	}

	if (!settings.githubClientId || !settings.githubClientSecret) return null;
	return {
		clientId: settings.githubClientId,
		clientSecret: settings.githubClientSecret,
	};
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
 * Uses per-app credentials passed as parameter.
 */
export async function exchangeCodeForToken(
	provider: OAuthProvider,
	code: string,
	redirectUri: string,
	creds: AppOAuthCredentials,
): Promise<OAuthTokenResponse> {
	if (provider === "github") {
		const res = await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				client_id: creds.clientId,
				client_secret: creds.clientSecret,
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
			client_id: creds.clientId,
			client_secret: creds.clientSecret,
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
