/**
 * Backups API — List + Create
 *
 * GET  /api/apps/{appId}/backups   — List backups (paginated, filterable)
 * POST /api/apps/{appId}/backups   — Trigger manual backup
 */

import { NextResponse, type NextRequest } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { builderAppBackups, builderAppDatabases } from "@/db/schema";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { createBackup } from "@/lib/app-backups/backup-manager";
import { resolveDatabase } from "@/lib/app-database/environment-manager";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	const { appId } = await params;
	try {
		const { appDbId } = await verifyAppAccess(appId);

		const envFilter = request.nextUrl.searchParams.get("environment");
		const typeFilter = request.nextUrl.searchParams.get("type");
		const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
		const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 20));
		const offset = (page - 1) * limit;

		const conditions = [eq(builderAppBackups.appDbId, appDbId)];
		if (envFilter) {
			conditions.push(eq(builderAppBackups.environment, envFilter));
		}
		if (typeFilter) {
			conditions.push(eq(builderAppBackups.backupType, typeFilter));
		}

		const backups = await db
			.select()
			.from(builderAppBackups)
			.where(and(...conditions))
			.orderBy(desc(builderAppBackups.createdAt))
			.limit(limit)
			.offset(offset);

		return NextResponse.json({
			backups: backups.map((b) => ({
				id: b.dbId,
				environment: b.environment,
				databaseName: b.databaseName,
				backupType: b.backupType,
				sizeBytes: b.sizeBytes,
				status: b.status,
				error: b.error,
				startedAt: b.startedAt?.toISOString() ?? null,
				completedAt: b.completedAt?.toISOString() ?? null,
				expiresAt: b.expiresAt?.toISOString() ?? null,
				createdAt: b.createdAt.toISOString(),
			})),
			page,
			limit,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Unauthorized" },
			{ status: 401 },
		);
	}
}

export async function POST(request: NextRequest, { params }: RouteParams) {
	const { appId } = await params;
	try {
		const { appDbId } = await verifyAppAccess(appId);
		const body = await request.json().catch(() => ({}));
		const environment = body.environment || "development";

		let databaseName: string;
		if (environment === "development") {
			const devDb = await db.query.builderAppDatabases.findFirst({
				where: eq(builderAppDatabases.appDbId, appDbId),
				columns: { databaseName: true },
			});
			if (!devDb) {
				return NextResponse.json({ error: "No database provisioned" }, { status: 404 });
			}
			databaseName = devDb.databaseName;
		} else {
			databaseName = await resolveDatabase(appDbId, environment);
		}

		const result = await createBackup({
			appDbId,
			databaseName,
			environment,
			backupType: "manual",
		});

		return NextResponse.json({
			success: true,
			backupId: result.backupDbId,
			s3Key: result.s3Key,
			sizeBytes: result.sizeBytes,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal error";
		const status = message.includes("Unauthorized") || message.includes("access denied") ? 401 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
