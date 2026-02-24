/**
 * GitHub Pull API
 *
 * POST /api/apps/{appId}/github/pull — Pull latest files from GitHub into builder_files
 */

import { NextResponse } from "next/server";
import { getOauthCredential } from "@/services/accounts/oauth-credentials";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { pullFromGitHub } from "@/lib/github-sync/pull-from-github";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		try {
			await verifyAppAccess(appId);
		} catch {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const credential = await getOauthCredential("github");
		if (!credential) {
			return NextResponse.json(
				{ error: "GitHub not connected" },
				{ status: 401 },
			);
		}

		// Optional: deleteOrphans flag
		let deleteOrphans = false;
		try {
			const body = await request.json();
			deleteOrphans = body.deleteOrphans === true;
		} catch {
			// No body — use defaults
		}

		const result = await pullFromGitHub({
			appId,
			accessToken: credential.accessToken,
			deleteOrphans,
		});

		return NextResponse.json(result);
	} catch (error) {
		console.error("[GitHub Pull API] POST error:", error);
		const message = error instanceof Error ? error.message : "Pull failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
