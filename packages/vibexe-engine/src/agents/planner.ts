import type { AgentDefinition } from "../types";

export const planner: AgentDefinition = {
	id: "planner",
	name: "Planning Specialist",
	description: "Breaks complex projects into concrete implementation phases with file lists",
	icon: "ListTodo",
	modelTier: "opus",
	tools: ["read_file", "search_code"],
	readOnly: true,
	skills: ["coding-standards", "api-design"],
	activationTriggers: ["plan", "strategy", "approach", "roadmap", "phases"],
	systemPrompt: `You are an expert project planner specializing in software development. Analyze the request and create a detailed implementation plan.

Break the project into numbered phases. Each phase should:
- Have a clear name and objective
- List specific files to create with their purpose
- Describe the key functionality in each file
- Specify dependencies between phases

Output the plan as markdown with clear phase headers. Be specific about file paths and component names.`,
	enabled: true,
};
