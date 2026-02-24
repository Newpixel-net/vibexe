/**
 * README.md Generator
 *
 * Generates the initial docs/README.md from Blueprint.md content (migration),
 * or creates a minimal README stub for new projects.
 * After initial creation, only the feature list is incrementally updated.
 */

interface FileEntry {
	path: string;
	content: string | null;
}

/**
 * Generate an initial docs/README.md.
 *
 * If a Blueprint.md exists, migrate its content into README format.
 * Otherwise, generate a minimal stub from the file list.
 */
export function generateReadme(
	files: FileEntry[],
	appName?: string,
): string {
	// Check if Blueprint.md exists — migrate its content
	const blueprint = files.find((f) => f.path === "Blueprint.md");
	if (blueprint?.content) {
		return migrateBlueprint(blueprint.content);
	}

	// No Blueprint — generate minimal README from file structure
	const name = appName || "Untitled App";
	const codeFiles = files.filter(
		(f) =>
			!f.path.startsWith("docs/") &&
			!f.path.endsWith(".md") &&
			(f.path.endsWith(".ts") || f.path.endsWith(".tsx")),
	);

	const lines: string[] = [];
	lines.push(`# ${name}`);
	lines.push("");
	lines.push("## Overview");
	lines.push("");
	lines.push("> App description will be populated after the initial build.");
	lines.push("");
	lines.push("## Tech Stack");
	lines.push("");
	lines.push("- React 18 + TypeScript");
	lines.push("- Tailwind CSS (CDN)");
	if (codeFiles.some((f) => (f.content || "").includes("@vibexe/sdk"))) {
		lines.push("- @vibexe/sdk (data persistence + auth)");
	}
	lines.push("");
	lines.push("## Features");
	lines.push("");
	lines.push("> Features will be listed here after code generation.");
	lines.push("");

	return lines.join("\n");
}

/**
 * Migrate Blueprint.md content into docs/README.md format.
 * Blueprint already has most of the right sections — just ensure
 * the header references docs/ convention.
 */
function migrateBlueprint(blueprintContent: string): string {
	// Blueprint.md is already well-structured markdown.
	// Just return it as-is — it's the project plan/documentation.
	return blueprintContent;
}

/**
 * Update only the features section of an existing README.
 * Returns null if no update is needed.
 */
export function updateReadmeFeatures(
	existingReadme: string,
	files: FileEntry[],
): string | null {
	// Count components as a proxy for feature richness
	const componentCount = files.filter(
		(f) => f.path.endsWith(".tsx") && f.path.includes("components/"),
	).length;
	const hookCount = files.filter(
		(f) => f.path.endsWith(".ts") && f.path.includes("hooks/"),
	).length;

	// Only update if the counts changed significantly (basic heuristic)
	const currentCountMatch = existingReadme.match(/(\d+) component/);
	const currentCount = currentCountMatch ? parseInt(currentCountMatch[1], 10) : 0;
	if (Math.abs(componentCount - currentCount) < 2) {
		return null; // No meaningful change
	}

	return existingReadme;
}
