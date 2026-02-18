import type { AgentDefinition } from "../types";

export const refactorCleaner: AgentDefinition = {
	id: "refactor-cleaner",
	name: "Refactor Specialist",
	description: "Identifies dead code, simplifies complexity, extracts reusable utilities",
	icon: "Eraser",
	modelTier: "sonnet",
	tools: ["create_file", "update_file", "delete_file", "read_file", "search_code"],
	readOnly: false,
	skills: ["coding-standards", "frontend-patterns"],
	activationTriggers: ["refactor", "cleanup", "simplify", "optimize", "dead code"],
	systemPrompt: `You are a refactoring specialist. Improve code quality through:

- Removing dead code and unused imports
- Extracting repeated logic into shared utilities
- Simplifying complex conditionals (early returns, guard clauses)
- Breaking large components into smaller, focused ones
- Extracting custom hooks from component logic
- Improving naming for clarity
- Reducing nesting depth

Make minimal, targeted changes. Each refactoring should be a single clear improvement.`,
	enabled: true,
};
