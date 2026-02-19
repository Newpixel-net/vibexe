/**
 * Deploy API
 *
 * POST /api/apps/{appId}/deploy — Trigger a new deployment
 *   Body: { subdomain: "my-app" }
 *   Returns: { deployment: {...}, url: "https://my-app.vibexe.online" }
 *
 * GET  /api/apps/{appId}/deploy — Get latest deployment status
 *   Returns: { deployment: {...} | null }
 */

import { eq, and, desc } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
	type BuilderAppId,
	type BuilderDeploymentId,
	builderApps,
	builderDeployments,
} from "@/db/schema";
import { buildApp } from "@/lib/app-deployment/builder";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

/** Validate subdomain: lowercase letters, numbers, hyphens, 3-63 chars */
function isValidSubdomain(s: string): boolean {
	return /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(s);
}

/**
 * GET — Get latest deployment for this app.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const deployment = await db.query.builderDeployments.findFirst({
			where: eq(builderDeployments.appDbId, app.dbId),
			orderBy: [desc(builderDeployments.createdAt)],
		});

		return NextResponse.json({
			deployment: deployment
				? {
						id: deployment.id,
						subdomain: deployment.subdomain,
						customDomain: deployment.customDomain,
						status: deployment.status,
						buildLog: deployment.buildLog,
						deployedAt: deployment.deployedAt,
						createdAt: deployment.createdAt,
						url: deployment.subdomain
							? `https://${deployment.subdomain}.vibexe.online`
							: null,
					}
				: null,
		});
	} catch (error) {
		console.error("[Deploy API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * POST — Trigger a new deployment.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const body = await request.json().catch(() => ({}));
		const subdomain = body.subdomain?.toLowerCase()?.trim();

		if (!subdomain || !isValidSubdomain(subdomain)) {
			return NextResponse.json(
				{
					error:
						"Invalid subdomain. Use 3-63 lowercase letters, numbers, or hyphens.",
				},
				{ status: 400 },
			);
		}

		// Reserved subdomains
		const reserved = [
			"www",
			"api",
			"app",
			"admin",
			"mail",
			"ftp",
			"staging",
			"test",
			"dev",
			"vibexe",
		];
		if (reserved.includes(subdomain)) {
			return NextResponse.json(
				{ error: `"${subdomain}" is a reserved subdomain` },
				{ status: 400 },
			);
		}

		// Find app
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true, name: true },
		});
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		// Check subdomain availability (not taken by another app)
		const existing = await db.query.builderDeployments.findFirst({
			where: eq(builderDeployments.subdomain, subdomain),
		});
		if (existing && existing.appDbId !== app.dbId) {
			return NextResponse.json(
				{ error: `Subdomain "${subdomain}" is already taken` },
				{ status: 409 },
			);
		}

		// Create or update deployment record
		const deploymentId = `bdep_${nanoid(20)}` as BuilderDeploymentId;

		let deploymentDbId: number;

		if (existing && existing.appDbId === app.dbId) {
			// Re-deploy to same subdomain
			await db
				.update(builderDeployments)
				.set({ status: "building", buildLog: null, updatedAt: new Date() })
				.where(eq(builderDeployments.dbId, existing.dbId));
			deploymentDbId = existing.dbId;
		} else {
			// New deployment
			const [row] = await db
				.insert(builderDeployments)
				.values({
					id: deploymentId,
					appDbId: app.dbId,
					subdomain,
					status: "building",
				})
				.returning({ dbId: builderDeployments.dbId });
			deploymentDbId = row.dbId;
		}

		// Run build (async but we wait for it — builds are fast with esbuild)
		const result = await buildApp(appId, subdomain);

		if (result.success) {
			await db
				.update(builderDeployments)
				.set({
					status: "live",
					buildLog: result.log,
					deployedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(builderDeployments.dbId, deploymentDbId));

			const url = `https://${subdomain}.vibexe.online`;
			return NextResponse.json({
				success: true,
				url,
				deployment: {
					id: existing?.id || deploymentId,
					subdomain,
					status: "live",
					url,
					files: result.files,
					buildLog: result.log,
				},
			});
		}

		// Build failed
		await db
			.update(builderDeployments)
			.set({
				status: "failed",
				buildLog: result.log,
				updatedAt: new Date(),
			})
			.where(eq(builderDeployments.dbId, deploymentDbId));

		return NextResponse.json(
			{
				success: false,
				error: "Build failed",
				errors: result.errors,
				buildLog: result.log,
			},
			{ status: 500 },
		);
	} catch (error) {
		console.error("[Deploy API] POST error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
