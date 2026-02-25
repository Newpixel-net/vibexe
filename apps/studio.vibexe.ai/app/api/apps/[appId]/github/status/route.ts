/**
 * GitHub Sync Status API
 *
 * GET /api/apps/{appId}/github/status — Check sync status (ahead/behind)
 */

import { Octokit } from "@octokit/core";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppGitHubSync,
} from "@/db/schema";
import { getOauthCredential } from "@/services/accounts/oauth-credentials";
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

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const config = await db.query.builderAppGitHubSync.findFirst({
			where: eq(builderAppGitHubSync.appDbId, app.dbId),
		});

		if (!config) {
			return NextResponse.json({ connected: false });
		}

		// Get user's GitHub token to check latest commit
		const credential = await getOauthCredential("github");
		if (!credential) {
			return NextResponse.json({
				connected: true,
				repoFullName: `${config.repoOwner}/${config.repoName}`,
				branch: config.branch,
				error: "GitHub token expired",
			});
		}

		const octokit = new Octokit({
			auth: credential.accessToken,
			headers: { "X-GitHub-Api-Version": "2022-11-28" },
		});

		try {
			// Get latest commit on the branch
			const refRes = await octokit.request(
				"GET /repos/{owner}/{repo}/git/ref/heads/{branch}",
				{
					owner: config.repoOwner,
					repo: config.repoName,
					branch: config.branch,
				},
			);

			const latestSha = refRes.data.object.sha;
			const baseSha = config.lastPullSha ?? config.lastPushSha;
			const hasRemoteChanges = baseSha
				? latestSha !== baseSha
				: false;

			// Fetch commit details when remote has changes
			let recentCommits: {
				sha: string;
				message: string;
				authorName: string;
				authorAvatar: string;
				date: string;
			}[] = [];
			let commitCount = 0;
			let changedFiles: {
				added: number;
				modified: number;
				removed: number;
				total: number;
			} | undefined;

			if (hasRemoteChanges) {
				try {
					if (baseSha) {
						// Use Compare API for detailed diff
						const compareRes = await octokit.request(
							"GET /repos/{owner}/{repo}/compare/{basehead}",
							{
								owner: config.repoOwner,
								repo: config.repoName,
								basehead: `${baseSha}...${latestSha}`,
							},
						);
						const cmp = compareRes.data;
						commitCount = cmp.ahead_by;
						recentCommits = (cmp.commits ?? [])
							.slice(-5)
							.reverse()
							.map((c: any) => ({
								sha: c.sha.slice(0, 7),
								message: c.commit.message.split("\n")[0],
								authorName:
									c.author?.login ?? c.commit.author?.name ?? "unknown",
								authorAvatar: c.author?.avatar_url ?? "",
								date: c.commit.author?.date ?? "",
							}));
						const files = cmp.files ?? [];
						changedFiles = {
							added: files.filter((f: any) => f.status === "added").length,
							modified: files.filter(
								(f: any) =>
									f.status === "modified" || f.status === "renamed",
							).length,
							removed: files.filter((f: any) => f.status === "removed")
								.length,
							total: files.length,
						};
					} else {
						// No base SHA — fetch recent commits as fallback
						const commitsRes = await octokit.request(
							"GET /repos/{owner}/{repo}/commits",
							{
								owner: config.repoOwner,
								repo: config.repoName,
								sha: config.branch,
								per_page: 5,
							},
						);
						commitCount = commitsRes.data.length;
						recentCommits = commitsRes.data.map((c: any) => ({
							sha: c.sha.slice(0, 7),
							message: c.commit.message.split("\n")[0],
							authorName:
								c.author?.login ?? c.commit.author?.name ?? "unknown",
							authorAvatar: c.author?.avatar_url ?? "",
							date: c.commit.author?.date ?? "",
						}));
					}
				} catch {
					// Graceful degradation — still return hasRemoteChanges: true
				}
			}

			return NextResponse.json({
				connected: true,
				repoFullName: `${config.repoOwner}/${config.repoName}`,
				branch: config.branch,
				lastPushSha: config.lastPushSha,
				lastPullSha: config.lastPullSha,
				latestSha,
				hasRemoteChanges,
				lastSynced: config.updatedAt,
				...(hasRemoteChanges && {
					recentCommits,
					commitCount,
					changedFiles,
				}),
			});
		} catch {
			// Repo or branch might not exist yet (first push)
			return NextResponse.json({
				connected: true,
				repoFullName: `${config.repoOwner}/${config.repoName}`,
				branch: config.branch,
				lastPushSha: config.lastPushSha,
				lastPullSha: config.lastPullSha,
				latestSha: null,
				hasRemoteChanges: false,
				lastSynced: config.updatedAt,
			});
		}
	} catch (error) {
		console.error("[GitHub Status API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
