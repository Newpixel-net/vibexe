/**
 * API-REFERENCE.md Generator
 *
 * Scans code files for SDK usage patterns (app.data.*, app.auth.*,
 * app.storage.*, app.functions.*, app.jobs.*) and documents them.
 */

interface FileEntry {
	path: string;
	content: string | null;
}

interface SdkUsage {
	method: string;
	file: string;
	category: "data" | "auth" | "storage" | "functions" | "jobs" | "realtime";
}

/**
 * Generate API-REFERENCE.md by scanning files for SDK usage.
 */
export function generateApiReference(files: FileEntry[]): string {
	const codeFiles = files.filter(
		(f) =>
			(f.path.endsWith(".ts") || f.path.endsWith(".tsx")) &&
			!f.path.startsWith("docs/") &&
			f.content,
	);

	if (codeFiles.length === 0) {
		return `# API Reference

> No SDK usage detected yet. API documentation will appear here after code generation.
`;
	}

	const usages = scanSdkUsage(codeFiles);

	if (usages.length === 0) {
		return `# API Reference

> This app does not use the @vibexe/sdk. It uses React state and/or localStorage for data.
`;
	}

	const lines: string[] = [];
	lines.push("# API Reference");
	lines.push("");
	lines.push(`> SDK methods used across ${new Set(usages.map((u) => u.file)).size} file${usages.length === 1 ? "" : "s"}`);
	lines.push("");

	// Group by category
	const grouped = groupBy(usages, "category");

	// Data methods
	if (grouped.data) {
		lines.push("## Data API (`app.data.*`)");
		lines.push("");
		lines.push("| Method | Used In |");
		lines.push("|--------|---------|");
		const deduped = deduplicateUsages(grouped.data);
		for (const u of deduped) {
			lines.push(`| \`${u.method}\` | \`${u.files.join("`, `")}\` |`);
		}
		lines.push("");
	}

	// Auth methods
	if (grouped.auth) {
		lines.push("## Auth API (`app.auth.*`)");
		lines.push("");
		lines.push("| Method | Used In |");
		lines.push("|--------|---------|");
		const deduped = deduplicateUsages(grouped.auth);
		for (const u of deduped) {
			lines.push(`| \`${u.method}\` | \`${u.files.join("`, `")}\` |`);
		}
		lines.push("");
	}

	// Storage methods
	if (grouped.storage) {
		lines.push("## Storage API (`app.storage.*`)");
		lines.push("");
		lines.push("| Method | Used In |");
		lines.push("|--------|---------|");
		const deduped = deduplicateUsages(grouped.storage);
		for (const u of deduped) {
			lines.push(`| \`${u.method}\` | \`${u.files.join("`, `")}\` |`);
		}
		lines.push("");
	}

	// Functions methods
	if (grouped.functions) {
		lines.push("## Backend Functions (`app.functions.*`)");
		lines.push("");
		lines.push("| Method | Used In |");
		lines.push("|--------|---------|");
		const deduped = deduplicateUsages(grouped.functions);
		for (const u of deduped) {
			lines.push(`| \`${u.method}\` | \`${u.files.join("`, `")}\` |`);
		}
		lines.push("");
	}

	// Jobs methods
	if (grouped.jobs) {
		lines.push("## Background Jobs (`app.jobs.*`)");
		lines.push("");
		lines.push("| Method | Used In |");
		lines.push("|--------|---------|");
		const deduped = deduplicateUsages(grouped.jobs);
		for (const u of deduped) {
			lines.push(`| \`${u.method}\` | \`${u.files.join("`, `")}\` |`);
		}
		lines.push("");
	}

	// Realtime subscriptions
	if (grouped.realtime) {
		lines.push("## Real-Time Subscriptions (`app.data.subscribe`)");
		lines.push("");
		lines.push("| Method | Used In |");
		lines.push("|--------|---------|");
		const deduped = deduplicateUsages(grouped.realtime);
		for (const u of deduped) {
			lines.push(`| \`${u.method}\` | \`${u.files.join("`, `")}\` |`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Scan files for SDK usage patterns.
 */
function scanSdkUsage(files: FileEntry[]): SdkUsage[] {
	const usages: SdkUsage[] = [];

	const patterns: { regex: RegExp; category: SdkUsage["category"] }[] = [
		{ regex: /app\.data\.\w+/g, category: "data" },
		{ regex: /app\.auth\.\w+/g, category: "auth" },
		{ regex: /app\.storage\.\w+/g, category: "storage" },
		{ regex: /app\.functions\.\w+/g, category: "functions" },
		{ regex: /app\.jobs\.\w+/g, category: "jobs" },
	];

	for (const file of files) {
		const content = file.content || "";
		for (const { regex, category } of patterns) {
			// Reset regex state
			const re = new RegExp(regex.source, regex.flags);
			let match: RegExpExecArray | null;
			while ((match = re.exec(content)) !== null) {
				const method = match[0];
				// Detect subscribe as realtime
				if (method === "app.data.subscribe") {
					usages.push({ method, file: file.path, category: "realtime" });
				} else {
					usages.push({ method, file: file.path, category });
				}
			}
		}
	}

	return usages;
}

function groupBy(usages: SdkUsage[], key: keyof SdkUsage): Record<string, SdkUsage[]> {
	const result: Record<string, SdkUsage[]> = {};
	for (const u of usages) {
		const k = u[key] as string;
		if (!result[k]) result[k] = [];
		result[k].push(u);
	}
	return result;
}

interface DedupedUsage {
	method: string;
	files: string[];
}

function deduplicateUsages(usages: SdkUsage[]): DedupedUsage[] {
	const map = new Map<string, Set<string>>();
	for (const u of usages) {
		if (!map.has(u.method)) map.set(u.method, new Set());
		map.get(u.method)!.add(u.file);
	}
	return Array.from(map.entries()).map(([method, files]) => ({
		method,
		files: Array.from(files).slice(0, 5),
	}));
}
