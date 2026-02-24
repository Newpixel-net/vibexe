// Vercel flags discovery endpoint - disabled for self-hosting
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json({});
}
