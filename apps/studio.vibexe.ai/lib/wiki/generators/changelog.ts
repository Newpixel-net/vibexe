/**
 * CHANGELOG.md Generator
 *
 * Generates structured changelog entries that replace the old DEVLOG.md.
 * Each entry includes timestamp, category, user prompt, and files changed.
 */

export interface ChangelogEntry {
	category: string;
	userPrompt: string;
	filesChanged: string[];
	entitiesChanged?: string[];
}

/**
 * Generate a new CHANGELOG.md entry and prepend it to existing content.
 */
export function generateChangelogEntry(entry: ChangelogEntry): string {
	const now = new Date();
	const dateStr = now.toISOString().split("T")[0]; // 2026-02-24
	const timeStr = now.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});

	const sanitized = entry.userPrompt.slice(0, 300).replace(/\n/g, " ");
	const lines: string[] = [];

	lines.push(`## [${dateStr} ${timeStr}] ${entry.category}`);
	lines.push(`> ${sanitized}`);
	lines.push("");

	if (entry.filesChanged.length > 0) {
		const fileList = entry.filesChanged
			.filter((f) => !f.startsWith("docs/"))
			.slice(0, 15)
			.map((f) => `\`${f}\``)
			.join(", ");
		if (fileList) {
			lines.push(`**Files changed:** ${fileList}`);
		}
	}

	if (entry.entitiesChanged && entry.entitiesChanged.length > 0) {
		lines.push(`**Entities:** ${entry.entitiesChanged.join(", ")}`);
	}

	lines.push("");
	return lines.join("\n");
}

const CHANGELOG_HEADER = `# Changelog

> Automatically tracks all changes to this project. Newest entries first.

---

`;

/**
 * Build the full CHANGELOG.md content by prepending a new entry.
 */
export function buildChangelog(
	existingContent: string | null,
	entry: ChangelogEntry,
): string {
	const newEntry = generateChangelogEntry(entry);

	if (!existingContent) {
		return CHANGELOG_HEADER + newEntry;
	}

	// Find the end of the header (after first "---")
	const lines = existingContent.split("\n");
	const headerEnd = lines.findIndex((l, i) => i > 0 && l.startsWith("---"));
	if (headerEnd === -1) {
		return CHANGELOG_HEADER + newEntry;
	}

	const header = lines.slice(0, headerEnd + 1).join("\n");
	const body = lines.slice(headerEnd + 1).join("\n");

	return header + "\n\n" + newEntry + body.trimStart();
}
