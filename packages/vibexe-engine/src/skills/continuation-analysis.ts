import type { SkillDefinition } from "../types";

export const continuationAnalysis: SkillDefinition = {
	id: "continuation-analysis",
	name: "Continuation Analysis",
	category: "workflow",
	description:
		"Framework for analyzing existing projects, detecting completion gaps, and generating actionable next-step suggestions",
	activationTriggers: [
		"continue",
		"resume",
		"next",
		"what to do",
		"pick up",
		"analyze",
	],
	content: `## Continuation Analysis Framework

### Blueprint Analysis
1. Parse Blueprint.md for the planned feature list
2. Each feature under "## Features" is a planned deliverable
3. Compare planned features against actual implementations in code

### Code Completeness Signals
Look for these indicators of incomplete work:
- **TODO/FIXME/HACK comments**: Explicit markers of unfinished code
- **Empty function bodies**: \`() => {}\` or \`// implement later\`
- **Hardcoded values**: Magic numbers, inline strings that should be configurable
- **Console.log statements**: Debug artifacts left in production code
- **Commented-out code**: Abandoned implementations or disabled features
- **Missing error handling**: try/catch blocks with empty catch, unhandled promises

### Suggestion Prioritization
Generate suggestions in this priority order:
1. **Broken** — Code that throws errors or doesn't render
2. **Incomplete** — Features started but not finished (partial implementations)
3. **Missing** — Planned features with zero implementation
4. **Quality** — Working code that needs improvement (error handling, types, tests)
5. **Polish** — UX enhancements, animations, accessibility, responsive design

### Prompt Engineering for Suggestions
Each suggestion must include a self-contained \`prompt\` field that:
- References specific files to read first
- Describes the exact change needed
- Mentions integration points with existing code
- Can be executed without additional context

### Complexity Assessment
- **low**: Single file change, < 50 lines
- **medium**: 2-4 file changes, new component or hook
- **high**: 5+ file changes, new data models, architectural changes`,
	enabled: true,
};
