/**
 * GitHub Diff API
 *
 * GET /api/apps/{appId}/github/diff — Compare local files with GitHub repo
 * Returns lists of added, modified, and deleted files.
 */

import { createHash } from "node:crypto";
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
import { getFilesForApp } from "@/app/(main)/app-builder/lib/queries";

/** Compute the same blob SHA that Git uses: SHA1("blob <size>\0<content>") */
function gitBlobSha(content: string): string {
	const buf = Buffer.from(content, "utf-8");
	const header = `blob ${buf.length}\0`;
	return createHash("sha1")
		.update(header)
		.update(buf)
		.digest("hex");
}

/** Files to exclude from diff comparison */
const EXCLUDED_PATHS = new Set([
	"CLAUDE.md",
	"vibexe-sdk.ts",
	"vibexe-sdk.js",
]);

function isExcluded(path: string): boolean {
	if (EXCLUDED_PATHS.has(path)) return true;
	if (path.startsWith(".vibexe/")) return true;
	if (path.startsWith(".github/")) return true;
	return false;
}

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
			return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
		}

		const credential = await getOauthCredential("github");
		if (!credential) {
			return NextResponse.json({ error: "GitHub token expired" }, { status: 401 });
		}

		const octokit = new Octokit({
			auth: credential.accessToken,
			headers: { "X-GitHub-Api-Version": "2022-11-28" },
		});

		const { repoOwner: owner, repoName: repo, branch } = config;

		// Get latest commit tree
		const refRes = await octokit.request(
			"GET /repos/{owner}/{repo}/git/ref/heads/{branch}",
			{ owner, repo, branch },
		);
		const latestSha = refRes.data.object.sha;

		const treeRes = await octokit.request(
			"GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
			{ owner, repo, tree_sha: latestSha, recursive: "1" },
		);

		// Filter to blobs only, excluding platform files
		const remoteFiles = treeRes.data.tree.filter(
			(item) => item.type === "blob" && item.path && !isExcluded(item.path),
		);
		const remotePathSet = new Set(remoteFiles.map((f) => f.path!));
		const remoteShaMap = new Map(
			remoteFiles.map((f) => [f.path!, f.sha!]),
		);

		// Get local files
		const localFiles = await getFilesForApp(appId);
		const localPathSet = new Set(localFiles.map((f) => f.path));

		// Compute diff
		const added: string[] = [];
		const modified: string[] = [];
		const deleted: string[] = [];

		// Files in GitHub but not locally → added (will be created on pull)
		for (const remotePath of remotePathSet) {
			if (!localPathSet.has(remotePath)) {
				added.push(remotePath);
			}
		}

		// Files in both — compare per-file blob SHAs for accurate diff
		for (const localFile of localFiles) {
			if (isExcluded(localFile.path)) continue;
			if (remotePathSet.has(localFile.path)) {
				// File exists in both — compare blob SHA to detect actual content changes
				const remoteSha = remoteShaMap.get(localFile.path);
				if (remoteSha && localFile.content != null) {
					const localSha = gitBlobSha(localFile.content);
					if (localSha !== remoteSha) {
						modified.push(localFile.path);
					}
				}
			} else {
				// File exists locally but not in GitHub → deleted (will be removed on pull with deleteOrphans)
				deleted.push(localFile.path);
			}
		}

		return NextResponse.json({
			latestSha,
			added,
			modified,
			deleted,
			totalChanges: added.length + modified.length + deleted.length,
		});
	} catch (error) {
		console.error("[GitHub Diff API] GET error:", error);
		return NextResponse.json(
			{ error: "Failed to compute diff" },
			{ status: 500 },
		);
	}
}
