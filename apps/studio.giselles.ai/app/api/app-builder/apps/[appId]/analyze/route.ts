import {
	getAppById,
	getFilesForApp,
} from "@/app/(main)/app-builder/lib/queries";
import { getUser } from "@/lib/auth/get-user";

/**
 * GET /api/app-builder/apps/[appId]/analyze
 *
 * Returns heuristic project analysis without AI calls.
 * Used by the continuation suggestions UI to detect returning users
 * and generate smart "what to do next" suggestions.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ appId: string }> },
) {
	const user = await getUser();
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { appId } = await params;
	const app = await getAppById(appId, user.id);
	if (!app) {
		return Response.json({ error: "App not found" }, { status: 404 });
	}

	const files = await getFilesForApp(appId);

	if (files.length === 0) {
		return Response.json({ hasProject: false });
	}

	// Parse Blueprint.md for planned features
	const blueprint = files.find((f) => f.path === "Blueprint.md");
	const plannedFeatures: string[] = [];
	let hasBlueprint = false;

	if (blueprint?.content) {
		hasBlueprint = true;
		// Extract features from "## Features" section (bullet points)
		const featuresMatch = blueprint.content.match(
			/##\s*Features?\s*\n([\s\S]*?)(?=\n##\s|\n---|\Z)/i,
		);
		if (featuresMatch) {
			const lines = featuresMatch[1].split("\n");
			for (const line of lines) {
				const bullet = line.match(/^[\s]*[-*]\s+\*?\*?(.+?)\*?\*?\s*$/);
				if (bullet) {
					const feature = bullet[1]
						.replace(/\*\*/g, "")
						.replace(/\s*[-—:].+$/, "")
						.trim();
					if (feature.length > 2 && feature.length < 100) {
						plannedFeatures.push(feature);
					}
				}
			}
		}
	}

	// Count TODO/FIXME/HACK comments across all files
	let todoCount = 0;
	const todoItems: string[] = [];
	const hasEntities = files.some((f) => f.path === "src/types/index.ts");

	for (const file of files) {
		if (!file.content) continue;
		const matches = file.content.match(/(?:TODO|FIXME|HACK|XXX)[\s:]+(.+)/gi);
		if (matches) {
			todoCount += matches.length;
			for (const m of matches.slice(0, 5)) {
				const text = m.replace(/^(?:TODO|FIXME|HACK|XXX)[\s:]+/i, "").trim();
				if (text.length > 2) todoItems.push(text);
			}
		}
	}

	// Detect key files for completeness signals
	const hasAppTsx = files.some((f) => f.path === "src/App.tsx");
	const componentCount = files.filter((f) =>
		f.path.startsWith("src/components/"),
	).length;
	const hookCount = files.filter((f) =>
		f.path.startsWith("src/hooks/"),
	).length;

	return Response.json({
		hasProject: true,
		fileCount: files.length,
		hasBlueprint,
		hasEntities,
		hasAppTsx,
		componentCount,
		hookCount,
		todoCount,
		todoItems: todoItems.slice(0, 5),
		plannedFeatures: plannedFeatures.slice(0, 10),
		appName: app.name,
	});
}
