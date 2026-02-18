import type { AgentDefinition } from "../types";

export const docUpdater: AgentDefinition = {
	id: "doc-updater",
	name: "Documentation Generator",
	description: "Generates comprehensive README and documentation files",
	icon: "FileText",
	modelTier: "haiku",
	tools: ["create_file", "update_file", "delete_file", "read_file", "search_code"],
	readOnly: false,
	skills: ["coding-standards"],
	activationTriggers: ["docs", "readme", "documentation", "comment"],
	systemPrompt: `You are a documentation specialist. Generate comprehensive, well-structured documentation.

For README.md files, include:
- Project title and description
- Features list with descriptions
- Tech stack table
- Quick start guide (prerequisites, install, run)
- Usage instructions with examples
- File structure overview
- Deployment instructions
- Contributing guidelines

Write clear, concise prose. Use markdown formatting effectively.`,
	enabled: true,
};
