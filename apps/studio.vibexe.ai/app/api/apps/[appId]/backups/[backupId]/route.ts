/**
 * Backup Detail API — Get + Delete
 *
 * GET    /api/apps/{appId}/backups/{backupId}  — Backup details
 * DELETE /api/apps/{appId}/backups/{backupId}  — Delete backup
 */

import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { builderAppBackups } from "@/db/schema";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { deleteBackup } from "@/lib/app-backups/backup-manager";

interface RouteParams {
	params: Promise<{ appId: string; backupId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	const { appId, backupId } = await params;
	try {
		await verifyAppAccess(appId);
		const id = Number(backupId);
		if (Number.isNaN(id)) {
			return NextResponse.json({ error: "Invalid backup ID" }, { status: 400 });
		}

		const backup = await db.query.builderAppBackups.findFirst({
			where: eq(builderAppBackups.dbId, id),
		});

		if (!backup) {
			return NextResponse.json({ error: "Backup not found" }, { status: 404 });
		}

		return NextResponse.json({
			id: backup.dbId,
			environment: backup.environment,
			databaseName: backup.databaseName,
			backupType: backup.backupType,
			s3Key: backup.s3Key,
			sizeBytes: backup.sizeBytes,
			status: backup.status,
			error: backup.error,
			startedAt: backup.startedAt?.toISOString() ?? null,
			completedAt: backup.completedAt?.toISOString() ?? null,
			expiresAt: backup.expiresAt?.toISOString() ?? null,
			metadata: backup.metadata,
			createdAt: backup.createdAt.toISOString(),
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Unauthorized" },
			{ status: 401 },
		);
	}
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
	const { appId, backupId } = await params;
	try {
		await verifyAppAccess(appId);
		const id = Number(backupId);
		if (Number.isNaN(id)) {
			return NextResponse.json({ error: "Invalid backup ID" }, { status: 400 });
		}

		await deleteBackup(id);
		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Internal error" },
			{ status: 500 },
		);
	}
}
