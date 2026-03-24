import { NextResponse } from "next/server";
import { db } from "@/db";
import { featureBankSnippets } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-guard";
import { eq, ilike, and, or, sql } from "drizzle-orm";

/**
 * GET /api/admin/feature-bank/snippets
 * List snippets with optional filters: engine, type, category, genre, search
 */
export async function GET(request: Request) {
	try {
		await requireAdmin();
		const url = new URL(request.url);
		const engine = url.searchParams.get("engine");
		const type = url.searchParams.get("type");
		const category = url.searchParams.get("category");
		const genre = url.searchParams.get("genre");
		const search = url.searchParams.get("search");

		const conditions = [];
		if (engine) conditions.push(eq(featureBankSnippets.engine, engine));
		if (type) conditions.push(eq(featureBankSnippets.type, type));
		if (category) conditions.push(eq(featureBankSnippets.category, category));
		if (genre) {
			conditions.push(
				sql`${featureBankSnippets.genres} @> ${JSON.stringify([genre])}::jsonb`,
			);
		}
		if (search) {
			conditions.push(
				or(
					ilike(featureBankSnippets.name, `%${search}%`),
					ilike(featureBankSnippets.description, `%${search}%`),
					sql`${featureBankSnippets.keywords}::text ILIKE ${"%" + search + "%"}`,
				)!,
			);
		}

		const snippets = await db
			.select()
			.from(featureBankSnippets)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(featureBankSnippets.category, featureBankSnippets.name);

		return NextResponse.json({ snippets });
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unauthorized")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		console.error("[Feature Bank] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/admin/feature-bank/snippets
 * Create a new snippet
 */
export async function POST(request: Request) {
	try {
		await requireAdmin();
		const body = await request.json();
		const {
			id,
			name,
			description,
			category,
			type,
			engine,
			version,
			keywords,
			parameters,
			dependencies,
			genres,
			code,
			isBuiltIn,
			isVerified,
		} = body;

		if (!id || !name || !description || !category || !type || !engine || !code) {
			return NextResponse.json(
				{ error: "Missing required fields: id, name, description, category, type, engine, code" },
				{ status: 400 },
			);
		}

		const [snippet] = await db
			.insert(featureBankSnippets)
			.values({
				id,
				name,
				description,
				category,
				type,
				engine,
				version: version || "1.0.0",
				keywords: keywords || [],
				parameters: parameters || [],
				dependencies: dependencies || [],
				genres: genres || [],
				code,
				isBuiltIn: isBuiltIn ?? false,
				isVerified: isVerified ?? false,
			})
			.returning();

		return NextResponse.json({ snippet });
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unauthorized")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		console.error("[Feature Bank] POST error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
