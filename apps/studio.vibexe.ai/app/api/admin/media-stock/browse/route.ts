import { type NextRequest, NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/admin-guard";

const MEDIA_BASE = "/opt/vibexe/media-stock/games";

interface FileEntry {
	name: string;
	isDir: boolean;
	size: number;
	ext: string;
	path: string;
}

export async function GET(request: NextRequest) {
	try {
		await requireAdmin();
	} catch {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const sp = request.nextUrl.searchParams;
	const dirPath = sp.get("path") || "";
	const page = Math.max(1, Number(sp.get("page")) || 1);
	const limit = Math.min(500, Math.max(1, Number(sp.get("limit")) || 100));
	const sort = sp.get("sort") === "size" ? "size" : "name";
	const order = sp.get("order") === "desc" ? "desc" : "asc";
	const search = (sp.get("search") || "").toLowerCase();

	// Security: reject traversal
	const segments = dirPath.split("/").filter(Boolean);
	if (segments.some((s) => s === ".." || s.includes("\0"))) {
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });
	}

	const fullPath = path.join(MEDIA_BASE, ...segments);
	const resolved = path.resolve(fullPath);
	if (!resolved.startsWith(MEDIA_BASE)) {
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });
	}

	try {
		const entries = await readdir(resolved, { withFileTypes: true });
		let files: FileEntry[] = [];

		for (const entry of entries) {
			// Skip hidden files and admin-config.json
			if (entry.name.startsWith(".") || entry.name === "admin-config.json" || entry.name === "catalog.json") continue;

			// Search filter
			if (search && !entry.name.toLowerCase().includes(search)) continue;

			const entryPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;
			const isDir = entry.isDirectory();
			let size = 0;
			if (!isDir) {
				try {
					const st = await stat(path.join(resolved, entry.name));
					size = st.size;
				} catch { /* skip */ }
			}

			files.push({
				name: entry.name,
				isDir,
				size,
				ext: isDir ? "" : path.extname(entry.name).toLowerCase().slice(1),
				path: entryPath,
			});
		}

		// Sort: directories first, then by chosen field
		files.sort((a, b) => {
			if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
			if (sort === "size") {
				return order === "asc" ? a.size - b.size : b.size - a.size;
			}
			const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
			return order === "asc" ? cmp : -cmp;
		});

		const total = files.length;
		const totalPages = Math.ceil(total / limit);
		const start = (page - 1) * limit;
		files = files.slice(start, start + limit);

		return NextResponse.json({ files, total, page, totalPages });
	} catch {
		return NextResponse.json({ error: "Directory not found" }, { status: 404 });
	}
}
