/**
 * GitHub Repos API
 *
 * GET /api/apps/{appId}/github/repos — List user's accessible GitHub repos
 * Uses the user's GitHub OAuth token to fetch installations and repositories.
 */

import { NextResponse } from "next/server";
import { getOauthCredential } from "@/services/accounts/oauth-credentials";
import { buildGitHubUserClient } from "@/services/external/github/user-client";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		try {
			await verifyAppAccess(appId);
		} catch {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get user's GitHub OAuth credential
		const credential = await getOauthCredential("github");
		if (!credential) {
			return NextResponse.json(
				{ error: "GitHub not connected. Please connect your GitHub account first." },
				{ status: 401 },
			);
		}

		const client = buildGitHubUserClient({
			accessToken: credential.accessToken,
			expiresAt: credential.expiresAt,
			refreshToken: credential.refreshToken,
		});

		// Get all installations (orgs + personal)
		const installationsData = await client.getInstallations();

		// Fetch repos for each installation
		const installations = await Promise.all(
			installationsData.installations.map(async (inst) => {
				const reposData = await client.getRepositories(inst.id);
				return {
					id: inst.id,
					account: {
						login: inst.account?.login ?? "unknown",
						avatarUrl: inst.account && "avatar_url" in inst.account
							? inst.account.avatar_url
							: null,
						type: inst.account?.type ?? "User",
					},
					repos: reposData.repositories.map((repo) => ({
						owner: repo.owner.login,
						name: repo.name,
						fullName: repo.full_name,
						defaultBranch: repo.default_branch,
						private: repo.private,
					})),
				};
			}),
		);

		return NextResponse.json({ installations });
	} catch (error) {
		console.error("[GitHub Repos API] GET error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch GitHub repositories" },
			{ status: 500 },
		);
	}
}
