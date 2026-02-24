/**
 * Migration Rollback API
 *
 * POST /api/apps/{appId}/migrations/{migrationId}/rollback
 * Body: { "environment": "development" }
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { resolveDatabase } from "@/lib/app-database/environment-manager";
import { rollbackMigration } from "@/lib/app-database/schema-executor";

interface RouteParams {
	params: Promise<{ appId: string; migrationId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
	const { appId, migrationId } = await params;
	try {
		const { appDbId } = await verifyAppAccess(appId);
		const id = Number(migrationId);
		if (Number.isNaN(id)) {
			return NextResponse.json({ error: "Invalid migration ID" }, { status: 400 });
		}

		const body = await request.json().catch(() => ({}));
		const environment = body.environment || "development";

		const databaseName = await resolveDatabase(appDbId, environment);

		const result = await rollbackMigration(databaseName, id);

		return NextResponse.json({
			success: true,
			rolledBack: {
				migrationId: id,
				version: result.version,
				description: result.description,
				environment,
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal error";
		const status = message.includes("Unauthorized") || message.includes("access denied") ? 401
			: message.includes("not found") ? 404
			: message.includes("already been rolled back") ? 400
			: 500;
		return NextResponse.json({ error: message }, { status });
	}
}
