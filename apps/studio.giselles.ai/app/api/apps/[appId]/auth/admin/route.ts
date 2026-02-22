/**
 * App-level Admin Actions for End-Users
 *
 * POST /api/apps/{appId}/auth/admin
 * Body: { action, userId, ... }
 *
 * Actions: suspend, activate, reset-password, revoke-sessions,
 *          approve, reject, get-sessions
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { type BuilderAppId, builderAppDatabases, builderApps } from "@/db/schema";
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

export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const databaseName = await resolveAppDb(appId);
		if (!databaseName) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const body = await request.json();
		const { action, userId } = body as {
			action?: string;
			userId?: number;
		};

		if (!action) {
			return NextResponse.json(
				{ error: "action is required" },
				{ status: 400 },
			);
		}

		if (!userId && action !== "get-sessions") {
			return NextResponse.json(
				{ error: "userId is required" },
				{ status: 400 },
			);
		}

		switch (action) {
			case "suspend": {
				await executeQuery(
					databaseName,
					`UPDATE "_app_users" SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
					[userId],
				);
				// Revoke all sessions on suspend
				await executeQuery(
					databaseName,
					`DELETE FROM "_app_sessions" WHERE user_id = $1`,
					[userId],
				);
				logAppEvent(databaseName, {
					level: "warn",
					category: "auth",
					eventType: "app.user.suspended",
					message: `User #${userId} suspended by admin`,
					userId: userId!,
				});
				return NextResponse.json({ success: true });
			}

			case "activate": {
				await executeQuery(
					databaseName,
					`UPDATE "_app_users" SET status = 'active', updated_at = NOW() WHERE id = $1`,
					[userId],
				);
				logAppEvent(databaseName, {
					level: "info",
					category: "auth",
					eventType: "app.user.activated",
					message: `User #${userId} activated by admin`,
					userId: userId!,
				});
				return NextResponse.json({ success: true });
			}

			case "reset-password": {
				const tempPassword = nanoid(12);
				const passwordHash = await hashPassword(tempPassword);
				await executeQuery(
					databaseName,
					`UPDATE "_app_users" SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
					[passwordHash, userId],
				);
				// Revoke all sessions after password reset
				await executeQuery(
					databaseName,
					`DELETE FROM "_app_sessions" WHERE user_id = $1`,
					[userId],
				);
				logAppEvent(databaseName, {
					level: "warn",
					category: "auth",
					eventType: "app.user.password_reset",
					message: `Password reset for user #${userId} by admin`,
					userId: userId!,
				});
				return NextResponse.json({ tempPassword });
			}

			case "revoke-sessions": {
				const deleted = await executeQuery<{ id: string }>(
					databaseName,
					`DELETE FROM "_app_sessions" WHERE user_id = $1 RETURNING id`,
					[userId],
				);
				logAppEvent(databaseName, {
					level: "info",
					category: "auth",
					eventType: "app.user.sessions_revoked",
					message: `${deleted.length} session(s) revoked for user #${userId}`,
					userId: userId!,
				});
				return NextResponse.json({ count: deleted.length });
			}

			case "approve": {
				const result = await executeQuery<{ id: string }>(
					databaseName,
					`UPDATE "_app_users" SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING id`,
					[userId],
				);
				if (result.length === 0) {
					return NextResponse.json(
						{ error: "User not found or not pending" },
						{ status: 404 },
					);
				}
				logAppEvent(databaseName, {
					level: "info",
					category: "auth",
					eventType: "app.user.approved",
					message: `User #${userId} approved by admin`,
					userId: userId!,
				});
				return NextResponse.json({ success: true });
			}

			case "reject": {
				const result = await executeQuery<{ id: string }>(
					databaseName,
					`DELETE FROM "_app_users" WHERE id = $1 AND status = 'pending' RETURNING id`,
					[userId],
				);
				if (result.length === 0) {
					return NextResponse.json(
						{ error: "User not found or not pending" },
						{ status: 404 },
					);
				}
				logAppEvent(databaseName, {
					level: "info",
					category: "auth",
					eventType: "app.user.rejected",
					message: `Pending user #${userId} rejected by admin`,
					userId: userId!,
				});
				return NextResponse.json({ success: true });
			}

			case "get-sessions": {
				const sessions = await executeQuery<{
					id: string;
					created_at: string;
					expires_at: string;
				}>(
					databaseName,
					`SELECT id, created_at, expires_at
					 FROM "_app_sessions"
					 WHERE user_id = $1 AND expires_at > NOW()
					 ORDER BY created_at DESC`,
					[userId],
				);
				return NextResponse.json({ sessions });
			}

			default:
				return NextResponse.json(
					{ error: `Unknown action: ${action}` },
					{ status: 400 },
				);
		}
	} catch (error) {
		console.error("[App Auth Admin] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
