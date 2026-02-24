/**
 * COMPONENTS.md Generator
 *
 * Parses .tsx/.jsx files to extract component names, file paths,
 * and import dependencies. Builds a component catalog.
 */

interface FileEntry {
	path: string;
	content: string | null;
}

interface ComponentInfo {
	name: string;
	path: string;
	imports: string[];
}

/**
 * Generate COMPONENTS.md from the project's TSX/JSX files.
 */
export function generateComponents(files: FileEntry[]): string {
	const tsxFiles = files.filter(
		(f) =>
			(f.path.endsWith(".tsx") || f.path.endsWith(".jsx")) &&
			f.content,
	);

	if (tsxFiles.length === 0) {
		return `# Components

> No React components found yet. Components will appear here after code generation.
`;
	}

	const components = tsxFiles.map((f) => extractComponent(f));

	const lines: string[] = [];
	lines.push("# Components");
	lines.push("");
	lines.push(`> ${components.length} component${components.length === 1 ? "" : "s"} across ${tsxFiles.length} file${tsxFiles.length === 1 ? "" : "s"}`);
	lines.push("");

	// Component table
	lines.push("| Component | File | Imports |");
	lines.push("|-----------|------|---------|");
	for (const comp of components) {
		const imports = comp.imports.length > 0
			? comp.imports.slice(0, 5).join(", ")
			: "\u2014";
		lines.push(`| **${comp.name}** | \`${comp.path}\` | ${imports} |`);
	}
	lines.push("");

	// Detailed sections for components with content
	for (const comp of components) {
		lines.push(`## ${comp.name}`);
		lines.push("");
		lines.push(`**File:** \`${comp.path}\``);
		if (comp.imports.length > 0) {
			lines.push(`**Imports:** ${comp.imports.join(", ")}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Extract component info from a single file.
 */
function extractComponent(file: FileEntry): ComponentInfo {
	const content = file.content || "";
	const fileName = file.path.split("/").pop()?.replace(/\.(tsx|jsx)$/, "") || "Unknown";

	// Try to find exported component name
	let name = fileName;

	// Match: export function ComponentName
	const funcMatch = content.match(/export\s+(?:default\s+)?function\s+(\w+)/);
	if (funcMatch) {
		name = funcMatch[1];
	}

	// Match: export const ComponentName = ...
	if (name === fileName) {
		const constMatch = content.match(/export\s+(?:default\s+)?const\s+(\w+)/);
		if (constMatch) {
			name = constMatch[1];
		}
	}

	// Extract local component imports (from same project, not libraries)
	const imports: string[] = [];
	const importRegex = /import\s+(?:\{[^}]*\}|(\w+)).*from\s+["']\.\/[^"']+["']/g;
	let match: RegExpExecArray | null;
	while ((match = importRegex.exec(content)) !== null) {
		// Extract named imports
		const fullImport = match[0];
		const namedMatch = fullImport.match(/\{([^}]+)\}/);
		if (namedMatch) {
			const names = namedMatch[1].split(",").map((n) => n.trim().split(" as ")[0].trim());
			imports.push(...names.filter((n) => n && /^[A-Z]/.test(n)));
		}
		// Default import
		if (match[1] && /^[A-Z]/.test(match[1])) {
			imports.push(match[1]);
		}
	}

	return { name, path: file.path, imports };
}
