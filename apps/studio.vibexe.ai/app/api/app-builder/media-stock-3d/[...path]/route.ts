import { type NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const MEDIA_BASE = "/opt/vibexe/media-stock/games-3d";

const CONTENT_TYPES: Record<string, string> = {
	// 3D model formats
	".gltf": "model/gltf+json",
	".glb": "model/gltf-binary",
	".fbx": "application/octet-stream",
	".obj": "text/plain",
	".mtl": "text/plain",
	".bin": "application/octet-stream",
	// Textures that ship with 3D models
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".tga": "application/octet-stream",
	// Metadata
	".json": "application/json",
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

		return new Response(buffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Content-Length": String(buffer.length),
				"Cache-Control": "public, max-age=31536000, immutable",
				...CORS_HEADERS,
			},
		});
	} catch {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
	}
}
