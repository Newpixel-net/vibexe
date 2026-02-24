/**
 * Environments API — List + Create
 *
 * GET  /api/apps/{appId}/environments     — List all environments
 * POST /api/apps/{appId}/environments     — Create a new environment
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { listEnvironments, createEnvironmentDatabase } from "@/lib/app-database/environment-manager";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	const { appId } = await params;
	try {
		const { appDbId } = await verifyAppAccess(appId);
		const environments = await listEnvironments(appDbId);
		return NextResponse.json({ environments });
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
		const body = await request.json();
		const environment = body.environment;

		if (environment !== "staging" && environment !== "production") {
			return NextResponse.json(
				{ error: "Environment must be 'staging' or 'production'" },
				{ status: 400 },
			);
		}

		const result = await createEnvironmentDatabase(appDbId, environment);
		return NextResponse.json({ success: true, ...result });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal error";
		const status = message.includes("Unauthorized") || message.includes("access denied") ? 401 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
