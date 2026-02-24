export type SlashCommandCategory = "platform" | "agents" | "tasks";
export type SlashCommandType = "prompt" | "agent";

export interface SlashCommand {
	id: string;
	command: string;
	label: string;
	description: string;
	category: SlashCommandCategory;
	icon: string;
	insertText: string;
	keywords: string[];
	/** "agent" commands activate the agent directly; "prompt" commands insert text */
	type: SlashCommandType;
	/** Engine agent ID — only for type="agent" commands */
	agentId?: string;
}

export const SLASH_COMMAND_CATEGORIES: Record<
	SlashCommandCategory,
	string
> = {
	platform: "Platform Actions",
	agents: "Agent Shortcuts",
	tasks: "Common Tasks",
};

export const SLASH_COMMANDS: SlashCommand[] = [
	// ── Platform Actions ──
	{
		id: "review",
		command: "/review",
		label: "Review Code",
		description: "Run code quality & security review",
		category: "platform",
		icon: "ShieldCheck",
		insertText: "Review the current code for quality, security issues, and best practices. Provide a detailed report.",
		keywords: ["audit", "quality", "security", "lint"],
		type: "prompt",
	},
	{
		id: "fix",
		command: "/fix",
		label: "Fix Issues",
		description: "Auto-fix problems from last review",
		category: "platform",
		icon: "Wrench",
		insertText: "Fix all issues found in the last code review. Apply best practices and resolve warnings.",
		keywords: ["repair", "resolve", "bugs", "errors"],
		type: "prompt",
	},
	{
		id: "deploy",
		command: "/deploy",
		label: "Deploy App",
		description: "Build and deploy to production",
		category: "platform",
		icon: "Rocket",
		insertText: "Deploy this app to production. Build, bundle, and publish the latest version.",
		keywords: ["publish", "ship", "release", "launch"],
		type: "prompt",
	},
	{
		id: "backup",
		command: "/backup",
		label: "Create Backup",
		description: "Snapshot the database now",
		category: "platform",
		icon: "DatabaseBackup",
		insertText: "Create a backup of the current database. Use the manage_backups tool to snapshot all data.",
		keywords: ["snapshot", "save", "database", "restore"],
		type: "prompt",
	},
	{
		id: "env",
		command: "/env",
		label: "Manage Environments",
		description: "Create or switch staging/prod envs",
		category: "platform",
		icon: "GitBranch",
		insertText: "Manage app environments. Use manage_environments to list, create, or promote environments.",
		keywords: ["staging", "production", "environment", "promote"],
		type: "prompt",
	},
	{
		id: "export",
		command: "/export",
		label: "Export Project",
		description: "Download as standalone ZIP",
		category: "platform",
		icon: "Download",
		insertText: "Export this project as a standalone downloadable package with all files and configuration.",
		keywords: ["download", "zip", "package", "standalone"],
		type: "prompt",
	},
	// ── Agent Shortcuts ──
	{
		id: "plan",
		command: "/plan",
		label: "Plan Feature",
		description: "Create a blueprint before coding",
		category: "agents",
		icon: "Map",
		insertText: "Plan the implementation for this feature. Create a detailed blueprint document before writing any code.",
		keywords: ["blueprint", "design", "architecture", "strategy"],
		type: "agent",
		agentId: "planner",
	},
	{
		id: "architect",
		command: "/architect",
		label: "System Architect",
		description: "Design data models & system structure",
		category: "agents",
		icon: "Blocks",
		insertText: "Design the system architecture including data models, entity relationships, and component structure.",
		keywords: ["schema", "entities", "models", "structure", "database"],
		type: "agent",
		agentId: "architect",
	},
	{
		id: "frontend",
		command: "/frontend",
		label: "Frontend Developer",
		description: "Build UI components & pages",
		category: "agents",
		icon: "Layout",
		insertText: "Build the frontend UI. Create React components, pages, and styling using Tailwind CSS.",
		keywords: ["ui", "components", "react", "pages", "css"],
		type: "agent",
		agentId: "frontend-developer",
	},
	{
		id: "backend",
		command: "/backend",
		label: "Backend Developer",
		description: "API routes, functions & data logic",
		category: "agents",
		icon: "Server",
		insertText: "Build the backend logic. Create API handlers, server functions, and data processing using the SDK.",
		keywords: ["api", "server", "functions", "data", "sdk"],
		type: "agent",
		agentId: "backend-developer",
	},
	{
		id: "security",
		command: "/security",
		label: "Security Audit",
		description: "Check auth, XSS, injection risks",
		category: "agents",
		icon: "Lock",
		insertText: "Perform a security audit. Check for XSS, injection, auth bypass, and other vulnerabilities.",
		keywords: ["xss", "injection", "auth", "vulnerabilities", "owasp"],
		type: "agent",
		agentId: "security-reviewer",
	},
	{
		id: "test",
		command: "/test",
		label: "Write Tests",
		description: "Generate test cases for components",
		category: "agents",
		icon: "TestTube",
		insertText: "Write comprehensive test cases for the current components. Cover edge cases and error states.",
		keywords: ["testing", "jest", "unit", "e2e", "coverage"],
		type: "agent",
		agentId: "e2e-runner",
	},
	{
		id: "refactor",
		command: "/refactor",
		label: "Refactor Code",
		description: "Improve structure without changing behavior",
		category: "agents",
		icon: "RefreshCw",
		insertText: "Refactor the current code to improve readability, reduce duplication, and follow best practices without changing behavior.",
		keywords: ["cleanup", "improve", "optimize", "restructure"],
		type: "agent",
		agentId: "refactor-cleaner",
	},
	{
		id: "docs",
		command: "/docs",
		label: "Write Documentation",
		description: "Generate README & API docs",
		category: "agents",
		icon: "FileText",
		insertText: "Write documentation for this project including README, API reference, and usage examples.",
		keywords: ["readme", "documentation", "api", "guide"],
		type: "agent",
		agentId: "doc-updater",
	},
	{
		id: "replicate",
		command: "/replicate",
		label: "Replicate from URL",
		description: "Clone a design from a screenshot/URL",
		category: "agents",
		icon: "Copy",
		insertText: "Replicate this design. Analyze the reference and recreate it with clean, responsive code.",
		keywords: ["clone", "copy", "screenshot", "design", "url"],
		type: "agent",
		agentId: "fullstack-developer",
	},
	// ── Common Tasks ──
	{
		id: "todo",
		command: "/todo",
		label: "Add Todo Feature",
		description: "Task list with CRUD operations",
		category: "tasks",
		icon: "ListTodo",
		insertText: "Add a todo/task list feature with create, read, update, delete, and completion toggle.",
		keywords: ["tasks", "checklist", "list", "crud"],
		type: "prompt",
	},
	{
		id: "polish",
		command: "/polish",
		label: "Polish UI",
		description: "Refine spacing, typography, animations",
		category: "tasks",
		icon: "Sparkles",
		insertText: "Polish the UI. Improve spacing, typography, hover states, transitions, and overall visual refinement.",
		keywords: ["ui", "design", "spacing", "typography", "animations"],
		type: "prompt",
	},
	{
		id: "responsive",
		command: "/responsive",
		label: "Make Responsive",
		description: "Add mobile & tablet breakpoints",
		category: "tasks",
		icon: "Smartphone",
		insertText: "Make the app fully responsive. Add mobile and tablet breakpoints with proper layouts for all screen sizes.",
		keywords: ["mobile", "tablet", "breakpoints", "adaptive"],
		type: "prompt",
	},
	{
		id: "darkmode",
		command: "/darkmode",
		label: "Add Dark Mode",
		description: "Toggle between light & dark themes",
		category: "tasks",
		icon: "Moon",
		insertText: "Add dark mode support with a theme toggle. Implement light/dark color schemes across all components.",
		keywords: ["theme", "light", "dark", "toggle", "colors"],
		type: "prompt",
	},
	{
		id: "auth",
		command: "/auth",
		label: "Add Authentication",
		description: "Login, signup & protected routes",
		category: "tasks",
		icon: "KeyRound",
		insertText: "Add authentication with login, signup, and protected routes. Use the SDK auth methods.",
		keywords: ["login", "signup", "password", "protected", "session"],
		type: "prompt",
	},
	{
		id: "crud",
		command: "/crud",
		label: "CRUD Interface",
		description: "Full create/read/update/delete UI",
		category: "tasks",
		icon: "Database",
		insertText: "Build a complete CRUD interface with list view, create form, edit form, and delete confirmation.",
		keywords: ["create", "read", "update", "delete", "table", "form"],
		type: "prompt",
	},
	{
		id: "animate",
		command: "/animate",
		label: "Add Animations",
		description: "Smooth transitions & micro-interactions",
		category: "tasks",
		icon: "Zap",
		insertText: "Add smooth animations and micro-interactions. Include page transitions, hover effects, and loading states.",
		keywords: ["motion", "transitions", "effects", "framer"],
		type: "prompt",
	},
	{
		id: "a11y",
		command: "/a11y",
		label: "Accessibility Audit",
		description: "ARIA labels, keyboard nav, contrast",
		category: "tasks",
		icon: "Accessibility",
		insertText: "Audit and fix accessibility. Add proper ARIA labels, keyboard navigation, focus management, and color contrast.",
		keywords: ["accessibility", "aria", "keyboard", "wcag", "screen reader"],
		type: "prompt",
	},
];

export function filterCommands(query: string): SlashCommand[] {
	if (!query) return SLASH_COMMANDS;
	const q = query.toLowerCase();
	return SLASH_COMMANDS.filter(
		(cmd) =>
			cmd.command.toLowerCase().includes(q) ||
			cmd.label.toLowerCase().includes(q) ||
			cmd.keywords.some((kw) => kw.includes(q)),
	);
}

/** Agent metadata for activation cards */
export const AGENT_INFO: Record<string, { name: string; modelTier: string; description: string }> = {
	planner: { name: "Planner", modelTier: "sonnet", description: "Creates implementation blueprints before coding begins" },
	architect: { name: "System Architect", modelTier: "sonnet", description: "Designs data models, entity schemas, and system structure" },
	"frontend-developer": { name: "Frontend Developer", modelTier: "sonnet", description: "Builds React components, pages, and responsive UI with Tailwind" },
	"backend-developer": { name: "Backend Developer", modelTier: "sonnet", description: "API routes, server functions, SDK data operations, and auth" },
	"fullstack-developer": { name: "Fullstack Developer", modelTier: "sonnet", description: "End-to-end features spanning frontend and backend" },
	"code-reviewer": { name: "Code Reviewer", modelTier: "sonnet", description: "Quality audit, security check, and best practice enforcement" },
	"security-reviewer": { name: "Security Auditor", modelTier: "sonnet", description: "OWASP top 10, XSS, injection, auth bypass detection" },
	"build-error-resolver": { name: "Build Error Resolver", modelTier: "sonnet", description: "Diagnoses and fixes build, runtime, and type errors" },
	"tdd-guide": { name: "TDD Guide", modelTier: "sonnet", description: "Test-driven development with write-test-first workflow" },
	"ui-designer": { name: "UI/UX Designer", modelTier: "sonnet", description: "Visual polish, spacing, typography, and micro-interactions" },
	"doc-updater": { name: "Documentation Writer", modelTier: "sonnet", description: "README, API docs, inline comments, and usage guides" },
	"refactor-cleaner": { name: "Refactor Cleaner", modelTier: "sonnet", description: "Improve structure without changing behavior" },
	"e2e-runner": { name: "E2E Test Runner", modelTier: "sonnet", description: "Generates comprehensive test suites and edge case coverage" },
};

export function groupByCategory(
	commands: SlashCommand[],
): Map<SlashCommandCategory, SlashCommand[]> {
	const groups = new Map<SlashCommandCategory, SlashCommand[]>();
	for (const cmd of commands) {
		const list = groups.get(cmd.category) ?? [];
		list.push(cmd);
		groups.set(cmd.category, list);
	}
	return groups;
}
