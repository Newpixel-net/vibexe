/**
 * POST /api/app-builder/compile
 *
 * Server-side game compilation endpoint.
 * Takes app files + settings, returns a compiled IIFE bundle via esbuild.
 * Replaces sandpack's in-browser bundler for game mode.
 */

import { compileGameBundle } from "@/lib/game-compiler/compiler";

export async function POST(request: Request) {
	try {
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
