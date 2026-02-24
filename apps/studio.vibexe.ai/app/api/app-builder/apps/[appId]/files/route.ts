// vibexe-integration/api/app-builder/apps/[appId]/files/route.ts
// Files CRUD API endpoint for App Builder
//
// This endpoint handles file operations for the App Builder:
// - GET: Retrieve all files for an app
// - PUT: Update a file's content (used by CodeEditor save)
//
// Deploy to: /opt/vibexe/apps/studio.vibexe.ai/app/api/app-builder/apps/[appId]/files/route.ts

import { NextResponse } from "next/server";
import {
	deleteFile,
	getAppById,
	getFilesForApp,
	saveFile,
} from "@/app/(main)/app-builder/lib/queries";
import { getUser } from "@/lib/auth/get-user";

/**
 * Route context with dynamic params
 * Next.js 15+ uses async params
 */
interface RouteContext {
	params: Promise<{ appId: string }>;
}

/**
 * GET /api/app-builder/apps/[appId]/files
 *
 * Returns all files for a builder app.
 * Used by the frontend to populate FileExplorer and CodeEditor.
 *
 * Response format:
 * {
 *   files: [
 *     { id: "bldf_xxx", path: "src/App.tsx", content: "...", language: "typescript" },
 *     ...
 *   ]
 * }
 */
export async function GET(_request: Request, context: RouteContext) {
	try {
		// Auth check
		const user = await getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { appId } = await context.params;

		// Verify app exists and user has access
		const app = await getAppById(appId, user.id);
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		// Get all files for the app
		const files = await getFilesForApp(appId);

		// Format response for frontend
		const formattedFiles = files.map((f) => ({
			id: f.id,
			path: f.path,
			content: f.content || "",
			language: f.language || "plaintext",
		}));

		return NextResponse.json({ files: formattedFiles });
	} catch (error) {
		console.error("[Files API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * PUT /api/app-builder/apps/[appId]/files
 *
 * Update a single file's content.
 * Used by CodeEditor when user saves changes.
 *
 * Request body:
 * {
 *   path: "src/App.tsx",
 *   content: "...",
 *   language?: "typescript"
 * }
 *
 * Response:
 * {
 *   id: "bldf_xxx",
 *   path: "src/App.tsx",
 *   content: "...",
 *   language: "typescript"
 * }
 */
export async function PUT(request: Request, context: RouteContext) {
	try {
		// Auth check
		const user = await getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { appId } = await context.params;

		// Verify app exists and user has access
		const app = await getAppById(appId, user.id);
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		// Parse request body
		const body = await request.json();
		const { path, content, language } = body as {
			path: string;
			content: string;
			language?: string;
		};

		// Validate required fields
		if (!path) {
			return NextResponse.json({ error: "Missing path" }, { status: 400 });
		}

		if (content === undefined || content === null) {
			return NextResponse.json({ error: "Missing content" }, { status: 400 });
		}

		// Save the file (creates or updates)
		const file = await saveFile(appId, path, content, language);

		return NextResponse.json({
			id: file.id,
			path: file.path,
			content: file.content || "",
			language: file.language || "plaintext",
		});
	} catch (error) {
		console.error("[Files API] PUT error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/app-builder/apps/[appId]/files
 *
 * Delete a file from the app.
 *
 * Request body:
 * {
 *   path: "src/oldFile.tsx"
 * }
 *
 * Response:
 * { success: true, path: "src/oldFile.tsx" }
 */
export async function DELETE(request: Request, context: RouteContext) {
	try {
		// Auth check
		const user = await getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { appId } = await context.params;

		// Verify app exists and user has access
		const app = await getAppById(appId, user.id);
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		// Parse request body
		const body = await request.json();
		const { path } = body as { path: string };

		if (!path) {
			return NextResponse.json({ error: "Missing path" }, { status: 400 });
		}

		// Delete the file
		await deleteFile(appId, path);

		return NextResponse.json({ success: true, path });
	} catch (error) {
		console.error("[Files API] DELETE error:", error);

		// Check if it's a "not found" error
		if (error instanceof Error && error.message.includes("not found")) {
			return NextResponse.json({ error: error.message }, { status: 404 });
		}

		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
