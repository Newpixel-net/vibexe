import { NextResponse } from "next/server";
import {
	INSTALLED_CATALOG,
	getAllCategories,
	TOTAL_INSTALLED,
} from "@vibexe-ai/activepieces-adapter";

export async function GET() {
	return NextResponse.json({
		pieces: INSTALLED_CATALOG,
		categories: getAllCategories(),
		total: TOTAL_INSTALLED,
	});
}
