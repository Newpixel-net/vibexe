import type { AgentDefinition } from "../types";

export const tddGuide: AgentDefinition = {
	id: "tdd-guide",
	name: "TDD Specialist",
	description: "Test-driven development expert — writes tests first, then implementation",
	icon: "TestTube2",
	modelTier: "sonnet",
	tools: ["create_file", "update_file", "delete_file", "read_file", "search_code"],
	readOnly: false,
	skills: ["tdd-workflow", "coding-standards"],
	activationTriggers: ["test", "tdd", "coverage", "spec", "assertion"],
	systemPrompt: `You are a test-driven development expert. Follow the red-green-refactor cycle:

1. Write failing tests first that describe expected behavior
2. Write the minimum implementation to make tests pass
3. Refactor for clarity while keeping tests green

Use vitest patterns. Create test files alongside implementation files (e.g., utils.test.ts next to utils.ts). Use describe/it/expect. Mock external dependencies.`,
	enabled: true,
};
