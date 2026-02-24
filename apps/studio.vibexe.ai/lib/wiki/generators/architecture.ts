/**
 * ARCHITECTURE.md Generator
 *
 * Generates a file tree and component dependency diagram (Mermaid)
 * from the project's file structure.
 */

interface FileEntry {
	path: string;
	content: string | null;
}

/**
 * Generate ARCHITECTURE.md from the project's files.
 */
export function generateArchitecture(files: FileEntry[]): string {
	const codeFiles = files.filter(
		(f) => !f.path.startsWith("docs/") && f.path !== "DEVLOG.md",
	);

	if (codeFiles.length === 0) {
		return `# Architecture

> No source files found yet. Architecture overview will appear here after code generation.
`;
	}

	const lines: string[] = [];
	lines.push("# Architecture");
	lines.push("");
	lines.push(`> ${codeFiles.length} file${codeFiles.length === 1 ? "" : "s"} in project`);
	lines.push("");

	// --- File tree ---
	lines.push("## File Structure");
	lines.push("");
	lines.push("```");
	const tree = buildFileTree(codeFiles.map((f) => f.path));
	lines.push(tree);
	lines.push("```");
	lines.push("");

	// --- Tech stack detection ---
	const techStack = detectTechStack(codeFiles);
	if (techStack.length > 0) {
		lines.push("## Tech Stack");
		lines.push("");
		for (const tech of techStack) {
			lines.push(`- ${tech}`);
		}
		lines.push("");
	}

	// --- Component dependency diagram ---
	const tsxFiles = codeFiles.filter(
		(f) => (f.path.endsWith(".tsx") || f.path.endsWith(".jsx")) && f.content,
	);
	if (tsxFiles.length > 1) {
		const deps = buildDependencyGraph(tsxFiles);
		if (deps.length > 0) {
			lines.push("## Component Dependencies");
			lines.push("");
			lines.push("```mermaid");
			lines.push("graph TD");
			for (const dep of deps) {
				lines.push(`    ${dep.from} --> ${dep.to}`);
			}
			lines.push("```");
			lines.push("");
		}
	}

	// --- Routing detection ---
	const appFile = codeFiles.find((f) => f.path === "src/App.tsx");
	if (appFile?.content) {
		const routes = detectRoutes(appFile.content);
		if (routes.length > 0) {
			lines.push("## Routes");
			lines.push("");
			lines.push("| Hash Route | Component |");
			lines.push("|-----------|-----------|");
			for (const route of routes) {
				lines.push(`| \`${route.hash}\` | ${route.component} |`);
			}
			lines.push("");
		}
	}

	return lines.join("\n");
}

/**
 * Build an ASCII file tree from a list of paths.
 */
function buildFileTree(paths: string[]): string {
	const sorted = [...paths].sort();
	const lines: string[] = [];

	for (let i = 0; i < sorted.length; i++) {
		const parts = sorted[i].split("/");
		const depth = parts.length - 1;
		const isLast =
			i === sorted.length - 1 ||
			!sorted[i + 1].startsWith(parts.slice(0, -1).join("/") + "/");

		// Check if we need to show directory headers
		if (depth > 0) {
			const dirPath = parts.slice(0, -1).join("/");
			// Only print the directory if it's the first file in it
			const prevParts = i > 0 ? sorted[i - 1].split("/") : [];
			const prevDir = prevParts.slice(0, -1).join("/");
			if (dirPath !== prevDir) {
				const indent = "  ".repeat(depth - 1);
				lines.push(`${indent}${parts[depth - 1]}/`);
			}
		}

		const indent = "  ".repeat(depth);
		const prefix = isLast ? "\u2514\u2500 " : "\u251C\u2500 ";
		lines.push(`${indent}${prefix}${parts[parts.length - 1]}`);
	}

	return lines.join("\n");
}

/**
 * Detect tech stack from file contents.
 */
function detectTechStack(files: FileEntry[]): string[] {
	const stack: string[] = ["React 18 + TypeScript"];
	const allContent = files.map((f) => f.content || "").join("\n");

	if (allContent.includes("className=")) {
		stack.push("Tailwind CSS (CDN)");
	}
	if (allContent.includes("@vibexe/sdk") || allContent.includes("VibexeApp")) {
		stack.push("@vibexe/sdk (data persistence + auth)");
	}
	if (allContent.includes("localStorage")) {
		stack.push("localStorage (client-side storage)");
	}
	if (allContent.includes("window.location.hash")) {
		stack.push("Hash-based routing");
	}

	return stack;
}

interface Dependency {
	from: string;
	to: string;
}

/**
 * Build a dependency graph from component imports.
 */
function buildDependencyGraph(files: FileEntry[]): Dependency[] {
	const deps: Dependency[] = [];
	const fileMap = new Map<string, string>(); // path -> component name

	// Build map of file paths to component names
	for (const f of files) {
		const name = extractComponentName(f);
		fileMap.set(f.path, name);
	}

	// Find imports between components
	for (const f of files) {
		const fromName = fileMap.get(f.path) || "Unknown";
		const content = f.content || "";

		const importRegex = /import\s+.*from\s+["'](\.[^"']+)["']/g;
		let match: RegExpExecArray | null;
		while ((match = importRegex.exec(content)) !== null) {
			const importPath = match[1];
			// Resolve relative import to absolute path
			const resolved = resolveImport(f.path, importPath);
			const toName = fileMap.get(resolved) || fileMap.get(resolved + ".tsx") || fileMap.get(resolved + ".jsx");
			if (toName && toName !== fromName) {
				deps.push({ from: fromName, to: toName });
			}
		}
	}

	return deps;
}

function extractComponentName(file: FileEntry): string {
	const content = file.content || "";
	const funcMatch = content.match(/export\s+(?:default\s+)?function\s+(\w+)/);
	if (funcMatch) return funcMatch[1];
	const constMatch = content.match(/export\s+(?:default\s+)?const\s+(\w+)/);
	if (constMatch) return constMatch[1];
	return file.path.split("/").pop()?.replace(/\.(tsx|jsx)$/, "") || "Unknown";
}

function resolveImport(fromPath: string, importPath: string): string {
	const fromDir = fromPath.split("/").slice(0, -1).join("/");
	const parts = importPath.split("/");
	const result: string[] = fromDir ? fromDir.split("/") : [];

	for (const part of parts) {
		if (part === ".") continue;
		if (part === "..") {
			result.pop();
		} else {
			result.push(part);
		}
	}

	return result.join("/");
}

interface RouteInfo {
	hash: string;
	component: string;
}

/**
 * Detect hash-based routes from App.tsx.
 */
function detectRoutes(appContent: string): RouteInfo[] {
	const routes: RouteInfo[] = [];
	// Match patterns like: case "#/tasks": return <TaskList />
	// Or: hash === "#/tasks" && <TaskList />
	const caseRegex = /case\s+["']([^"']+)["']\s*:\s*return\s+<(\w+)/g;
	let match: RegExpExecArray | null;
	while ((match = caseRegex.exec(appContent)) !== null) {
		routes.push({ hash: match[1], component: match[2] });
	}

	// Also match: hash === "..." pattern
	const eqRegex = /hash\s*===\s*["']([^"']+)["'].*?<(\w+)/g;
	while ((match = eqRegex.exec(appContent)) !== null) {
		if (!routes.some((r) => r.hash === match![1])) {
			routes.push({ hash: match[1], component: match[2] });
		}
	}

	return routes;
}
