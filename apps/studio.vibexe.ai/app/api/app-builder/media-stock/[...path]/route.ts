import { type NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const MEDIA_BASE = "/opt/vibexe/media-stock/games";

const CONTENT_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".wav": "audio/wav",
	".ogg": "audio/ogg",
	".mp3": "audio/mpeg",
	".json": "application/json",
	".txt": "text/plain",
};

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path: segments } = await params;

	// Security: reject path traversal
	if (segments.some((s) => s === ".." || s.includes("\0"))) {
		return NextResponse.json({ error: "Invalid path" }, { status: 400, headers: CORS_HEADERS });
	}

	const filePath = path.join(MEDIA_BASE, ...segments);

	// Security: verify resolved path is inside MEDIA_BASE
	const resolved = path.resolve(filePath);
	if (!resolved.startsWith(MEDIA_BASE)) {
		return NextResponse.json({ error: "Invalid path" }, { status: 400, headers: CORS_HEADERS });
	}

	try {
		const fileStat = await stat(resolved);
		if (!fileStat.isFile()) {
			return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
		}

		const ext = path.extname(resolved).toLowerCase();
		const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
		const buffer = await readFile(resolved);
		const etag = `"${fileStat.size}-${fileStat.mtimeMs.toString(36)}"`;

		return new Response(buffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Content-Length": String(buffer.length),
				"Cache-Control": "public, max-age=3600, must-revalidate",
				ETag: etag,
				...CORS_HEADERS,
			},
		});
	} catch {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
	}
}
