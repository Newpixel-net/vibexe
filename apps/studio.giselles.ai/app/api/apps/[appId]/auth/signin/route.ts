/**
 * App-level End-User Signin
 *
 * POST /api/apps/{appId}/auth/signin
 * Body: { email, password }
 *
 * Authenticates an end-user against the app's isolated database,
 * creates a session, and returns user + token.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { type BuilderAppId, builderAppDatabases, builderApps } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { logAppEvent } from "@/lib/app-database/app-logger";
import { dispatchWebhooks } from "@/lib/app-webhooks/dispatcher";
import { executeQuery } from "@/lib/app-database/pool-manager";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";
import { handleAuthOptions, withCors } from "@/lib/app-auth/cors";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

async function resolveAppDb(appId: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});
	if (!app) return null;

	const appDb = await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, app.dbId),
	});
	if (!appDb || appDb.status !== "active") return null;

	return { databaseName: appDb.databaseName, appDbId: app.dbId };
}

const SESSION_DURATION_DAYS = 30;

export const OPTIONS = () => handleAuthOptions();

export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;

		// Rate limit: 5 signin attempts per IP per minute
		const ip = getClientIp(request);
		const rateCheck = checkRateLimit("signin", `${appId}:${ip}`, 5, 60 * 1000);
		if (!rateCheck.allowed) {
			return withCors(NextResponse.json(
				{ error: "Too many login attempts. Please try again later." },
				{ status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)) } },
			));
		}

		const appInfo = await resolveAppDb(appId);
		if (!appInfo) {
			return withCors(NextResponse.json({ error: "App not found" }, { status: 404 }));
		}
		const { databaseName, appDbId } = appInfo;

		const body = await request.json();
		const { email, password } = body as {
			email?: string;
			password?: string;
		};

		if (!email || !password) {
			return withCors(NextResponse.json(
				{ error: "email and password are required" },
				{ status: 400 },
			));
		}

		// Look up user by email
		const users = await executeQuery<{
			id: string;
			email: string;
			display_name: string | null;
			password_hash: string;
			role: string;
			email_verified: boolean;
			status: string;
			created_at: string;
		}>(
			databaseName,
			`SELECT id, email, display_name, password_hash, role, email_verified, status, created_at
			 FROM "_app_users"
			 WHERE email = $1
			 LIMIT 1`,
			[email.toLowerCase()],
		);

		if (users.length === 0) {
			return withCors(NextResponse.json(
				{ error: "Invalid email or password" },
				{ status: 401 },
			));
		}

		const user = users[0];

		// OAuth-only users cannot sign in with password
		if (!user.password_hash) {
			return withCors(NextResponse.json(
				{ error: "This account uses social login. Please sign in with Google or GitHub." },
				{ status: 400 },
			));
		}

		// Verify password
		const valid = await verifyPassword(password, user.password_hash);
		if (!valid) {
			return withCors(NextResponse.json(
				{ error: "Invalid email or password" },
				{ status: 401 },
			));
		}

		// Check account status
		if (user.status === "suspended") {
			return withCors(NextResponse.json(
				{ error: "Account is suspended" },
				{ status: 403 },
			));
		}
		if (user.status === "pending") {
			return withCors(NextResponse.json(
				{ error: "Account is pending approval" },
				{ status: 403 },
			));
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

		// Update last_login_at (fire-and-forget)
		executeQuery(
			databaseName,
			`UPDATE "_app_users" SET last_login_at = NOW() WHERE id = $1`,
			[user.id],
		);

		// Log signin (fire-and-forget, don't await)
		logAppEvent(databaseName, {
			level: "info",
			category: "auth",
			eventType: "app.user.signin",
			message: `User signed in: ${user.email}`,
			userId: Number(user.id),
			userEmail: user.email,
		});

		// Dispatch webhooks (fire-and-forget)
		dispatchWebhooks(appDbId, appId, "user.signin", null, {
			id: user.id,
			email: user.email,
		});

		return withCors(NextResponse.json({
			user: {
				id: user.id,
				email: user.email,
				display_name: user.display_name,
				role: user.role,
				email_verified: user.email_verified,
				created_at: user.created_at,
			},
			token,
		}));
	} catch (error) {
		console.error("[App Auth] Signin error:", error);
		return withCors(NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		));
	}
}
