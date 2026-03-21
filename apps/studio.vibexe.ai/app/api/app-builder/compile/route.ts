/**
 * POST /api/app-builder/compile
 *
 * Server-side game compilation endpoint.
 * Takes app files + settings, returns a compiled IIFE bundle via esbuild.
 * Replaces sandpack's in-browser bundler for game mode.
 */

import { compileGameBundle } from "@/lib/game-compiler/compiler";
import { getUser } from "@/lib/auth/get-user";

export async function POST(request: Request) {
	try {
		const user = await getUser();
		if (!user) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();

		const {
			files,
			settings,
			enabledModuleIds,
			appId,
			apiOrigin: clientOrigin,
		} = body as {
			files: Array<{ path: string; content: string }>;
			settings?: Record<string, unknown>;
			enabledModuleIds?: string[];
			appId?: string;
			apiOrigin?: string;
		};

		if (!files || !Array.isArray(files) || files.length === 0) {
			return Response.json(
				{ error: "Missing or empty files array" },
				{ status: 400 },
			);
		}

		// Input validation: prevent DoS via oversized payloads
		const MAX_FILES = 100;
		const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB per file (game-settings.json can be large with terrain data)
		const MAX_TOTAL_SIZE = 5 * 1024 * 1024; // 5 MB total
		if (files.length > MAX_FILES) {
			return Response.json(
				{ error: `Too many files (max ${MAX_FILES})` },
				{ status: 400 },
			);
		}
		let totalSize = 0;
		for (const f of files) {
			if (typeof f.content !== "string") continue;
			if (f.content.length > MAX_FILE_SIZE) {
				return Response.json(
					{ error: `File "${f.path}" exceeds max size (${MAX_FILE_SIZE / 1024}KB)` },
					{ status: 400 },
				);
			}
			totalSize += f.content.length;
		}
		if (totalSize > MAX_TOTAL_SIZE) {
			return Response.json(
				{ error: `Total content exceeds max size (${MAX_TOTAL_SIZE / 1024 / 1024}MB)` },
				{ status: 400 },
			);
		}

		// Prefer client-provided origin (browser-facing URL) over server-side request.url
		// (which returns localhost:3000 on the internal Next.js server)
		const apiOrigin = clientOrigin || new URL(request.url).origin;

		const result = await compileGameBundle({
			files,
			settings,
			enabledModuleIds,
			apiOrigin,
			appId,
		});

		if (result.errors?.length) {
			return Response.json(
				{
					bundle: result.bundle,
					bootstrap: result.bootstrap,
					hash: result.hash,
					errors: result.errors,
					compiledMs: result.compiledMs,
				},
				{ status: result.bundle ? 200 : 422 },
			);
		}

		return Response.json({
			bundle: result.bundle,
			bootstrap: result.bootstrap,
			hash: result.hash,
			compiledMs: result.compiledMs,
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return Response.json(
			{ error: `Compilation error: ${msg}` },
			{ status: 500 },
		);
	}
}
