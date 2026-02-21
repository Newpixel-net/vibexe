import type { AgentDefinition } from "../types";

/**
 * Chain Condenser — Agent Chaining via Knowledge Injection
 *
 * Instead of running separate LLM calls for each agent in the pipeline
 * (which blocks the HTTP response and kills WHM proxy connections),
 * we extract the key decision frameworks from upstream read-only agents
 * (architect, planner) and inject them into the developer's system prompt.
 *
 * This gives the developer "all three agents' intelligence" in a single
 * streaming call — no sequential blocking, no proxy timeouts.
 *
 * FEATURE_FLOW: architect → planner → developer
 * becomes: developer (with architect frameworks + planner process embedded)
 */

/** Sections to SKIP — developer already has platform constraints and SDK docs */
const SKIP_HEADERS = [
	"Platform Constraints",
	"Tech Stack",
	"@vibexe/sdk",
	"Output Format",
];

/** Sections to KEEP — these are the valuable decision frameworks */
const KEEP_HEADERS = [
	"Architecture Decisions",
	"Architecture Principles",
	"Planning Process",
	"Your Planning Process",
	"Planning Principles",
	"State Strategy",
	"Layout Pattern",
	"Component Hierarchy",
	"Data Flow",
	"Entity Relationship",
	"Auth Architecture",
	"Responsive Strategy",
	"Requirement Extraction",
	"Data Model Design",
	"Auth Decision",
	"Component Decomposition",
	"File Map",
	"Feature-to-File",
	"UX Flow",
];

/** Per-agent character budget for condensed frameworks */
const AGENT_CHAR_BUDGET = 3500;

/**
 * Extract key decision frameworks from an agent's system prompt.
 * Keeps sections that contain architecture decisions, planning processes,
 * and design principles. Skips platform constraints (developer already has them).
 */
function extractKeyFrameworks(agent: AgentDefinition): string {
	const prompt = agent.systemPrompt;

	// Split by ## headers (keep the ## prefix with each section)
	const sections = prompt.split(/(?=^## )/m);
	const kept: string[] = [];
	let totalChars = 0;

	for (const section of sections) {
		const headerMatch = section.match(/^## (.+)/);
		if (!headerMatch) continue;
		const header = headerMatch[1];

		// Skip sections the developer already has
		if (SKIP_HEADERS.some((skip) => header.includes(skip))) continue;

		// Only keep sections with valuable frameworks
		if (!KEEP_HEADERS.some((keep) => header.includes(keep))) continue;

		const trimmed = section.trim();
		if (totalChars + trimmed.length > AGENT_CHAR_BUDGET) {
			// Add truncated version if we still have budget
			const remaining = AGENT_CHAR_BUDGET - totalChars;
			if (remaining > 200) {
				kept.push(`${trimmed.slice(0, remaining)}\n... (condensed)`);
			}
			break;
		}
		kept.push(trimmed);
		totalChars += trimmed.length;
	}

	return kept.join("\n\n");
}

/**
 * Condense upstream read-only agents' system prompts into a focused
 * "thinking framework" that gets injected into the developer's prompt.
 *
 * This implements Agent Chaining without sequential LLM calls:
 * - Architect's decision frameworks → developer thinks through architecture
 * - Planner's planning process → developer follows structured planning
 * - All within a single streaming call
 */
export function condenseUpstreamAgents(
	upstreamAgents: AgentDefinition[],
): string {
	if (upstreamAgents.length === 0) return "";

	const sections: string[] = [];
	sections.push(`# Pipeline Analysis Frameworks

Before writing any code, apply these frameworks from the pipeline's upstream specialists.
Think through each decision systematically — architecture first, then planning, then implementation.`);

	for (const agent of upstreamAgents) {
		const condensed = extractKeyFrameworks(agent);
		if (condensed) {
			sections.push(
				`## From ${agent.name}\n\nApply these frameworks to the user's request:\n\n${condensed}`,
			);
		}
	}

	return sections.join("\n\n");
}
