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
		const { email, password } = body as {
			email?: string;
			password?: string;
		};

		if (!email || !password) {
			return NextResponse.json(
				{ error: "email and password are required" },
				{ status: 400 },
			);
		}

		// Look up user by email
		const users = await executeQuery<{
			id: string;
			email: string;
			display_name: string | null;
			password_hash: string;
			created_at: string;
		}>(
			databaseName,
			`SELECT id, email, display_name, password_hash, created_at
			 FROM "_app_users"
			 WHERE email = $1
			 LIMIT 1`,
			[email.toLowerCase()],
		);

		if (users.length === 0) {
			return NextResponse.json(
				{ error: "Invalid email or password" },
				{ status: 401 },
			);
		}

		const user = users[0];

		// Verify password
		const valid = await verifyPassword(password, user.password_hash);
		if (!valid) {
			return NextResponse.json(
				{ error: "Invalid email or password" },
				{ status: 401 },
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

		return NextResponse.json({
			user: {
				id: user.id,
				email: user.email,
				display_name: user.display_name,
				created_at: user.created_at,
			},
			token,
		});
	} catch (error) {
		console.error("[App Auth] Signin error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
