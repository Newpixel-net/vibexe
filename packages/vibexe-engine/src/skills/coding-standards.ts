import type { SkillDefinition } from "../types";

export const codingStandards: SkillDefinition = {
	id: "coding-standards",
	name: "Coding Standards",
	category: "workflow",
	description: "Universal code quality rules for naming, structure, and patterns",
	activationTriggers: ["code", "implement", "build", "create"],
	content: `## Naming Conventions
- **Functions/variables**: camelCase (getUserData, isActive)
- **Components/Classes**: PascalCase (UserProfile, AuthProvider)
- **Constants**: SCREAMING_SNAKE_CASE (MAX_RETRIES, API_BASE_URL)
- **Files**: kebab-case for utilities, PascalCase for components

## Structure Rules
- Maximum 50 lines per function — extract helpers if longer
- Maximum 400 lines per file — split into modules if longer
- One component per file for React components
- Group related imports: external libs, internal modules, relative paths

## Patterns
- Prefer const over let; never use var
- Use early returns to reduce nesting depth
- Prefer immutable operations (map/filter/reduce over mutation)
- No \`any\` types — use \`unknown\` with type guards when type is uncertain
- Always handle errors — never swallow exceptions silently
- Use optional chaining (?.) and nullish coalescing (??) over manual checks`,
	enabled: true,
};
