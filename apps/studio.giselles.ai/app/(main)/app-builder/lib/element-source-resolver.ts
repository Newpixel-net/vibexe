/**
 * Element Source Resolver
 *
 * Given a selected DOM element and project files, find the source file and line
 * where that element is defined in JSX.
 */

import type { AppFile } from "../adapters/file-adapter";

export interface SourceLocation {
	filePath: string;
	fileId: string;
	lineNumber: number;
	lineContent: string;
	confidence: number; // 0-1, higher = more confident
}

// Cache to avoid re-scanning files on every call
const resolverCache = new Map<string, SourceLocation | null>();

function cacheKey(element: { tagName: string; className: string; textContent: string }): string {
	return `${element.tagName}|${element.className}|${element.textContent.slice(0, 60)}`;
}

/**
 * Clear the resolver cache (call when files change).
 */
export function clearResolverCache(): void {
	resolverCache.clear();
}

/**
 * Find the source file and line for a selected element.
 * Uses multiple strategies with confidence scoring, returns best match.
 */
export function resolveElementSource(
	element: {
		tagName: string;
		className: string;
		textContent: string;
	},
	files: AppFile[],
): SourceLocation | null {
	const key = cacheKey(element);
	if (resolverCache.has(key)) return resolverCache.get(key) || null;

	const jsxFiles = files.filter(
		(f) =>
			f.path.endsWith(".tsx") ||
			f.path.endsWith(".jsx") ||
			f.path.endsWith(".js") ||
			f.path.endsWith(".ts"),
	);

	const candidates: SourceLocation[] = [];

	// Strategy 1: Exact className match (highest confidence)
	if (element.className) {
		const escaped = element.className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const classPattern = new RegExp(`className=["'\`]${escaped}["'\`]`);

		for (const file of jsxFiles) {
			if (!file.content) continue;
			const lines = file.content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				if (classPattern.test(lines[i])) {
					candidates.push({
						filePath: file.path,
						fileId: file.id,
						lineNumber: i + 1,
						lineContent: lines[i],
						confidence: 1.0,
					});
				}
			}
		}
	}

	// Strategy 2: Multi-line className match (join adjacent lines)
	if (element.className && candidates.length === 0) {
		const classTokens = element.className.split(/\s+/).filter(Boolean);
		if (classTokens.length >= 2) {
			for (const file of jsxFiles) {
				if (!file.content) continue;
				const lines = file.content.split("\n");
				for (let i = 0; i < lines.length; i++) {
					// Check current line and next few lines (multi-line className)
					const block = lines.slice(i, Math.min(i + 5, lines.length)).join(" ");
					if (
						block.includes("className") &&
						classTokens.every((cls) => block.includes(cls))
					) {
						candidates.push({
							filePath: file.path,
							fileId: file.id,
							lineNumber: i + 1,
							lineContent: lines[i],
							confidence: 0.85,
						});
					}
				}
			}
		}
	}

	// Strategy 3: cn() / clsx() / twMerge() pattern matching
	if (element.className && candidates.length === 0) {
		const firstClasses = element.className.split(/\s+/).slice(0, 3);
		if (firstClasses.length >= 1) {
			const cnPattern = /(?:cn|clsx|twMerge|classNames)\s*\(/;
			for (const file of jsxFiles) {
				if (!file.content) continue;
				const lines = file.content.split("\n");
				for (let i = 0; i < lines.length; i++) {
					if (cnPattern.test(lines[i])) {
						const block = lines.slice(i, Math.min(i + 8, lines.length)).join(" ");
						if (firstClasses.every((cls) => block.includes(cls))) {
							candidates.push({
								filePath: file.path,
								fileId: file.id,
								lineNumber: i + 1,
								lineContent: lines[i],
								confidence: 0.7,
							});
						}
					}
				}
			}
		}
	}

	// Strategy 4: Partial class match (first 3 classes in className="...")
	if (element.className && candidates.length === 0) {
		const classTokens = element.className.split(/\s+/).slice(0, 3);
		if (classTokens.length >= 2) {
			for (const file of jsxFiles) {
				if (!file.content) continue;
				const lines = file.content.split("\n");
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					if (
						line.includes("className") &&
						classTokens.every((cls) => line.includes(cls))
					) {
						candidates.push({
							filePath: file.path,
							fileId: file.id,
							lineNumber: i + 1,
							lineContent: line,
							confidence: 0.6,
						});
					}
				}
			}
		}
	}

	// Strategy 5: Match by text content + tag name
	if (element.textContent && element.textContent.trim().length > 2) {
		const text = element.textContent.trim().slice(0, 60);
		const tag = element.tagName.toLowerCase();

		for (const file of jsxFiles) {
			if (!file.content) continue;
			const lines = file.content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line.includes(`<${tag}`) && line.includes(text.slice(0, 20))) {
					candidates.push({
						filePath: file.path,
						fileId: file.id,
						lineNumber: i + 1,
						lineContent: line,
						confidence: 0.5,
					});
				}
			}
		}

		// Broader: just search for the text content
		if (candidates.length === 0) {
			for (const file of jsxFiles) {
				if (!file.content) continue;
				const lines = file.content.split("\n");
				for (let i = 0; i < lines.length; i++) {
					if (lines[i].includes(text.slice(0, 30))) {
						candidates.push({
							filePath: file.path,
							fileId: file.id,
							lineNumber: i + 1,
							lineContent: lines[i],
							confidence: 0.3,
						});
					}
				}
			}
		}
	}

	// Return highest confidence match
	candidates.sort((a, b) => b.confidence - a.confidence);
	const result = candidates[0] || null;
	resolverCache.set(key, result);
	return result;
}

/**
 * Update a className in source code at a specific location.
 * Returns the modified file content.
 */
export function updateClassNameInSource(
	fileContent: string,
	lineNumber: number,
	oldClassName: string,
	newClassName: string,
): string {
	const lines = fileContent.split("\n");
	const idx = lineNumber - 1;
	if (idx < 0 || idx >= lines.length) return fileContent;

	// Replace className="old" with className="new"
	lines[idx] = lines[idx].replace(
		`className="${oldClassName}"`,
		`className="${newClassName}"`,
	);
	// Also handle single quotes
	lines[idx] = lines[idx].replace(
		`className='${oldClassName}'`,
		`className='${newClassName}'`,
	);

	return lines.join("\n");
}

/**
 * Update text content in source code at a specific location.
 */
export function updateTextContentInSource(
	fileContent: string,
	lineNumber: number,
	oldText: string,
	newText: string,
): string {
	const lines = fileContent.split("\n");
	const idx = lineNumber - 1;
	if (idx < 0 || idx >= lines.length) return fileContent;

	lines[idx] = lines[idx].replace(oldText, newText);
	return lines.join("\n");
}

/**
 * Delete an element from source code.
 */
export function deleteElementFromSource(
	fileContent: string,
	lineNumber: number,
	tagName: string,
): string {
	const lines = fileContent.split("\n");
	const idx = lineNumber - 1;
	if (idx < 0 || idx >= lines.length) return fileContent;

	const line = lines[idx];
	const tag = tagName.toLowerCase();

	// Self-closing: <tag ... />
	if (line.includes(`<${tag}`) && line.includes("/>")) {
		lines.splice(idx, 1);
		return lines.join("\n");
	}

	// Find closing tag
	let depth = 0;
	let endIdx = idx;
	for (let i = idx; i < lines.length; i++) {
		const l = lines[i];
		const opens = (l.match(new RegExp(`<${tag}[\\s>]`, "gi")) || []).length;
		const selfCloses = (l.match(new RegExp(`<${tag}[^>]*/>`, "gi")) || []).length;
		const closes = (l.match(new RegExp(`</${tag}>`, "gi")) || []).length;
		depth += opens - selfCloses - closes;
		if (depth <= 0) {
			endIdx = i;
			break;
		}
	}

	lines.splice(idx, endIdx - idx + 1);
	return lines.join("\n");
}
