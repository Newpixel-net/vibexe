import { NextResponse } from "next/server";
import {
	PIECE_CATALOG,
	getAllCategories,
	TOTAL_PIECES,
} from "@giselles-ai/activepieces-adapter";

export async function GET() {
	return NextResponse.json({
		pieces: PIECE_CATALOG,
		categories: getAllCategories(),
		total: TOTAL_PIECES,
	});
}
