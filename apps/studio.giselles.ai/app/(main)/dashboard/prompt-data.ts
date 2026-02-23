/**
 * Dashboard Hero Prompt Data
 *
 * Project types, categories, and typewriter placeholder prompts
 * for the hero prompt input on the dashboard.
 */

export interface ProjectType {
	id: string;
	label: string;
	icon: string; // lucide icon name
	placeholders: string[];
}

export interface CategoryTag {
	id: string;
	label: string;
	forTypes: string[]; // which project types this category applies to
}

export const PROJECT_TYPES: ProjectType[] = [
	{
		id: "app",
		label: "Full-Stack App",
		icon: "Layers",
		placeholders: [
			"A task manager with team collaboration and Kanban boards...",
			"An inventory tracking system with barcode scanning...",
			"A booking platform with calendar and payments...",
			"A CRM with lead scoring and email automation...",
		],
	},
	{
		id: "workflow",
		label: "Workflow",
		icon: "GitBranch",
		placeholders: [
			"Analyze customer reviews and extract sentiment scores...",
			"Monitor RSS feeds and summarize new articles daily...",
			"Generate weekly reports from database metrics...",
			"Classify incoming support tickets by priority...",
		],
	},
	{
		id: "landing",
		label: "Landing Page",
		icon: "Globe",
		placeholders: [
			"A SaaS landing page with pricing table and waitlist...",
			"A portfolio site with project gallery and contact form...",
			"A product launch page with countdown timer...",
			"An event registration page with speaker bios...",
		],
	},
	{
		id: "api",
		label: "API Backend",
		icon: "Zap",
		placeholders: [
			"A REST API for user management with JWT auth...",
			"A webhook relay service that transforms payloads...",
			"An API that aggregates data from multiple sources...",
			"A rate-limited API gateway with usage tracking...",
		],
	},
	{
		id: "dashboard",
		label: "Dashboard",
		icon: "LayoutDashboard",
		placeholders: [
			"An analytics dashboard with charts and KPI cards...",
			"A real-time monitoring panel for server metrics...",
			"A sales dashboard with pipeline and revenue graphs...",
			"An admin panel with user management and audit logs...",
		],
	},
];

export const CATEGORY_TAGS: CategoryTag[] = [
	{ id: "saas", label: "SaaS", forTypes: ["app", "landing"] },
	{ id: "ecommerce", label: "E-Commerce", forTypes: ["app", "landing"] },
	{ id: "productivity", label: "Productivity", forTypes: ["app", "dashboard"] },
	{ id: "social", label: "Social", forTypes: ["app"] },
	{ id: "ai-ml", label: "AI / ML", forTypes: ["app", "workflow", "api"] },
	{ id: "automation", label: "Automation", forTypes: ["workflow", "api"] },
	{ id: "analytics", label: "Analytics", forTypes: ["dashboard", "workflow"] },
	{ id: "marketing", label: "Marketing", forTypes: ["landing", "workflow"] },
	{ id: "education", label: "Education", forTypes: ["app", "landing"] },
	{ id: "healthcare", label: "Healthcare", forTypes: ["app", "dashboard"] },
	{ id: "fintech", label: "Fintech", forTypes: ["app", "dashboard", "api"] },
	{ id: "content", label: "Content", forTypes: ["app", "workflow", "landing"] },
];

export function getPlaceholdersForType(typeId: string): string[] {
	const type = PROJECT_TYPES.find((t) => t.id === typeId);
	return type?.placeholders ?? PROJECT_TYPES[0].placeholders;
}

export function getCategoriesForType(typeId: string): CategoryTag[] {
	return CATEGORY_TAGS.filter((c) => c.forTypes.includes(typeId));
}
