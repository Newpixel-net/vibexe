/**
 * Push to GitHub — Atomic push of all app files to a GitHub repository.
 *
 * Uses the Git Trees API for a single atomic commit containing all files.
 * Also generates CLAUDE.md and .vibexe/config.json.
 */

import { Octokit } from "@octokit/core";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppDatabases,
	builderAppGitHubSync,
} from "@/db/schema";
import type { AppSchema } from "@/lib/app-database/schema-types";
import { getFilesForApp } from "@/app/(main)/app-builder/lib/queries";
import { generateClaudeMd } from "./generate-claude-md";
import { generateConfig } from "./generate-config";

interface PushOptions {
	appId: string;
	accessToken: string;
	commitMessage?: string;
	apiOrigin: string;
}

interface PushResult {
	sha: string;
	filesCount: number;
	commitUrl: string;
}

export async function pushToGitHub(options: PushOptions): Promise<PushResult> {
	const { appId, accessToken, apiOrigin } = options;
	const commitMessage = options.commitMessage || "Sync from Vibexe App Builder";

	// 1. Get app info and sync config
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true, name: true },
	});
	if (!app) throw new Error(`App not found: ${appId}`);

	const config = await db.query.builderAppGitHubSync.findFirst({
		where: eq(builderAppGitHubSync.appDbId, app.dbId),
	});
	if (!config) throw new Error("GitHub sync not configured for this app");

	// 2. Get app schema (for CLAUDE.md data model section)
	const appDb = await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, app.dbId),
	});
	const schema = (appDb?.schemaJson as AppSchema) ?? null;

	// 3. Get all builder files
	const files = await getFilesForApp(appId);

	// 4. Generate platform files
	const claudeMd = generateClaudeMd({
		appName: app.name,
		appId,
		schema,
		apiOrigin,
	});

	const configJson = generateConfig({
		appId,
		appName: app.name,
		schema,
		apiOrigin,
	});

	// 5. Build tree entries — all builder files + platform files
	const octokit = new Octokit({
		auth: accessToken,
		headers: { "X-GitHub-Api-Version": "2022-11-28" },
	});

	const { repoOwner: owner, repoName: repo, branch } = config;

	// Create blobs for all files
	const treeEntries: Array<{
		path: string;
		mode: "100644";
		type: "blob";
		sha: string;
	}> = [];

	// Helper to create a blob and add tree entry
	async function addFile(path: string, content: string) {
		const blobRes = await octokit.request(
			"POST /repos/{owner}/{repo}/git/blobs",
			{
				owner,
				repo,
				content: Buffer.from(content).toString("base64"),
				encoding: "base64",
			},
		);
		treeEntries.push({
			path,
			mode: "100644",
			type: "blob",
			sha: blobRes.data.sha,
		});
	}

	// Add all builder files
	for (const file of files) {
		if (file.content != null) {
			await addFile(file.path, file.content);
		}
	}

	// Add platform files
	await addFile("CLAUDE.md", claudeMd);
	await addFile(".vibexe/config.json", configJson);

	// 6. Get the current branch ref (or create it if first push)
	let parentSha: string | null = null;
	try {
		const refRes = await octokit.request(
			"GET /repos/{owner}/{repo}/git/ref/heads/{branch}",
			{ owner, repo, branch },
		);
		parentSha = refRes.data.object.sha;
	} catch {
		// Branch doesn't exist yet — will create it
	}

	// 7. Create tree
	const treeRes = await octokit.request(
		"POST /repos/{owner}/{repo}/git/trees",
		{
			owner,
			repo,
			tree: treeEntries,
			...(parentSha ? { base_tree: undefined } : {}),
		},
	);

	// 8. Create commit
	const commitRes = await octokit.request(
		"POST /repos/{owner}/{repo}/git/commits",
		{
			owner,
			repo,
			message: commitMessage,
			tree: treeRes.data.sha,
			parents: parentSha ? [parentSha] : [],
		},
	);

	const newSha = commitRes.data.sha;

	// 9. Update (or create) branch ref
	if (parentSha) {
		await octokit.request(
			"PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}",
			{
				owner,
				repo,
				branch,
				sha: newSha,
			},
		);
	} else {
		await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
			owner,
			repo,
			ref: `refs/heads/${branch}`,
			sha: newSha,
		});
	}

	// 10. Update sync config with push SHA
	await db
		.update(builderAppGitHubSync)
		.set({ lastPushSha: newSha })
		.where(eq(builderAppGitHubSync.appDbId, app.dbId));

	return {
		sha: newSha,
		filesCount: treeEntries.length,
		commitUrl: `https://github.com/${owner}/${repo}/commit/${newSha}`,
	};
}
