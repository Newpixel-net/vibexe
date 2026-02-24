/**
 * Migrations API — List migration history
 *
 * GET /api/apps/{appId}/migrations?environment=development&page=1&limit=20
 */

import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { builderAppDatabases } from "@/db/schema";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { resolveDatabase } from "@/lib/app-database/environment-manager";
import { executeQuery } from "@/lib/app-database/pool-manager";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	const { appId } = await params;
	try {
		const { appDbId } = await verifyAppAccess(appId);

		const environment = request.nextUrl.searchParams.get("environment") || "development";
		const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
		const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 20));
		const offset = (page - 1) * limit;

		const databaseName = await resolveDatabase(appDbId, environment);

		const migrations = await executeQuery<{
			id: number;
			version: number;
			description: string;
			up_sql: string;
			down_sql: string | null;
			schema_before: unknown;
			schema_after: unknown;
			applied_at: string;
			rolled_back_at: string | null;
			created_at: string;
		}>(
			databaseName,
			`SELECT id, version, description, up_sql, down_sql, schema_before, schema_after,
			        applied_at, rolled_back_at, created_at
			 FROM _app_migrations
			 ORDER BY version DESC
			 LIMIT $1 OFFSET $2`,
			[limit, offset],
		).catch(() => []); // Table may not exist yet

		return NextResponse.json({
			migrations: migrations.map((m) => ({
				id: m.id,
				version: m.version,
				description: m.description,
				upSql: m.up_sql,
				downSql: m.down_sql,
				appliedAt: m.applied_at,
				rolledBackAt: m.rolled_back_at,
				createdAt: m.created_at,
			})),
			environment,
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
