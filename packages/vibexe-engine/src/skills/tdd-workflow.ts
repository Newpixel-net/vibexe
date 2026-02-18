import type { SkillDefinition } from "../types";

export const tddWorkflow: SkillDefinition = {
	id: "tdd-workflow",
	name: "TDD Workflow",
	category: "workflow",
	description: "Test-driven development patterns and testing best practices",
	activationTriggers: ["test", "tdd", "spec", "coverage", "vitest", "jest"],
	content: `## Red-Green-Refactor Cycle
1. **Red**: Write a failing test that describes expected behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up while keeping tests green

## Test Structure (AAA Pattern)
- **Arrange**: Set up test data and preconditions
- **Act**: Execute the code under test
- **Assert**: Verify the expected outcome

## Testing Patterns
- Name test files: \`*.test.ts\` or \`*.spec.ts\` alongside implementation
- Use \`describe\` blocks to group related tests
- Use \`it\` or \`test\` with descriptive names ("should return empty array when no items match")
- Mock external dependencies (API calls, databases) with vi.mock()
- Test edge cases: empty inputs, null values, boundary conditions, error states

## Coverage Targets
- Aim for 80% line coverage minimum
- Focus on business logic and utility functions
- Don't test framework internals or simple pass-through components`,
	enabled: true,
};
