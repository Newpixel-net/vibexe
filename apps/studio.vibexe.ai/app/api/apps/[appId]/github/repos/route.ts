/**
 * GitHub Repos API
 *
 * GET /api/apps/{appId}/github/repos — List user's accessible GitHub repos
 *
 * Strategy: Try GitHub App installations first (getInstallations → getRepositories).
 * If that fails (no App installed, or regular OAuth token), fall back to
 * GET /user/repos which works with any GitHub OAuth token.
 */

import { Octokit } from "@octokit/core";
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

		// Try GitHub App installations first
		try {
			const client = buildGitHubUserClient({
				accessToken: credential.accessToken,
				expiresAt: credential.expiresAt,
				refreshToken: credential.refreshToken,
			});

			const installationsData = await client.getInstallations();

			if (installationsData.installations.length > 0) {
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
			}
		} catch {
			// App installations not available — fall through to user repos
		}

		// Fallback: List repos via user's personal OAuth token (GET /user/repos)
		const octokit = new Octokit({
			auth: credential.accessToken,
			headers: { "X-GitHub-Api-Version": "2022-11-28" },
		});

		// Get user info for the account grouping
		const userRes = await octokit.request("GET /user");
		const user = userRes.data;

		// Get user's repos (owned + collaborator, sorted by recently pushed)
		const reposRes = await octokit.request("GET /user/repos", {
			sort: "pushed",
			direction: "desc",
			per_page: 100,
			affiliation: "owner,collaborator,organization_member",
		});

		// Group repos by owner (user vs org)
		const reposByOwner = new Map<string, {
			login: string;
			avatarUrl: string | null;
			type: string;
			repos: Array<{
				owner: string;
				name: string;
				fullName: string;
				defaultBranch: string;
				private: boolean;
			}>;
		}>();

		for (const repo of reposRes.data) {
			const ownerLogin = repo.owner.login;
			if (!reposByOwner.has(ownerLogin)) {
				reposByOwner.set(ownerLogin, {
					login: ownerLogin,
					avatarUrl: repo.owner.avatar_url,
					type: repo.owner.type,
					repos: [],
				});
			}
			reposByOwner.get(ownerLogin)!.repos.push({
				owner: repo.owner.login,
				name: repo.name,
				fullName: repo.full_name,
				defaultBranch: repo.default_branch,
				private: repo.private,
			});
		}

		// Convert to installations-like format for the frontend
		const installations = Array.from(reposByOwner.values()).map((group) => ({
			id: 0, // No installation ID for personal token repos
			account: {
				login: group.login,
				avatarUrl: group.avatarUrl,
				type: group.type,
			},
			repos: group.repos,
		}));

		// Put the user's own repos first
		installations.sort((a, b) => {
			if (a.account.login === user.login) return -1;
			if (b.account.login === user.login) return 1;
			return a.account.login.localeCompare(b.account.login);
		});

		return NextResponse.json({ installations });
	} catch (error) {
		console.error("[GitHub Repos API] GET error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch GitHub repositories" },
			{ status: 500 },
		);
	}
}
