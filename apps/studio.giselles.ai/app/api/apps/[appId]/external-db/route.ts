/**
 * External DB API
 *
 * GET  /api/apps/{appId}/external-db — Get current external DB config
 * POST /api/apps/{appId}/external-db — Save/update external DB config
 * DELETE /api/apps/{appId}/external-db — Remove external DB connection
 */

import { type NextRequest, NextResponse } from "next/server";
import {
	testSupabaseConnection,
	saveExternalDb,
	getExternalDb,
	removeExternalDb,
} from "@/lib/app-database/supabase-connect";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const externalDb = await getExternalDb(appId);
		return NextResponse.json({ externalDb });
	} catch (error) {
		console.error("[External DB API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const body = await request.json().catch(() => ({}));

		const { url, anonKey } = body;
		if (!url || !anonKey) {
			return NextResponse.json(
				{ error: "Supabase URL and anon key are required" },
				{ status: 400 },
			);
		}

		// Validate URL format
		try {
			new URL(url);
		} catch {
			return NextResponse.json(
				{ error: "Invalid Supabase URL" },
				{ status: 400 },
			);
		}

		// Test connection first
		const test = await testSupabaseConnection({ url, anonKey });
		if (!test.ok) {
			return NextResponse.json(
				{ error: `Connection failed: ${test.error}` },
				{ status: 400 },
			);
		}

		// Save encrypted credentials
		const result = await saveExternalDb(appId, { url, anonKey });
		if (!result.success) {
			return NextResponse.json(
				{ error: result.error || "Save failed" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[External DB API] POST error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const result = await removeExternalDb(appId);
		return NextResponse.json({ success: result.success });
	} catch (error) {
		console.error("[External DB API] DELETE error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
