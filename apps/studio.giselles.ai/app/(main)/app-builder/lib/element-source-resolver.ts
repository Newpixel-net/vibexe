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
}

/**
 * Find the source file and line for a selected element.
 * Matches by className and/or textContent in JSX files.
 */
export function resolveElementSource(
	element: {
		tagName: string;
		className: string;
		textContent: string;
	},
	files: AppFile[],
): SourceLocation | null {
	const jsxFiles = files.filter(
		(f) =>
			f.path.endsWith(".tsx") ||
			f.path.endsWith(".jsx") ||
			f.path.endsWith(".js") ||
			f.path.endsWith(".ts"),
	);

	// Strategy 1: Match by className (most reliable)
	if (element.className) {
		// Escape special regex chars in className, and search for it in className="..."
		const escaped = element.className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const classPattern = new RegExp(
			`className=["'\`]${escaped}["'\`]`,
		);

		for (const file of jsxFiles) {
			if (!file.content) continue;
			const lines = file.content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				if (classPattern.test(lines[i])) {
					return {
						filePath: file.path,
						fileId: file.id,
						lineNumber: i + 1,
						lineContent: lines[i],
					};
				}
			}
		}

		// Partial match: search for the first 3 classes
		const classTokens = element.className.split(/\s+/).slice(0, 3);
		if (classTokens.length >= 2) {
			for (const file of jsxFiles) {
				if (!file.content) continue;
				const lines = file.content.split("\n");
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					if (
						line.includes("className=") &&
						classTokens.every((cls) => line.includes(cls))
					) {
						return {
							filePath: file.path,
							fileId: file.id,
							lineNumber: i + 1,
							lineContent: line,
						};
					}
				}
			}
		}
	}

	// Strategy 2: Match by text content + tag name
	if (element.textContent && element.textContent.length > 2) {
		const text = element.textContent.trim().slice(0, 60);
		const tag = element.tagName.toLowerCase();

		for (const file of jsxFiles) {
			if (!file.content) continue;
			const lines = file.content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				// Check if line has the tag and contains the text
				if (
					line.includes(`<${tag}`) &&
					line.includes(text.slice(0, 20))
				) {
					return {
						filePath: file.path,
						fileId: file.id,
						lineNumber: i + 1,
						lineContent: line,
					};
				}
			}
		}

		// Broader: just search for the text content
		for (const file of jsxFiles) {
			if (!file.content) continue;
			const lines = file.content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].includes(text.slice(0, 30))) {
					return {
						filePath: file.path,
						fileId: file.id,
						lineNumber: i + 1,
						lineContent: lines[i],
					};
				}
			}
		}
	}

	return null;
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

	// Replace the className value on that line
	lines[idx] = lines[idx].replace(
		`className="${oldClassName}"`,
		`className="${newClassName}"`,
	);
	// Also handle single quotes and template literals
	lines[idx] = lines[idx].replace(
		`className='${oldClassName}'`,
		`className='${newClassName}'`,
	);

	return lines.join("\n");
}

/**
 * Update text content in source code at a specific location.
 * Handles text between JSX tags.
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
 * Finds the JSX element spanning from the line and removes it.
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
		// Count opening tags (excluding self-closing)
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
