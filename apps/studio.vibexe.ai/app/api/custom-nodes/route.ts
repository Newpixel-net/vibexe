import type { NextRequest } from "next/server";
import { db, customNodes, users } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";
import { getCurrentUser } from "@/lib/get-current-user";

export const dynamic = "force-dynamic";

/**
 * GET /api/custom-nodes
 *
 * List all custom nodes for the current team.
 */
export async function GET() {
	try {
		const currentTeam = await fetchCurrentTeam();

		const nodes = await db
			.select({
				dbId: customNodes.dbId,
				name: customNodes.name,
				displayName: customNodes.displayName,
				description: customNodes.description,
				icon: customNodes.icon,
				category: customNodes.category,
				version: customNodes.version,
				definition: customNodes.definition,
				enabled: customNodes.enabled,
				createdAt: customNodes.createdAt,
				updatedAt: customNodes.updatedAt,
				authorName: users.displayName,
			})
			.from(customNodes)
			.leftJoin(users, eq(customNodes.createdByDbId, users.dbId))
			.where(eq(customNodes.teamDbId, currentTeam.dbId))
			.orderBy(desc(customNodes.createdAt));

		return Response.json({ nodes });
	} catch (err) {
		console.error("[CustomNodes] Error listing:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/custom-nodes
 * Body: CustomNodeDefinition JSON
 *
 * Register a new custom node for the current team.
 */
export async function POST(request: NextRequest) {
	try {
		const currentTeam = await fetchCurrentTeam();
		const user = await getCurrentUser();
		const body = await request.json();

		const { name, displayName, description, icon, category, version } = body;

		if (!name || !displayName) {
			return Response.json(
				{ error: "name and displayName are required" },
				{ status: 400 },
			);
		}

		// Validate name format
		if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
			return Response.json(
				{
					error:
						"name must be lowercase alphanumeric with dashes, starting with a letter or number",
				},
				{ status: 400 },
			);
		}

		if (!body.executeCode) {
			return Response.json(
				{ error: "executeCode is required" },
				{ status: 400 },
			);
		}

		// Check for duplicate name within team
		const existing = await db
			.select({ dbId: customNodes.dbId })
			.from(customNodes)
			.where(
				and(
					eq(customNodes.teamDbId, currentTeam.dbId),
					eq(customNodes.name, name),
				),
			)
			.limit(1);

		if (existing.length > 0) {
			return Response.json(
				{ error: `A custom node named "${name}" already exists` },
				{ status: 409 },
			);
		}

		const [created] = await db
			.insert(customNodes)
			.values({
				teamDbId: currentTeam.dbId,
				name,
				displayName,
				description: description || null,
				icon: icon || "Box",
				category: category || "Custom",
				version: version || "1.0.0",
				definition: body,
				enabled: true,
				createdByDbId: user?.dbId ?? null,
			})
			.returning({
				dbId: customNodes.dbId,
				name: customNodes.name,
				displayName: customNodes.displayName,
				createdAt: customNodes.createdAt,
			});

		return Response.json({ node: created }, { status: 201 });
	} catch (err) {
		console.error("[CustomNodes] Error creating:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
