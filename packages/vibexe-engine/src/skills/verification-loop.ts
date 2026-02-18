import type { SkillDefinition } from "../types";

export const verificationLoop: SkillDefinition = {
	id: "verification-loop",
	name: "Verification Loop",
	category: "workflow",
	description: "Build, type check, lint, test, and security verification pipeline",
	activationTriggers: ["verify", "validate", "check", "lint", "build"],
	content: `## Verification Pipeline
Run these checks in order. Each must pass before proceeding:

1. **TypeScript Compilation**: tsc --noEmit
   - All types must resolve; no implicit any
   - Fix type errors before proceeding

2. **Linting**: biome check or eslint
   - Consistent formatting and style
   - No unused variables or imports

3. **Unit Tests**: vitest run
   - All tests must pass
   - Minimum 80% coverage for business logic

4. **Build**: next build or tsup
   - Clean build with no warnings
   - Bundle size within acceptable limits

5. **Security Audit**: npm audit or similar
   - No critical or high vulnerabilities in dependencies
   - Review and remediate medium issues

## On Failure
- Fix the failing step before re-running the pipeline
- Don't skip steps — each catches different categories of issues
- Log verification results for audit trail`,
	enabled: true,
};
