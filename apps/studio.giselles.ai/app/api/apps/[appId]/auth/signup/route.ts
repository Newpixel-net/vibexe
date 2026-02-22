/**
 * App-level End-User Signup
 *
 * POST /api/apps/{appId}/auth/signup
 * Body: { email, password, display_name? }
 *
 * Creates a new end-user account in the app's isolated database,
 * starts a session, and returns user + token.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderAppDatabases,
	builderApps,
	builderAppAuthSettings,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { logAppEvent } from "@/lib/app-database/app-logger";
import { executeQuery } from "@/lib/app-database/pool-manager";

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

	return appDb.databaseName;
}

const SESSION_DURATION_DAYS = 30;

export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const databaseName = await resolveAppDb(appId);
		if (!databaseName) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const body = await request.json();
		const { email, password, display_name } = body as {
			email?: string;
			password?: string;
			display_name?: string;
		};

		if (!email || !password) {
			return NextResponse.json(
				{ error: "email and password are required" },
				{ status: 400 },
			);
		}

		// Validate email format
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return NextResponse.json(
				{ error: "Invalid email format" },
				{ status: 400 },
			);
		}

		// Validate password length
		if (password.length < 8) {
			return NextResponse.json(
				{ error: "Password must be at least 8 characters" },
				{ status: 400 },
			);
		}

		// Check if email already exists
		const existing = await executeQuery<{ id: string }>(
			databaseName,
			`SELECT id FROM "_app_users" WHERE email = $1 LIMIT 1`,
			[email.toLowerCase()],
		);
		if (existing.length > 0) {
			return NextResponse.json(
				{ error: "Email already registered" },
				{ status: 409 },
			);
		}

		// Hash password
		const passwordHash = await hashPassword(password);

		// Check if app requires signup approval
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

		const userStatus = requireApproval ? "pending" : "active";

		// Insert user
		const users = await executeQuery<{
			id: string;
			email: string;
			display_name: string | null;
			role: string;
			email_verified: boolean;
			status: string;
			created_at: string;
		}>(
			databaseName,
			`INSERT INTO "_app_users" (email, password_hash, display_name, status)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id, email, display_name, role, email_verified, status, created_at`,
			[email.toLowerCase(), passwordHash, display_name || null, userStatus],
		);
		const user = users[0];

		// Log signup (fire-and-forget, don't await)
		logAppEvent(databaseName, {
			level: "info",
			category: "auth",
			eventType: "app.user.signup",
			message: `New user signed up: ${email.toLowerCase()}${requireApproval ? " (pending approval)" : ""}`,
			userId: Number(user.id),
			userEmail: email.toLowerCase(),
		});

		// If pending approval, skip session creation
		if (requireApproval) {
			return NextResponse.json(
				{
					pending: true,
					message: "Your account is pending approval",
				},
				{ status: 202 },
			);
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

		return NextResponse.json(
			{
				user: {
					id: user.id,
					email: user.email,
					display_name: user.display_name,
					role: user.role,
					email_verified: user.email_verified,
					created_at: user.created_at,
				},
				token,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("[App Auth] Signup error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
