import { readFile } from "node:fs/promises";
import { MediaStockClient } from "./media-stock-client";

interface CatalogPack {
	name: string;
	path: string;
	files: number;
	formats: string[];
}

interface CatalogCategory {
	packs: CatalogPack[];
}

interface Catalog {
	version: string;
	basePath: string;
	totalFiles: number;
	totalSize: string;
	categories: Record<string, CatalogCategory>;
}

async function loadCatalog(): Promise<Catalog | null> {
	try {
		const raw = await readFile(
			"/opt/vibexe/media-stock/games/catalog.json",
			"utf-8",
		);
		return JSON.parse(raw) as Catalog;
	} catch {
		// Dev environment — catalog doesn't exist locally
		return null;
	}
}

export default async function MediaStockPage() {
	const catalog = await loadCatalog();
	return <MediaStockClient catalog={catalog} />;
}
