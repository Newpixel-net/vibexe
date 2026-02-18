import type { AgentDefinition, SkillDefinition } from "../types";
import { getAllRules } from "../registry/rule-registry";

/**
 * Complexity-specific project templates injected into developer agent prompts.
 * These guide the AI to generate the right number of files based on intent classification.
 */
const COMPLEXITY_TEMPLATES: Record<string, string> = {
	simple: `## Project Scope: Simple
Generate a minimal project with 3 files:
- Blueprint.md — Brief architecture overview
- src/App.tsx — Single complete React component
- README.md — Short documentation`,

	medium: `## Project Scope: Medium
Generate a structured project with 6-10 files:
- Blueprint.md — Architecture with component tree and data flow
- src/App.tsx — Main component with routing/layout
- src/components/Header.tsx — Header/navigation
- src/components/[Feature].tsx — One or more feature components
- src/hooks/use[Feature].ts — Custom hooks for reusable logic
- src/utils/helpers.ts — Utility functions
- src/types/index.ts — Shared type definitions
- README.md — Comprehensive documentation

Use proper component separation — one component per file.`,

	complex: `## Project Scope: Complex
Generate a full application with 12+ files:
- Blueprint.md — Full architecture document with tech stack rationale
- src/App.tsx — Root component with providers and routing
- src/components/layout/Header.tsx — Header with navigation
- src/components/layout/Sidebar.tsx — Sidebar navigation (if applicable)
- src/components/[Feature]/index.tsx — Feature-specific components
- src/components/[Feature]/[SubComponent].tsx — Sub-components
- src/pages/[Page].tsx — Page-level components
- src/hooks/use[Feature].ts — Feature-specific hooks
- src/context/[Context].tsx — Context providers for global state
- src/utils/api.ts — API helper utilities
- src/utils/helpers.ts — General utility functions
- src/types/index.ts — Complete type definitions
- README.md — Full documentation with setup instructions

Use a well-organized directory structure. Every component gets its own file.`,
};

export function assemblePrompt(
	agent: AgentDefinition,
	skills: SkillDefinition[],
	projectContext?: string,
	_userRequest?: string,
	complexity?: string,
): string {
	const sections: string[] = [];

	// Agent identity and instructions
	sections.push(`# Role: ${agent.name}\n\n${agent.systemPrompt}`);

	// Inject complexity-specific template for developer agents
	if (!agent.readOnly && complexity) {
		const template = COMPLEXITY_TEMPLATES[complexity];
		if (template) {
			sections.push(template);
		}
	}

	// Inject skills
	if (skills.length > 0) {
		sections.push("# Active Skills\n");
		for (const skill of skills) {
			sections.push(`## ${skill.name}\n\n${skill.content}`);
		}
	}

	// Inject enabled rules
	const rules = getAllRules().filter((r) => r.enabled);
	if (rules.length > 0) {
		sections.push("# Active Rules\n");
		for (const rule of rules) {
			sections.push(
				`- **${rule.name}**: ${rule.value} — ${rule.description}`,
			);
		}
	}

	// Project context
	if (projectContext) {
		sections.push(`# Project Context\n\n${projectContext}`);
	}

	return sections.join("\n\n");
}
