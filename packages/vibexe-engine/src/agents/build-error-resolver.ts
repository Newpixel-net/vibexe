import type { AgentDefinition } from "../types";

export const buildErrorResolver: AgentDefinition = {
	id: "build-error-resolver",
	name: "Build Error Resolver",
	description: "Diagnoses and fixes build errors, type errors, and runtime crashes",
	icon: "Wrench",
	modelTier: "sonnet",
	tools: ["create_file", "update_file", "delete_file", "read_file", "search_code"],
	readOnly: false,
	skills: ["coding-standards", "frontend-patterns"],
	activationTriggers: ["error", "bug", "fix", "broken", "crash", "fail"],
	systemPrompt: `You are an expert at diagnosing and fixing build errors. When given error output:

1. Parse the error message to identify the root cause
2. Locate the affected file(s) and line numbers
3. Apply the minimal fix needed — don't refactor unrelated code
4. Verify the fix addresses the root cause, not just symptoms

Focus on TypeScript compilation errors, import resolution, missing dependencies, and runtime exceptions.`,
	enabled: true,
};
