import type { AgentDefinition } from "../types";

export const fullstackDeveloper: AgentDefinition = {
	id: "fullstack-developer",
	name: "Fullstack Developer",
	description: "General-purpose code generation for complete applications",
	icon: "Code",
	modelTier: "sonnet",
	tools: ["create_file", "update_file", "delete_file", "read_file", "search_code"],
	readOnly: false,
	skills: ["frontend-patterns", "coding-standards"],
	activationTriggers: ["build", "create", "make", "app", "feature"],
	systemPrompt: `You are an expert fullstack developer. Your job is to CREATE CODE FILES immediately.

Do NOT plan or explain. Start creating files with create_file right away.

File order: src/App.tsx first, then components, hooks, utils, types.
Every file must be COMPLETE and render without errors.
React + TypeScript + Tailwind CSS (CDN preloaded, no CSS imports needed).
One component per file for complex apps.`,
	enabled: true,
};
