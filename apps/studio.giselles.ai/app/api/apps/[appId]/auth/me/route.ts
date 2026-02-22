/**
 * App-level End-User Session Check
 *
 * GET /api/apps/{appId}/auth/me
 * Header: Authorization: Bearer {token}
 *
 * Returns the authenticated user if the session is valid and not expired.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderAppDatabases, builderApps } from "@/db/schema";
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

export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const databaseName = await resolveAppDb(appId);
		if (!databaseName) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		// Extract token from Authorization header
		const authHeader = request.headers.get("authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return NextResponse.json(
				{ error: "Missing or invalid Authorization header" },
				{ status: 401 },
			);
		}
		const token = authHeader.slice(7);

		// Look up session + user in one query
		const results = await executeQuery<{
			user_id: string;
			email: string;
			display_name: string | null;
			role: string;
			email_verified: boolean;
			status: string;
			last_login_at: string | null;
			created_at: string;
			session_expires_at: string;
		}>(
			databaseName,
			`SELECT
				u.id AS user_id,
				u.email,
				u.display_name,
				u.role,
				u.email_verified,
				u.status,
				u.last_login_at,
				u.created_at,
				s.expires_at AS session_expires_at
			 FROM "_app_sessions" s
			 JOIN "_app_users" u ON u.id = s.user_id
			 WHERE s.id = $1 AND s.expires_at > NOW()
			 LIMIT 1`,
			[token],
		);

		if (results.length === 0) {
			return NextResponse.json(
				{ error: "Invalid or expired session" },
				{ status: 401 },
			);
		}

		const row = results[0];

		// Reject suspended or pending users
		if (row.status === "suspended" || row.status === "pending") {
			return NextResponse.json(
				{ error: "Account is not active" },
				{ status: 401 },
			);
		}

		return NextResponse.json({
			user: {
				id: row.user_id,
				email: row.email,
				display_name: row.display_name,
				role: row.role,
				email_verified: row.email_verified,
				status: row.status,
				last_login_at: row.last_login_at,
				created_at: row.created_at,
			},
		});
	} catch (error) {
		console.error("[App Auth] Me error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
