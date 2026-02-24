/**
 * Wiki Context Selector
 *
 * Maps agent IDs to the wiki pages they need in their context,
 * with per-page character budgets. This replaces the old approach
 * of dumping the same 7K Blueprint+DEVLOG to every agent.
 */

import { getFileByPath } from "@/app/(main)/app-builder/lib/queries";

interface WikiPageConfig {
	path: string;
	title: string;
	budget: number;
}

/**
 * Agent-to-wiki-pages mapping.
 * Each agent gets exactly the pages it needs with appropriate budgets.
 */
const AGENT_WIKI_MAP: Record<string, WikiPageConfig[]> = {
	"fullstack-developer": [
		{ path: "docs/README.md", title: "README", budget: 2000 },
		{ path: "docs/DATA-MODEL.md", title: "Data Model", budget: 3000 },
		{ path: "docs/ARCHITECTURE.md", title: "Architecture", budget: 2000 },
	],
	"backend-developer": [
		{ path: "docs/DATA-MODEL.md", title: "Data Model", budget: 3000 },
		{ path: "docs/API-REFERENCE.md", title: "API Reference", budget: 3000 },
	],
	"frontend-developer": [
		{ path: "docs/COMPONENTS.md", title: "Components", budget: 3000 },
		{ path: "docs/ARCHITECTURE.md", title: "Architecture", budget: 2000 },
	],
	"planner": [
		{ path: "docs/README.md", title: "README", budget: 2000 },
		{ path: "docs/ARCHITECTURE.md", title: "Architecture", budget: 2000 },
		{ path: "docs/DATA-MODEL.md", title: "Data Model", budget: 2000 },
	],
	"code-reviewer": [
		{ path: "docs/ARCHITECTURE.md", title: "Architecture", budget: 2000 },
		{ path: "docs/DATA-MODEL.md", title: "Data Model", budget: 2000 },
		{ path: "docs/CHANGELOG.md", title: "Changelog", budget: 1000 },
	],
	"build-error-resolver": [
		{ path: "docs/ARCHITECTURE.md", title: "Architecture", budget: 2000 },
		{ path: "docs/COMPONENTS.md", title: "Components", budget: 2000 },
	],
	"continuation-analyst": [
		{ path: "docs/README.md", title: "README", budget: 2000 },
		{ path: "docs/CHANGELOG.md", title: "Changelog", budget: 3000 },
		{ path: "docs/ARCHITECTURE.md", title: "Architecture", budget: 2000 },
	],
	"site-replicator": [
		{ path: "docs/README.md", title: "README", budget: 2000 },
	],
	"architect": [
		{ path: "docs/README.md", title: "README", budget: 2000 },
		{ path: "docs/ARCHITECTURE.md", title: "Architecture", budget: 2000 },
		{ path: "docs/DATA-MODEL.md", title: "Data Model", budget: 2000 },
	],
	"security-reviewer": [
		{ path: "docs/ARCHITECTURE.md", title: "Architecture", budget: 2000 },
		{ path: "docs/API-REFERENCE.md", title: "API Reference", budget: 2000 },
	],
	"doc-updater": [
		{ path: "docs/README.md", title: "README", budget: 3000 },
		{ path: "docs/DATA-MODEL.md", title: "Data Model", budget: 3000 },
		{ path: "docs/ARCHITECTURE.md", title: "Architecture", budget: 2000 },
		{ path: "docs/COMPONENTS.md", title: "Components", budget: 2000 },
		{ path: "docs/API-REFERENCE.md", title: "API Reference", budget: 2000 },
		{ path: "docs/CHANGELOG.md", title: "Changelog", budget: 1000 },
	],
};

/** Default pages for agents not explicitly mapped */
const DEFAULT_WIKI_PAGES: WikiPageConfig[] = [
	{ path: "docs/README.md", title: "README", budget: 2000 },
	{ path: "docs/CHANGELOG.md", title: "Changelog", budget: 1000 },
];

export interface WikiPage {
	title: string;
	path: string;
	content: string;
	budget: number;
}

/**
 * Fetch the wiki pages relevant for a specific agent.
 * Returns pages with content truncated to their budget.
 */
export async function getWikiPagesForAgent(
	appId: string,
	agentId: string,
): Promise<WikiPage[]> {
	const configs = AGENT_WIKI_MAP[agentId] || DEFAULT_WIKI_PAGES;
	const pages: WikiPage[] = [];

	for (const config of configs) {
		try {
			const file = await getFileByPath(appId, config.path);
			if (file?.content) {
				pages.push({
					title: config.title,
					path: config.path,
					content: file.content.slice(0, config.budget),
					budget: config.budget,
				});
			}
		} catch {
			// Best-effort — page may not exist yet
		}
	}

	// Backward compatibility: if no docs/ pages exist, try legacy files
	if (pages.length === 0) {
		try {
			const blueprint = await getFileByPath(appId, "Blueprint.md");
			if (blueprint?.content) {
				pages.push({
					title: "Blueprint",
					path: "Blueprint.md",
					content: blueprint.content.slice(0, 4000),
					budget: 4000,
				});
			}
		} catch {
			// Best-effort
		}
		try {
			const devlog = await getFileByPath(appId, "DEVLOG.md");
			if (devlog?.content) {
				pages.push({
					title: "Development History",
					path: "DEVLOG.md",
					content: devlog.content.slice(0, 3000),
					budget: 3000,
				});
			}
		} catch {
			// Best-effort
		}
	}

	return pages;
}

/**
 * Build the wiki context string for injection into agent prompts.
 */
export async function buildWikiContext(
	appId: string,
	agentId: string,
): Promise<string> {
	const pages = await getWikiPagesForAgent(appId, agentId);
	if (pages.length === 0) return "";

	const sections = pages.map(
		(p) => `## ${p.title}\n\`\`\`markdown\n${p.content}\n\`\`\``,
	);

	return "\n\n# Project Wiki\n" + sections.join("\n\n");
}
