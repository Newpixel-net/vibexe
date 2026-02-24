/**
 * GitHub Branches API
 *
 * GET /api/apps/{appId}/github/branches?owner=X&repo=Y — List branches for a repo
 */

import { Octokit } from "@octokit/core";
import { NextResponse } from "next/server";
import { getOauthCredential } from "@/services/accounts/oauth-credentials";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		try {
			await verifyAppAccess(appId);
		} catch {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const owner = searchParams.get("owner");
		const repo = searchParams.get("repo");

		if (!owner || !repo) {
			return NextResponse.json(
				{ error: "owner and repo query params are required" },
				{ status: 400 },
			);
		}

		const credential = await getOauthCredential("github");
		if (!credential) {
			return NextResponse.json(
				{ error: "GitHub not connected" },
				{ status: 401 },
			);
		}

		const octokit = new Octokit({
			auth: credential.accessToken,
			headers: { "X-GitHub-Api-Version": "2022-11-28" },
		});

		const res = await octokit.request("GET /repos/{owner}/{repo}/branches", {
			owner,
			repo,
			per_page: 100,
		});

		const branches = res.data.map((b) => ({
			name: b.name,
			sha: b.commit.sha,
			protected: b.protected,
		}));

		return NextResponse.json({ branches });
	} catch (error) {
		console.error("[GitHub Branches API] GET error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch branches" },
			{ status: 500 },
		);
	}
}
