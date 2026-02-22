/**
 * App-level OAuth Callback
 *
 * GET /api/apps/oauth/callback/{provider}
 *
 * Single callback URL per provider (no appId in path — appId travels in the
 * HMAC-signed state parameter). This keeps the redirect URI fixed so each
 * app creator only needs to register one callback URL per provider.
 *
 * Flow:
 * 1. Verify HMAC state -> extract appId
 * 2. Fetch per-app OAuth credentials from builder_app_auth_settings
 * 3. Exchange code for token using per-app credentials
 * 4. Fetch user info (email, name, avatar)
 * 5. Find-or-create _app_users row (link by email)
 * 6. Create _app_sessions row
 * 7. Return HTML that postMessages {token, user} to opener and closes
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppAuthSettings } from "@/db/schema";
import {
	isValidProvider,
	verifyOAuthState,
	resolveAppDb,
	getAppOAuthCredentials,
	exchangeCodeForToken,
	fetchUserInfo,
} from "@/lib/app-auth/oauth-utils";
import { executeQuery } from "@/lib/app-database/pool-manager";
import { logAppEvent } from "@/lib/app-database/app-logger";

interface RouteParams {
	params: Promise<{ provider: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const SESSION_DURATION_DAYS = 30;

function htmlResponse(body: string, status = 200): NextResponse {
	return new NextResponse(body, {
		status,
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

function errorPage(message: string): NextResponse {
	return htmlResponse(
		`<!DOCTYPE html><html><head><title>OAuth Error</title></head><body>
<script>
if (window.opener) {
  window.opener.postMessage({ type: "vibexe-oauth", error: ${JSON.stringify(message)} }, "*");
  window.close();
} else {
  document.body.innerText = ${JSON.stringify(message)};
}
</script>
<noscript>${message}</noscript>
</body></html>`,
		400,
	);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { provider: providerParam } = await params;

		if (!isValidProvider(providerParam)) {
			return errorPage("Invalid OAuth provider");
		}
		const provider = providerParam;

		const { searchParams } = new URL(request.url);

		// Check for error from provider
		const oauthError = searchParams.get("error");
		if (oauthError) {
			return errorPage(
				searchParams.get("error_description") || oauthError,
			);
		}

		const code = searchParams.get("code");
		const state = searchParams.get("state");
		if (!code || !state) {
			return errorPage("Missing authorization code or state");
		}

		// Verify HMAC-signed state -> extract appId
		const stateData = verifyOAuthState(state);
		if (!stateData) {
			return errorPage("Invalid or expired OAuth state. Please try again.");
		}

		const { appId } = stateData;

		// Resolve app database
		const appDbInfo = await resolveAppDb(appId);
		if (!appDbInfo) {
			return errorPage("App not found");
		}
		const { databaseName, appDbId } = appDbInfo;

		// Fetch per-app OAuth credentials
		const creds = await getAppOAuthCredentials(appId, provider);
		if (!creds) {
			return errorPage("OAuth credentials not configured for this app");
		}

		// Exchange code for token using per-app credentials
		const redirectUri = `${SITE_URL}/api/apps/oauth/callback/${provider}`;
		const tokenData = await exchangeCodeForToken(provider, code, redirectUri, creds);
		if (!tokenData.access_token) {
			console.error("[App OAuth] Token exchange failed:", tokenData);
			return errorPage(
				tokenData.error_description || "Failed to authenticate with provider",
			);
		}

		// Fetch user info
		const userInfo = await fetchUserInfo(provider, tokenData.access_token);
		if (!userInfo.email) {
			return errorPage(
				"Could not retrieve email from your account. Please ensure your email is public or verified.",
			);
		}

		// Check requireApproval setting
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		let requireApproval = false;
		if (app) {
			const authSettings = await db.query.builderAppAuthSettings.findFirst({
				where: eq(builderAppAuthSettings.appDbId, app.dbId),
			});
			requireApproval = authSettings?.requireApproval ?? false;
		}

		// Find or create user (link by email)
		const existingUsers = await executeQuery<{
			id: string;
			email: string;
			display_name: string | null;
			role: string;
			email_verified: boolean;
			status: string;
			auth_provider: string | null;
			avatar_url: string | null;
			created_at: string;
		}>(
			databaseName,
			`SELECT id, email, display_name, role, email_verified, status, auth_provider, avatar_url, created_at
			 FROM "_app_users"
			 WHERE email = $1
			 LIMIT 1`,
			[userInfo.email.toLowerCase()],
		);

		let user: {
			id: string;
			email: string;
			display_name: string | null;
			role: string;
			email_verified: boolean;
			status: string;
			auth_provider: string | null;
			avatar_url: string | null;
			created_at: string;
		};

		if (existingUsers.length > 0) {
			// Existing user — update OAuth fields using COALESCE (don't overwrite)
			const existing = existingUsers[0];
			await executeQuery(
				databaseName,
				`UPDATE "_app_users"
				 SET auth_provider = COALESCE(auth_provider, $1),
				     provider_user_id = COALESCE(provider_user_id, $2),
				     avatar_url = COALESCE(avatar_url, $3),
				     display_name = COALESCE(display_name, $4),
				     email_verified = true,
				     last_login_at = NOW(),
				     updated_at = NOW()
				 WHERE id = $5`,
				[
					provider,
					userInfo.id,
					userInfo.avatar,
					userInfo.name,
					existing.id,
				],
			);
			user = {
				...existing,
				auth_provider: existing.auth_provider || provider,
				avatar_url: existing.avatar_url || userInfo.avatar,
				display_name: existing.display_name || userInfo.name,
				email_verified: true,
			};
		} else {
			// New user
			const userStatus = requireApproval ? "pending" : "active";
			const inserted = await executeQuery<typeof user>(
				databaseName,
				`INSERT INTO "_app_users" (email, password_hash, display_name, role, email_verified, status, auth_provider, provider_user_id, avatar_url)
				 VALUES ($1, NULL, $2, 'user', true, $3, $4, $5, $6)
				 RETURNING id, email, display_name, role, email_verified, status, auth_provider, avatar_url, created_at`,
				[
					userInfo.email.toLowerCase(),
					userInfo.name,
					userStatus,
					provider,
					userInfo.id,
					userInfo.avatar,
				],
			);
			user = inserted[0];
		}

		// Log OAuth event
		logAppEvent(databaseName, {
			level: "info",
			category: "auth",
			eventType: `app.user.oauth.${provider}`,
			message: `User authenticated via ${provider}: ${user.email}`,
			userId: Number(user.id),
			userEmail: user.email,
		});

		// Check if pending approval
		if (user.status === "pending") {
			return htmlResponse(
				`<!DOCTYPE html><html><head><title>Pending Approval</title></head><body>
<script>
if (window.opener) {
  window.opener.postMessage({ type: "vibexe-oauth", pending: true, error: "Account pending approval" }, "*");
  window.close();
} else {
  document.body.innerText = "Your account is pending approval.";
}
</script>
</body></html>`,
			);
		}

		if (user.status === "suspended") {
			return errorPage("Your account has been suspended");
		}

		// Create session
		const token = nanoid(48);
		const expiresAt = new Date(
			Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
		);

		await executeQuery(
			databaseName,
			`INSERT INTO "_app_sessions" (id, user_id, expires_at)
			 VALUES ($1, $2, $3)`,
			[token, user.id, expiresAt.toISOString()],
		);

		// Return HTML that postMessages the result to the opener window
		const userData = JSON.stringify({
			id: user.id,
			email: user.email,
			display_name: user.display_name,
			role: user.role,
			email_verified: user.email_verified,
			auth_provider: user.auth_provider,
			avatar_url: user.avatar_url,
			created_at: user.created_at,
		});

		return htmlResponse(
			`<!DOCTYPE html><html><head><title>Authentication Complete</title></head><body>
<script>
if (window.opener) {
  window.opener.postMessage({
    type: "vibexe-oauth",
    token: ${JSON.stringify(token)},
    user: ${userData}
  }, "*");
  window.close();
} else {
  document.body.innerText = "Authentication complete. You can close this window.";
}
</script>
<noscript>Authentication complete. You can close this window.</noscript>
</body></html>`,
		);
	} catch (error) {
		console.error("[App OAuth] Callback error:", error);
		return errorPage("Authentication failed. Please try again.");
	}
}
