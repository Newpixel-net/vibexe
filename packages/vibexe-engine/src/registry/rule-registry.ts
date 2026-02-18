import type { RuleDefinition } from "../types";

const DEFAULT_RULES: RuleDefinition[] = [
	{
		id: "max-function-length",
		name: "Max Function Length",
		description: "Maximum lines per function",
		value: 50,
		type: "number",
		enabled: true,
	},
	{
		id: "max-file-length",
		name: "Max File Length",
		description: "Maximum lines per file",
		value: 400,
		type: "number",
		enabled: true,
	},
	{
		id: "test-coverage",
		name: "Test Coverage Threshold",
		description: "Minimum test coverage percentage",
		value: 80,
		type: "number",
		enabled: false,
	},
	{
		id: "no-any",
		name: "No Any Types",
		description: "Disallow TypeScript any type",
		value: true,
		type: "boolean",
		enabled: true,
	},
	{
		id: "conventional-commits",
		name: "Conventional Commits",
		description: "Enforce conventional commit format",
		value: true,
		type: "boolean",
		enabled: true,
	},
	{
		id: "immutable-default",
		name: "Prefer Immutability",
		description: "Prefer const and readonly",
		value: true,
		type: "boolean",
		enabled: true,
	},
];

let rules: RuleDefinition[] = [...DEFAULT_RULES];

export function getRule(id: string): RuleDefinition | undefined {
	return rules.find((r) => r.id === id);
}

export function getAllRules(): RuleDefinition[] {
	return rules;
}

export function updateRules(newRules: RuleDefinition[]) {
	rules = newRules;
}
