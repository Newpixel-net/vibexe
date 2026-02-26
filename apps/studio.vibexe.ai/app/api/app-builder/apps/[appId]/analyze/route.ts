import {
	getAppById,
	getEnabledSuggestionTemplates,
	getFilesForApp,
} from "@/app/(main)/app-builder/lib/queries";
import { getUser } from "@/lib/auth/get-user";

/** Evaluate whether a suggestion template's conditions match the project analysis */
function matchesConditions(
	conditions: Record<string, unknown>,
	analysis: {
		fileCount: number;
		hasBlueprint: boolean;
		hasEntities: boolean;
		componentCount: number;
		todoCount: number;
		filePaths: string[];
		appName: string;
		blueprintContent: string;
	},
): boolean {
	if (!conditions || Object.keys(conditions).length === 0) return true;

	if (conditions.minFiles != null && analysis.fileCount < (conditions.minFiles as number)) return false;
	if (conditions.maxFiles != null && analysis.fileCount > (conditions.maxFiles as number)) return false;
	if (conditions.hasBlueprint === true && !analysis.hasBlueprint) return false;
	if (conditions.hasEntities === true && !analysis.hasEntities) return false;
	if (conditions.minComponents != null && analysis.componentCount < (conditions.minComponents as number)) return false;

	if (conditions.hasTodos === true && analysis.todoCount === 0) return false;
	if (conditions.hasTodos === false && analysis.todoCount > 0) return false;

	if (Array.isArray(conditions.filePatterns)) {
		const patterns = conditions.filePatterns as string[];
		const hasMatch = patterns.some((pat) =>
			analysis.filePaths.some((fp) => fp.includes(pat)),
		);
		if (!hasMatch) return false;
	}

	if (Array.isArray(conditions.missingPatterns)) {
		const patterns = conditions.missingPatterns as string[];
		const hasMatch = patterns.some((pat) =>
			analysis.filePaths.some((fp) => fp.toLowerCase().includes(pat.toLowerCase())),
		);
		if (hasMatch) return false; // file exists that should be missing
	}

	if (Array.isArray(conditions.keywords)) {
		const keywords = conditions.keywords as string[];
		const searchText = `${analysis.appName} ${analysis.blueprintContent}`.toLowerCase();
		const hasKeyword = keywords.some((kw) => searchText.includes(kw.toLowerCase()));
		if (!hasKeyword) return false;
	}

	return true;
}

/**
 * GET /api/app-builder/apps/[appId]/analyze
 *
 * Returns heuristic project analysis without AI calls.
 * Used by the continuation suggestions UI to detect returning users
 * and generate smart "what to do next" suggestions.
 * Now also returns matched suggestion templates from the admin-managed pool.
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
		return Response.json({ hasProject: false, suggestions: [] });
	}

	// Parse Blueprint.md for planned features
	const blueprint = files.find((f) => f.path === "Blueprint.md");
	const plannedFeatures: string[] = [];
	let hasBlueprint = false;
	let blueprintContent = "";

	if (blueprint?.content) {
		hasBlueprint = true;
		blueprintContent = blueprint.content;
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
	const filePaths = files.map((f) => f.path);

	// Interrupted build detection:
	// Count code files vs docs to detect if generation was cut short
	const codeFiles = files.filter((f) =>
		/\.(tsx?|jsx?|json)$/.test(f.path) && !f.path.startsWith("docs/"),
	);
	const docFiles = files.filter((f) =>
		f.path.endsWith(".md") || f.path.startsWith("docs/"),
	);
	const hasReadme = files.some((f) => f.path === "docs/README.md" || f.path === "README.md");

	// Heuristic: has README/Blueprint with file plan, but very few code files
	let buildInterrupted = false;
	if (hasReadme && !hasAppTsx && codeFiles.length < 3) {
		buildInterrupted = true; // Plan exists but root component missing
	} else if (hasBlueprint && codeFiles.length < 3 && docFiles.length > 3) {
		buildInterrupted = true; // Many docs (wiki) but few code files
	} else if (hasReadme && codeFiles.length > 0) {
		// Check if README mentions a File Map with more files than exist
		const readme = files.find((f) => f.path === "docs/README.md");
		if (readme?.content) {
			const fileMapMatch = readme.content.match(/(?:file\s*map|files?|structure)/i);
			const plannedPaths = readme.content.match(/`[^`]*\.(tsx?|jsx?|json)`/g);
			if (fileMapMatch && plannedPaths && plannedPaths.length > codeFiles.length * 2) {
				buildInterrupted = true;
			}
		}
	}

	// Match suggestion templates
	let suggestions: { id: number; label: string; prompt: string; icon: string; category: string }[] = [];
	try {
		const templates = await getEnabledSuggestionTemplates();
		const analysisCtx = {
			fileCount: files.length,
			hasBlueprint,
			hasEntities,
			componentCount,
			todoCount,
			filePaths,
			appName: app.name,
			blueprintContent,
		};

		suggestions = templates
			.filter((t) => matchesConditions((t.conditions ?? {}) as Record<string, unknown>, analysisCtx))
			.slice(0, 6)
			.map((t) => ({
				id: t.dbId,
				label: t.label,
				prompt: t.prompt,
				icon: t.icon ?? "sparkles",
				category: t.category ?? "general",
			}));
	} catch (e) {
		console.error("[Analyze] Suggestion matching error:", e);
	}

	// If build was interrupted, inject top-priority "Resume" suggestion
	if (buildInterrupted) {
		suggestions.unshift({
			id: -1,
			label: "Resume building — continue creating remaining files",
			prompt: "Read docs/README.md to understand the full plan, then continue building all remaining code files. Start with src/App.tsx if it doesn't exist, then create all components, hooks, and utilities listed in the plan.",
			icon: "zap",
			category: "interrupted",
		});
	}

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
		buildInterrupted,
		codeFileCount: codeFiles.length,
		suggestions,
	});
}
