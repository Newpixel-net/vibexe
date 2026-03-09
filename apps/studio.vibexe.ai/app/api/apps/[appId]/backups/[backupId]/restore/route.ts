/**
 * Backup Restore API
 *
 * POST /api/apps/{appId}/backups/{backupId}/restore
 * Body: { "confirm": true }
 *
 * Auto-creates a backup of the current state before restoring.
 */

import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { builderAppBackups, builderAppDatabases } from "@/db/schema";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { createBackup, restoreBackup } from "@/lib/app-backups/backup-manager";

interface RouteParams {
	params: Promise<{ appId: string; backupId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
	const { appId, backupId } = await params;
	try {
		const { appDbId } = await verifyAppAccess(appId);
		const id = Number(backupId);
		if (Number.isNaN(id)) {
			return NextResponse.json({ error: "Invalid backup ID" }, { status: 400 });
		}

		const body = await request.json().catch(() => ({}));
		if (!body.confirm) {
			return NextResponse.json(
				{ error: "Restore requires { \"confirm\": true } in body" },
				{ status: 400 },
			);
		}

		// Get backup details — scoped to the authenticated app to prevent cross-app IDOR
		const backup = await db.query.builderAppBackups.findFirst({
			where: and(
				eq(builderAppBackups.dbId, id),
				eq(builderAppBackups.appDbId, appDbId),
			),
		});
		if (!backup) {
			return NextResponse.json({ error: "Backup not found" }, { status: 404 });
		}
		if (backup.status !== "completed") {
			return NextResponse.json(
				{ error: `Backup is not in completed state (status: ${backup.status})` },
				{ status: 400 },
			);
		}

		// Determine target database
		const targetDatabaseName = backup.databaseName;

		// Auto-backup current state before restoring
		try {
			await createBackup({
				appDbId,
				databaseName: targetDatabaseName,
				environment: backup.environment,
				backupType: "pre-deploy", // "pre-deploy" type is closest to pre-restore
			});
		} catch (backupErr) {
			console.error("[Restore] Pre-restore backup failed:", backupErr);
			// Continue with restore even if pre-backup fails
		}

		// Perform restore
		await restoreBackup({
			backupDbId: id,
			targetDatabaseName,
		});

		return NextResponse.json({
			success: true,
			restoredFrom: {
				backupId: id,
				environment: backup.environment,
				backupType: backup.backupType,
				createdAt: backup.createdAt.toISOString(),
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal error";
		const status = message.includes("Unauthorized") || message.includes("access denied") ? 401 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
