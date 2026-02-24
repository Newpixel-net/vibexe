/**
 * GitHub Push API
 *
 * POST /api/apps/{appId}/github/push — Push all app files to GitHub
 */

import { NextResponse } from "next/server";
import { getOauthCredential } from "@/services/accounts/oauth-credentials";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import { pushToGitHub } from "@/lib/github-sync/push-to-github";

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

		// Optional custom commit message
		let commitMessage: string | undefined;
		try {
			const body = await request.json();
			commitMessage = body.message;
		} catch {
			// No body or invalid JSON — use default message
		}

		const apiOrigin = new URL(request.url).origin;

		const result = await pushToGitHub({
			appId,
			accessToken: credential.accessToken,
			commitMessage,
			apiOrigin,
		});

		return NextResponse.json(result);
	} catch (error) {
		console.error("[GitHub Push API] POST error:", error);
		const message = error instanceof Error ? error.message : "Push failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
