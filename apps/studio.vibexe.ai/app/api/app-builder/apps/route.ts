/**
 * App Builder Apps API
 *
 * POST: Create a new builder app and return its redirect path.
 * Used by the sidebar "Create App" button.
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createApp, saveFile, updateAppName } from "@/app/(main)/app-builder/lib/queries";
import { db, teamMemberships } from "@/db";
import { getUser } from "@/lib/auth/get-user";

export async function POST(request: Request) {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const membership = await db.query.teamMemberships.findFirst({
		where: eq(teamMemberships.userDbId, user.dbId),
	});

	if (!membership) {
		return NextResponse.json({ error: "No team found" }, { status: 400 });
	}

	// Read optional body params (dashboard sends these)
	let visibility: string | undefined;
	let githubImport: { owner: string; repo: string; branch: string } | undefined;
	try {
		const body = await request.json();
		if (body.visibility === "public" || body.visibility === "private") {
			visibility = body.visibility;
		}
		if (body.githubImport?.owner && body.githubImport?.repo) {
			githubImport = body.githubImport;
		}
	} catch {
		// No body or invalid JSON — that's fine, all params are optional
	}

	const app = await createApp(
		membership.teamDbId,
		user.dbId,
		"Untitled App",
		undefined,
		visibility,
	);

	// Handle GitHub import: fetch repo files and save them
	if (githubImport) {
		try {
			const { owner, repo, branch } = githubImport;
			const files = await fetchGitHubRepoFiles(owner, repo, branch);
			if (files.length > 0) {
				for (const file of files) {
					await saveFile(app.id, file.path, file.content);
				}
				await updateAppName(
					app.id,
					repo.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
				);
			}
		} catch (e) {
			console.error("[Apps API] GitHub import error:", e);
			// App was still created, just without imported files
		}
	}

	const redirectPath = `/app-builder/${app.id}`;
	return NextResponse.json({ redirectPath }, { status: 201 });
}

/**
 * Fetch files from a public GitHub repo using the Trees API.
 * Returns an array of { path, content } for text files (< 100KB).
 */
async function fetchGitHubRepoFiles(
	owner: string,
	repo: string,
	branch: string,
): Promise<{ path: string; content: string }[]> {
	const UA = "Vibexe-App-Builder/1.0";
	const MAX_FILE_SIZE = 100_000; // 100KB
	const MAX_FILES = 80; // safety cap

	// 1. Get the tree recursively
	const treeRes = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
		{ headers: { "User-Agent": UA, Accept: "application/vnd.github.v3+json" } },
	);
	if (!treeRes.ok) {
		throw new Error(`GitHub tree API: ${treeRes.status} ${treeRes.statusText}`);
	}
	const treeData = await treeRes.json();

	// 2. Filter to relevant source files
	const TEXT_EXTENSIONS = /\.(tsx?|jsx?|json|css|scss|html|md|txt|yml|yaml|env|toml|xml|svg|graphql|gql|prisma)$/i;
	const SKIP_DIRS = /^(node_modules|\.git|dist|build|\.next|coverage|__pycache__|vendor)\//;

	const blobs = (treeData.tree ?? [])
		.filter(
			(item: { type: string; path: string; size?: number }) =>
				item.type === "blob" &&
				TEXT_EXTENSIONS.test(item.path) &&
				!SKIP_DIRS.test(item.path) &&
				(item.size ?? 0) < MAX_FILE_SIZE,
		)
		.slice(0, MAX_FILES);

	// 3. Fetch file contents in parallel (batches of 10)
	const files: { path: string; content: string }[] = [];
	for (let i = 0; i < blobs.length; i += 10) {
		const batch = blobs.slice(i, i + 10);
		const results = await Promise.allSettled(
			batch.map(async (blob: { path: string; sha: string }) => {
				const res = await fetch(
					`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${blob.path}`,
					{ headers: { "User-Agent": UA } },
				);
				if (!res.ok) return null;
				const content = await res.text();
				return { path: blob.path, content };
			}),
		);
		for (const r of results) {
			if (r.status === "fulfilled" && r.value) {
				files.push(r.value);
			}
		}
	}

	return files;
}
