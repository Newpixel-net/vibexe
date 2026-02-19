import type { AgentDefinition, SkillDefinition } from "../types";

/**
 * Complexity-specific project templates injected into developer agent prompts.
 * These guide the AI to generate the right number of files based on intent classification.
 */
const COMPLEXITY_TEMPLATES: Record<string, string> = {
	simple: `## Scope: Simple (3-4 files)
Create: src/App.tsx + 1-2 helper files. Start with App.tsx immediately.`,

	medium: `## Scope: Medium (6-10 files)
Create: src/App.tsx, src/components/*.tsx (3-5 components), src/hooks/*.ts, src/types/index.ts.
One component per file. Start with App.tsx immediately.`,

	complex: `## Scope: Complex (10-15+ files)
Create: src/App.tsx, src/components/layout/*.tsx, src/components/features/*.tsx, src/pages/*.tsx, src/hooks/*.ts, src/context/*.tsx, src/types/index.ts, src/utils/*.ts.
Every feature gets its own component file. Start with App.tsx immediately.`,
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

	// Reference active skills (no full content — keep prompt compact)
	if (skills.length > 0) {
		sections.push(`Active skills: ${skills.map((s) => s.name).join(", ")}`);
	}

	// Project context
	if (projectContext) {
		sections.push(`# Project Context\n\n${projectContext}`);
	}

	return sections.join("\n\n");
}
