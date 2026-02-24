/**
 * GitHub Sync Config API
 *
 * GET  /api/apps/{appId}/github/config — Get current GitHub sync configuration
 * PUT  /api/apps/{appId}/github/config — Connect/update GitHub repo
 * DELETE /api/apps/{appId}/github/config — Disconnect GitHub repo
 */

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppGitHubSync,
} from "@/db/schema";
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

		return NextResponse.json({
			connected: true,
			repoOwner: config.repoOwner,
			repoName: config.repoName,
			branch: config.branch,
			installationId: config.installationId,
			lastPushSha: config.lastPushSha,
			lastPullSha: config.lastPullSha,
			autoSync: config.autoSync,
			updatedAt: config.updatedAt,
		});
	} catch (error) {
		console.error("[GitHub Config API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function PUT(request: Request, { params }: RouteParams) {
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

		const body = await request.json();
		const { repoOwner, repoName, branch, installationId } = body;

		if (!repoOwner || !repoName) {
			return NextResponse.json(
				{ error: "repoOwner and repoName are required" },
				{ status: 400 },
			);
		}

		await db
			.insert(builderAppGitHubSync)
			.values({
				id: `bgs_${nanoid()}`,
				appDbId: app.dbId,
				repoOwner,
				repoName,
				branch: branch || "main",
				installationId: installationId || null,
			})
			.onConflictDoUpdate({
				target: builderAppGitHubSync.appDbId,
				set: {
					repoOwner,
					repoName,
					branch: branch || "main",
					installationId: installationId || null,
				},
			});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[GitHub Config API] PUT error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function DELETE(_request: Request, { params }: RouteParams) {
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

		await db
			.delete(builderAppGitHubSync)
			.where(eq(builderAppGitHubSync.appDbId, app.dbId));

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[GitHub Config API] DELETE error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
