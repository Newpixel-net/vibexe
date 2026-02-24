/**
 * Environment Detail API — Get + Delete
 *
 * GET    /api/apps/{appId}/environments/{env}  — Environment details
 * DELETE /api/apps/{appId}/environments/{env}  — Drop environment DB
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import {
	getEnvironmentDatabase,
	deleteEnvironmentDatabase,
} from "@/lib/app-database/environment-manager";
import { getLastBackupTime } from "@/lib/app-backups/backup-manager";

interface RouteParams {
	params: Promise<{ appId: string; env: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	const { appId, env } = await params;
	try {
		const { appDbId } = await verifyAppAccess(appId);

		if (env === "development") {
			const { db } = await import("@/db");
			const { builderAppDatabases } = await import("@/db/schema");
			const { eq } = await import("drizzle-orm");
			const devDb = await db.query.builderAppDatabases.findFirst({
				where: eq(builderAppDatabases.appDbId, appDbId),
			});
			const lastBackup = await getLastBackupTime(appDbId, "development");
			return NextResponse.json({
				environment: "development",
				databaseName: devDb?.databaseName ?? "",
				status: devDb?.status ?? "pending",
				schemaVersion: 0,
				lastBackup: lastBackup?.toISOString() ?? null,
				promotedAt: null,
				promotedFrom: null,
				deploymentSubdomain: null,
			});
		}

		const envDb = await getEnvironmentDatabase(appDbId, env);
		if (!envDb) {
			return NextResponse.json({ error: "Environment not found" }, { status: 404 });
		}

		const lastBackup = await getLastBackupTime(appDbId, env);
		return NextResponse.json({
			environment: envDb.environment,
			databaseName: envDb.databaseName,
			status: envDb.status,
			schemaVersion: envDb.schemaVersion,
			lastBackup: lastBackup?.toISOString() ?? null,
			promotedAt: envDb.promotedAt?.toISOString() ?? null,
			promotedFrom: envDb.promotedFrom,
			deploymentSubdomain: envDb.deploymentSubdomain,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Unauthorized" },
			{ status: 401 },
		);
	}
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
	const { appId, env } = await params;
	try {
		const { appDbId } = await verifyAppAccess(appId);

		if (env === "development") {
			return NextResponse.json(
				{ error: "Cannot delete the development environment" },
				{ status: 400 },
			);
		}

		await deleteEnvironmentDatabase(appDbId, env);
		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Internal error" },
			{ status: 500 },
		);
	}
}
