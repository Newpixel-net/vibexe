/**
 * Template Auto-Fill API
 *
 * POST /api/apps/{appId}/template/auto-fill
 *
 * Reads the app's files and schema, then uses xAI Grok 4.1 Fast
 * (cheapest available model) to generate template metadata.
 *
 * Note: During development we use xAI Grok 4.1 Fast for cost efficiency.
 * This may change to a different model in production.
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { db } from "@/db";
import { type BuilderAppId, builderAppDatabases, builderApps, builderFiles } from "@/db/schema";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import {
	TEMPLATE_CATEGORY_TREE,
	ALL_CATEGORY_PATHS,
} from "@/app/(main)/app-builder/lib/template-constants";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		try {
			await verifyAppAccess(appId);
		} catch {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true, name: true, description: true },
		});
		if (!app)
			return NextResponse.json({ error: "App not found" }, { status: 404 });

		// Read app files (limit content to avoid token overload)
		const files = await db.query.builderFiles.findMany({
			where: eq(builderFiles.appDbId, app.dbId),
			columns: { path: true, content: true },
		});

		// Build a summary of the app's code (truncate large files)
		const fileSummary = files
			.map((f) => {
				const content = f.content ?? "";
				const truncated =
					content.length > 2000
						? `${content.slice(0, 2000)}\n... (truncated)`
						: content;
				return `--- ${f.path} ---\n${truncated}`;
			})
			.join("\n\n");

		// Read schema if available
		const appDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, app.dbId),
		});
		const schemaJson = appDb?.schemaJson;
		const schemaStr = schemaJson
			? `\nDatabase Schema:\n${JSON.stringify(schemaJson, null, 2).slice(0, 3000)}`
			: "";

		// Build a compact category reference for the AI
		const categoryReference = Object.entries(TEMPLATE_CATEGORY_TREE)
			.map(
				([main, group]) =>
					`${main}: ${group.subcategories.join(", ")}`,
			)
			.join("\n");

		const prompt = `You are analyzing a web application to generate template metadata for a template gallery.

App Name: ${app.name ?? "Untitled"}
App Description: ${app.description ?? "None provided"}
${schemaStr}

Source Files:
${fileSummary}

Available categories (format: "Main Category > Subcategory"):
${categoryReference}

Based on this app, generate the following template metadata as JSON:
1. "name": A clear, descriptive template name (e.g., "Habit Tracker with Analytics", "Project Management Dashboard")
2. "description": A compelling 2-3 sentence description of what the template includes and what users can do with it. Mention key features.
3. "category": Pick the BEST matching category using the format "Main Category > Subcategory" from the list above. MUST use exact names from the list.
4. "tags": An array of 4-6 relevant lowercase tags (e.g., ["habits", "tracker", "health", "productivity", "analytics"])

Respond with ONLY valid JSON, no markdown fencing, no explanation.`;

		// Use xAI Grok 4.1 Fast — cheapest model for simple metadata extraction
		const xai = createOpenAI({
			baseURL: "https://api.x.ai/v1",
			apiKey: process.env.XAI_API_KEY ?? "",
		});

		const result = await generateText({
			model: xai.chat("grok-4-1-fast-reasoning"),
			prompt,
			maxTokens: 500,
			temperature: 0.3,
		});

		// Parse the JSON response
		let metadata: {
			name: string;
			description: string;
			category: string;
			tags: string[];
		};

		try {
			// Strip any markdown fencing if model adds it
			let text = result.text.trim();
			if (text.startsWith("```")) {
				text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
			}
			metadata = JSON.parse(text);
		} catch {
			return NextResponse.json(
				{ error: "Failed to parse AI response", raw: result.text },
				{ status: 502 },
			);
		}

		// Validate category is in our hierarchical list
		if (!ALL_CATEGORY_PATHS.includes(metadata.category)) {
			// Try to find a close match by checking if the subcategory part exists
			const subPart = metadata.category.includes(" > ")
				? metadata.category.split(" > ")[1]
				: metadata.category;
			const match = ALL_CATEGORY_PATHS.find((p) =>
				p.toLowerCase().includes(subPart.toLowerCase()),
			);
			metadata.category = match ?? "Other > General";
		}

		return NextResponse.json({
			success: true,
			name: metadata.name,
			description: metadata.description,
			category: metadata.category,
			tags: metadata.tags ?? [],
		});
	} catch (error) {
		console.error("[Template Auto-Fill] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
