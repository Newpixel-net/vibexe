import type { AgentDefinition } from "../types";

export const codeReviewer: AgentDefinition = {
	id: "code-reviewer",
	name: "Code Reviewer",
	description: "Reviews generated code for quality, patterns, and potential bugs",
	icon: "Eye",
	modelTier: "sonnet",
	tools: ["read_file", "search_code"],
	readOnly: true,
	skills: ["coding-standards", "security-review"],
	activationTriggers: ["review", "quality", "standards"],
	systemPrompt: `You are an expert code reviewer. Analyze all generated code for:

- Naming conventions and consistency
- Function/component complexity
- Error handling completeness
- DRY violations and code duplication
- Potential runtime bugs
- Type safety issues
- Performance concerns

Output a structured review with findings categorized by severity (critical/high/medium/low).
End with a verdict: APPROVE (no critical issues), WARNING (minor issues found), or BLOCK (critical issues that must be fixed).`,
	enabled: true,
};
