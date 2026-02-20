/**
 * App-level End-User Signout
 *
 * POST /api/apps/{appId}/auth/signout
 * Header: Authorization: Bearer {token}
 *
 * Deletes the session from the app's isolated database.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderAppDatabases, builderApps } from "@/db/schema";
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

export async function POST(request: NextRequest, { params }: RouteParams) {
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

		// Delete session
		await executeQuery(
			databaseName,
			`DELETE FROM "_app_sessions" WHERE id = $1`,
			[token],
		);

		// Log signout (fire-and-forget, don't await)
		logAppEvent(databaseName, {
			level: "info",
			category: "auth",
			eventType: "app.user.signout",
			message: "User signed out",
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[App Auth] Signout error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
