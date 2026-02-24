/**
 * Pull from GitHub — Sync remote GitHub files back into Vibexe's builder_files table.
 *
 * Fetches the full tree from the branch, compares with local files,
 * and creates/updates/deletes as needed.
 */

import { Octokit } from "@octokit/core";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppGitHubSync,
} from "@/db/schema";
import {
	getFilesForApp,
	saveFile,
	deleteFile,
} from "@/app/(main)/app-builder/lib/queries";

/** Files/dirs to skip when pulling from GitHub */
const EXCLUDED_PATHS = new Set([
	"CLAUDE.md",
	".vibexe/config.json",
	".vibexe/sdk-reference.md",
	".gitignore",
	".github",
]);

/** Check if a path should be excluded from pull */
function isExcluded(path: string): boolean {
	if (EXCLUDED_PATHS.has(path)) return true;
	if (path.startsWith(".vibexe/")) return true;
	if (path.startsWith(".github/")) return true;
	// Skip the SDK file — it's auto-injected by the platform
	if (path === "vibexe-sdk.ts" || path === "vibexe-sdk.js") return true;
	return false;
}

/** Infer language from file extension */
function inferLanguage(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "tsx":
		case "ts":
			return "typescript";
		case "jsx":
		case "js":
			return "javascript";
		case "css":
			return "css";
		case "json":
			return "json";
		case "html":
			return "html";
		case "md":
			return "markdown";
		default:
			return "plaintext";
	}
}

interface PullOptions {
	appId: string;
	accessToken: string;
	deleteOrphans?: boolean; // delete local files not in GitHub (default: false)
}

interface PullResult {
	sha: string;
	filesCreated: number;
	filesUpdated: number;
	filesDeleted: number;
	filesSkipped: number;
}

export async function pullFromGitHub(options: PullOptions): Promise<PullResult> {
	const { appId, accessToken, deleteOrphans = false } = options;

	// 1. Get app and sync config
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});
	if (!app) throw new Error(`App not found: ${appId}`);

	const config = await db.query.builderAppGitHubSync.findFirst({
		where: eq(builderAppGitHubSync.appDbId, app.dbId),
	});
	if (!config) throw new Error("GitHub sync not configured for this app");

	const octokit = new Octokit({
		auth: accessToken,
		headers: { "X-GitHub-Api-Version": "2022-11-28" },
	});

	const { repoOwner: owner, repoName: repo, branch } = config;

	// 2. Get latest commit SHA
	const refRes = await octokit.request(
		"GET /repos/{owner}/{repo}/git/ref/heads/{branch}",
		{ owner, repo, branch },
	);
	const latestSha = refRes.data.object.sha;

	// Check if already up to date
	if (config.lastPullSha === latestSha) {
		return {
			sha: latestSha,
			filesCreated: 0,
			filesUpdated: 0,
			filesDeleted: 0,
			filesSkipped: 0,
		};
	}

	// 3. Get full tree recursively
	const treeRes = await octokit.request(
		"GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
		{
			owner,
			repo,
			tree_sha: latestSha,
			recursive: "1",
		},
	);

	// 4. Filter to only blob (file) entries, excluding platform files
	const remoteFiles = treeRes.data.tree.filter(
		(item) => item.type === "blob" && item.path && !isExcluded(item.path),
	);

	// 5. Get current local files for comparison
	const localFiles = await getFilesForApp(appId);
	const localFileMap = new Map(localFiles.map((f) => [f.path, f]));
	const remotePathSet = new Set(remoteFiles.map((f) => f.path!));

	let filesCreated = 0;
	let filesUpdated = 0;
	let filesDeleted = 0;
	let filesSkipped = 0;

	// 6. Fetch and save each remote file
	for (const remoteFile of remoteFiles) {
		const path = remoteFile.path!;
		try {
			// Fetch file content
			const contentRes = await octokit.request(
				"GET /repos/{owner}/{repo}/contents/{path}",
				{
					owner,
					repo,
					path,
					ref: branch,
				},
			);

			const data = contentRes.data as { content?: string; encoding?: string };
			if (!data.content) {
				filesSkipped++;
				continue;
			}

			const content = Buffer.from(data.content, "base64").toString("utf-8");
			const language = inferLanguage(path);
			const localFile = localFileMap.get(path);

			if (localFile) {
				// Only update if content actually changed
				if (localFile.content !== content) {
					await saveFile(appId, path, content, language);
					filesUpdated++;
				} else {
					filesSkipped++;
				}
			} else {
				await saveFile(appId, path, content, language);
				filesCreated++;
			}
		} catch (err) {
			console.warn(`[GitHub Pull] Failed to fetch ${path}:`, err);
			filesSkipped++;
		}
	}

	// 7. Optionally delete local files that don't exist in GitHub
	if (deleteOrphans) {
		for (const localFile of localFiles) {
			// Don't delete SDK or platform-managed files
			if (isExcluded(localFile.path)) continue;
			if (!remotePathSet.has(localFile.path)) {
				try {
					await deleteFile(appId, localFile.path);
					filesDeleted++;
				} catch {
					// File may already be deleted
				}
			}
		}
	}

	// 8. Update pull SHA
	await db
		.update(builderAppGitHubSync)
		.set({ lastPullSha: latestSha })
		.where(eq(builderAppGitHubSync.appDbId, app.dbId));

	return {
		sha: latestSha,
		filesCreated,
		filesUpdated,
		filesDeleted,
		filesSkipped,
	};
}
