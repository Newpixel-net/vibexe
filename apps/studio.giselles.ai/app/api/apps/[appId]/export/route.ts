/**
 * Export API
 *
 * POST /api/apps/{appId}/export — Generate and download a self-hosted package
 * Returns a ZIP file containing all source files, config, and Docker setup.
 */

import { type NextRequest, NextResponse } from "next/server";
import { generateExport } from "@/lib/app-deployment/exporter";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const result = await generateExport(appId);

		if (!result.success) {
			return NextResponse.json(
				{ error: result.error || "Export failed" },
				{ status: 500 },
			);
		}

		// Convert Map to a plain object for JSON response
		// Client will receive file paths + contents and generate ZIP client-side
		const files: Record<string, string> = {};
		for (const [path, content] of result.files) {
			files[path] = content;
		}

		return NextResponse.json({
			success: true,
			appName: result.appName,
			fileCount: result.files.size,
			files,
		});
	} catch (error) {
		console.error("[Export API] error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
