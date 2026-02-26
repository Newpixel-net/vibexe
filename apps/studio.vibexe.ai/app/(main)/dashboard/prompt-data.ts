/**
 * Dashboard Hero Prompt Data
 *
 * Project types and typewriter placeholder prompts for the hero prompt input.
 * Reduced to 3 main types matching Emergent-style UX.
 */

export interface ProjectType {
	id: string;
	label: string;
	icon: string; // lucide icon name
	placeholders: string[];
}

/** Visible tabs on the dashboard hero */
export const PROJECT_TYPES: ProjectType[] = [
	{
		id: "app",
		label: "Full Stack App",
		icon: "Layers",
		placeholders: [
			"Build me a CRM system with lead tracking and team dashboards...",
			"Build me a SaaS app with user auth, billing, and analytics...",
			"Build me a project management tool with Kanban boards...",
			"Build me an inventory system with barcode scanning and alerts...",
			"Build me a booking platform with calendar and payments...",
		],
	},
	{
		id: "mobile",
		label: "Mobile App",
		icon: "Smartphone",
		placeholders: [
			"Build me a food delivery app with real-time order tracking...",
			"Build me a fitness tracker with workout plans and progress charts...",
			"Build me a recipe app with meal planning and grocery lists...",
			"Build me a habit tracker with streaks and daily reminders...",
			"Build me a social media app with stories and messaging...",
		],
	},
	{
		id: "landing",
		label: "Landing Page",
		icon: "Globe",
		placeholders: [
			"Build me a product showcase with animated hero and pricing table...",
			"Build me a consulting firm landing page with testimonials...",
			"Build me an e-commerce landing page with product gallery...",
			"Build me a course platform landing page with instructor bios...",
			"Build me a startup landing page with waitlist signup...",
		],
	},
];

/** Hidden types — still valid for app creation but not shown as tabs */
export const HIDDEN_TYPES: ProjectType[] = [
	{
		id: "workflow",
		label: "Workflow",
		icon: "GitBranch",
		placeholders: [
			"Analyze customer reviews and extract sentiment scores...",
			"Monitor RSS feeds and summarize new articles daily...",
		],
	},
	{
		id: "api",
		label: "API Backend",
		icon: "Zap",
		placeholders: [
			"A REST API for user management with JWT auth...",
			"A webhook relay service that transforms payloads...",
		],
	},
	{
		id: "dashboard",
		label: "Dashboard",
		icon: "LayoutDashboard",
		placeholders: [
			"An analytics dashboard with charts and KPI cards...",
			"A real-time monitoring panel for server metrics...",
		],
	},
];

/** All types combined (for lookup by ID) */
export const ALL_TYPES: ProjectType[] = [...PROJECT_TYPES, ...HIDDEN_TYPES];

export function getPlaceholdersForType(typeId: string): string[] {
	const type = ALL_TYPES.find((t) => t.id === typeId);
	return type?.placeholders ?? PROJECT_TYPES[0].placeholders;
}

/** Recent project suggestions per tab type */
export const RECENT_PROJECT_SUGGESTIONS: Record<string, string[]> = {
	app: ["Task Manager", "CRM Dashboard", "E-Commerce Store", "Chat App"],
	mobile: ["Flappy Bird", "Recipe Generator", "Habit Tracker", "Fitness App"],
	landing: ["Consult Plus", "Elite Footwear", "Smart Course", "SaaS Launch"],
};
