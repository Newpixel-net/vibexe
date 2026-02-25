/**
 * Template Gallery List API
 *
 * GET /api/app-templates?category=Dashboard&search=project&limit=20&offset=0
 */

import { NextResponse } from "next/server";
import { listTemplates } from "@/app/(main)/app-builder/lib/template-queries";
import {
	MAIN_CATEGORIES,
	ALL_CATEGORY_PATHS,
	TEMPLATE_CATEGORY_TREE,
} from "@/app/(main)/app-builder/lib/template-constants";

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const category = searchParams.get("category") || undefined;
		const search = searchParams.get("search") || undefined;
		const limit = Math.min(
			Number.parseInt(searchParams.get("limit") ?? "20", 10),
			50,
		);
		const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
		const teamDbId = searchParams.get("teamDbId")
			? Number.parseInt(searchParams.get("teamDbId")!, 10)
			: undefined;
		const includeAll = searchParams.get("includeAll") === "true";

		const { templates, total } = await listTemplates({
			category,
			search,
			teamDbId,
			limit,
			offset,
			includeAll,
		});

		return NextResponse.json({
			templates,
			total,
			categories: MAIN_CATEGORIES,
			allCategoryPaths: ALL_CATEGORY_PATHS,
			categoryTree: TEMPLATE_CATEGORY_TREE,
		});
	} catch (error) {
		console.error("[Template Gallery] List error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
