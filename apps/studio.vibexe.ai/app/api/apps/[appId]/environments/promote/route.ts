/**
 * Environment Promote API
 *
 * POST /api/apps/{appId}/environments/promote
 * Body: { "from": "development", "to": "staging" }
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { promoteEnvironment } from "@/lib/app-database/environment-manager";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

const VALID_PROMOTIONS = [
	["development", "staging"],
	["staging", "production"],
	["development", "production"],
];

export async function POST(request: NextRequest, { params }: RouteParams) {
	const { appId } = await params;
	try {
		const { appDbId } = await verifyAppAccess(appId);
		const body = await request.json();
		const { from, to } = body;

		if (!from || !to) {
			return NextResponse.json(
				{ error: "Both 'from' and 'to' environments are required" },
				{ status: 400 },
			);
		}

		const valid = VALID_PROMOTIONS.some(([f, t]) => f === from && t === to);
		if (!valid) {
			return NextResponse.json(
				{ error: `Invalid promotion path: ${from} → ${to}` },
				{ status: 400 },
			);
		}

		const result = await promoteEnvironment(appDbId, from, to);

		return NextResponse.json({
			success: true,
			from,
			to,
			newTables: result.newTables,
			newColumns: result.newColumns,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal error";
		const status = message.includes("Unauthorized") || message.includes("access denied") ? 401 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
