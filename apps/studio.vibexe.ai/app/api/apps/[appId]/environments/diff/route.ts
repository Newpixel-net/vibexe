/**
 * Environment Schema Diff API
 *
 * GET /api/apps/{appId}/environments/diff?from=development&to=staging
 * Returns schema differences between two environments without applying.
 */

import { NextResponse, type NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { builderAppDatabases, builderAppEnvironments } from "@/db/schema";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { diffSchemas } from "@/lib/app-database/environment-manager";
import type { AppSchema } from "@/lib/app-database/schema-types";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

async function getSchemaForEnv(appDbId: number, env: string): Promise<AppSchema | null> {
	if (env === "development") {
		const devDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, appDbId),
			columns: { schemaJson: true },
		});
		return (devDb?.schemaJson as AppSchema) ?? null;
	}

	const envDb = await db.query.builderAppEnvironments.findFirst({
		where: and(
			eq(builderAppEnvironments.appDbId, appDbId),
			eq(builderAppEnvironments.environment, env),
		),
		columns: { schemaJson: true },
	});
	return (envDb?.schemaJson as AppSchema) ?? null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	const { appId } = await params;
	try {
		const { appDbId } = await verifyAppAccess(appId);
		const from = request.nextUrl.searchParams.get("from") || "development";
		const to = request.nextUrl.searchParams.get("to") || "staging";

		const fromSchema = await getSchemaForEnv(appDbId, from);
		const toSchema = await getSchemaForEnv(appDbId, to);

		const diff = diffSchemas(fromSchema, toSchema);

		return NextResponse.json({
			from,
			to,
			hasChanges: diff.newTables.length > 0 || diff.newColumns.length > 0 || diff.removedTables.length > 0 || diff.removedColumns.length > 0,
			...diff,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Unauthorized" },
			{ status: 401 },
		);
	}
}
