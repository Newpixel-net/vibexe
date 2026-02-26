/**
 * Dashboard Hero Prompt Data
 *
 * Project types (mods), categories, typewriter placeholders,
 * and suggestion pills for the hero prompt input on the dashboard.
 */

export interface Suggestion {
	label: string;
	prompt: string;
}

export interface ProjectType {
	id: string;
	label: string;
	icon: string; // lucide icon name
	placeholders: string[];
	suggestions: Suggestion[];
}

export interface CategoryTag {
	id: string;
	label: string;
	forTypes: string[]; // which project types this category applies to
}

/** Visible tabs (mods) on the dashboard hero */
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
		suggestions: [
			{ label: "Task Manager", prompt: "Build me a task management app with projects, due dates, priorities, and team collaboration" },
			{ label: "CRM System", prompt: "Build me a CRM with contact management, deal pipelines, activity tracking, and email integration" },
			{ label: "Inventory Tracker", prompt: "Build me an inventory management system with stock levels, barcode scanning, and low-stock alerts" },
			{ label: "Booking Platform", prompt: "Build me a booking and scheduling platform with calendar view, availability slots, and payment processing" },
			{ label: "SaaS Dashboard", prompt: "Build me a SaaS analytics dashboard with user management, subscription tiers, and usage metrics" },
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
		suggestions: [
			{ label: "Fitness Tracker", prompt: "Build me a fitness tracker app with workout plans, progress charts, and daily step counting" },
			{ label: "Habit Tracker", prompt: "Build me a habit tracker with daily streaks, reminders, and weekly progress analytics" },
			{ label: "Recipe App", prompt: "Build me a recipe app with meal planning, grocery lists, and nutritional information" },
			{ label: "Expense Tracker", prompt: "Build me a personal expense tracker with categories, budgets, and monthly reports" },
			{ label: "Social Feed", prompt: "Build me a social media app with photo sharing, stories, likes, and direct messaging" },
		],
	},
	{
		id: "website",
		label: "Website",
		icon: "Monitor",
		placeholders: [
			"Build me a portfolio website with project gallery and contact form...",
			"Build me a restaurant website with menu, reservations, and reviews...",
			"Build me a blog platform with rich text editor and categories...",
			"Build me an e-commerce store with product catalog and checkout...",
			"Build me a real estate website with property listings and search filters...",
		],
		suggestions: [
			{ label: "Portfolio Site", prompt: "Build me a professional portfolio website with project showcase, about section, and contact form" },
			{ label: "Restaurant Site", prompt: "Build me a restaurant website with interactive menu, reservation system, and photo gallery" },
			{ label: "Blog Platform", prompt: "Build me a blog website with rich text editor, categories, tags, and comment system" },
			{ label: "E-Commerce Store", prompt: "Build me an online store with product catalog, shopping cart, checkout, and order tracking" },
			{ label: "Real Estate Site", prompt: "Build me a real estate website with property listings, search filters, and agent profiles" },
		],
	},
	{
		id: "landing",
		label: "Landing Page",
		icon: "PanelTop",
		placeholders: [
			"Build me a product showcase with animated hero and pricing table...",
			"Build me a consulting firm landing page with testimonials...",
			"Build me an e-commerce landing page with product gallery...",
			"Build me a course platform landing page with instructor bios...",
			"Build me a startup landing page with waitlist signup...",
		],
		suggestions: [
			{ label: "SaaS Launch", prompt: "Build me a SaaS product landing page with feature highlights, pricing table, testimonials, and signup CTA" },
			{ label: "Course Platform", prompt: "Build me an online course landing page with curriculum preview, instructor bios, and enrollment form" },
			{ label: "App Download", prompt: "Build me a mobile app landing page with phone mockups, feature sections, and download buttons" },
			{ label: "Event Page", prompt: "Build me an event landing page with speaker lineup, schedule, ticket pricing, and countdown timer" },
			{ label: "Startup Waitlist", prompt: "Build me a startup launch page with animated hero, value proposition, and email waitlist signup" },
		],
	},
	{
		id: "funnel",
		label: "Marketing Funnel",
		icon: "Filter",
		placeholders: [
			"Build me a lead generation funnel with opt-in form and thank you page...",
			"Build me a product launch funnel with countdown and checkout...",
			"Build me a webinar registration funnel with reminders and replay...",
			"Build me a free trial funnel with onboarding steps and upsell...",
			"Build me a quiz funnel that segments leads and recommends products...",
		],
		suggestions: [
			{ label: "Lead Gen Funnel", prompt: "Build me a lead generation funnel with squeeze page, opt-in form, thank you page, and email sequence" },
			{ label: "Product Launch", prompt: "Build me a product launch funnel with teaser page, countdown timer, sales page, and checkout" },
			{ label: "Webinar Funnel", prompt: "Build me a webinar registration funnel with signup page, reminder emails, live room, and replay page" },
			{ label: "Quiz Funnel", prompt: "Build me an interactive quiz funnel that segments leads and recommends products based on answers" },
			{ label: "Free Trial Funnel", prompt: "Build me a SaaS free trial funnel with feature highlights, signup flow, onboarding steps, and upgrade offer" },
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
		suggestions: [],
	},
	{
		id: "api",
		label: "API Backend",
		icon: "Zap",
		placeholders: [
			"A REST API for user management with JWT auth...",
			"A webhook relay service that transforms payloads...",
		],
		suggestions: [],
	},
	{
		id: "dashboard",
		label: "Dashboard",
		icon: "LayoutDashboard",
		placeholders: [
			"An analytics dashboard with charts and KPI cards...",
			"A real-time monitoring panel for server metrics...",
		],
		suggestions: [],
	},
];

/** All types combined (for lookup by ID) */
export const ALL_TYPES: ProjectType[] = [...PROJECT_TYPES, ...HIDDEN_TYPES];

export const CATEGORY_TAGS: CategoryTag[] = [
	{ id: "saas", label: "SaaS", forTypes: ["app", "landing"] },
	{ id: "ecommerce", label: "E-Commerce", forTypes: ["app", "website", "landing"] },
	{ id: "productivity", label: "Productivity", forTypes: ["app", "dashboard"] },
	{ id: "social", label: "Social", forTypes: ["app", "mobile"] },
	{ id: "ai-ml", label: "AI / ML", forTypes: ["app", "workflow", "api"] },
	{ id: "automation", label: "Automation", forTypes: ["workflow", "api", "funnel"] },
	{ id: "analytics", label: "Analytics", forTypes: ["dashboard", "workflow"] },
	{ id: "marketing", label: "Marketing", forTypes: ["landing", "funnel", "workflow"] },
	{ id: "education", label: "Education", forTypes: ["app", "website", "landing"] },
	{ id: "healthcare", label: "Healthcare", forTypes: ["app", "website", "dashboard"] },
	{ id: "fintech", label: "Fintech", forTypes: ["app", "dashboard", "api"] },
	{ id: "content", label: "Content", forTypes: ["app", "website", "workflow", "landing"] },
];

export function getPlaceholdersForType(typeId: string): string[] {
	const type = ALL_TYPES.find((t) => t.id === typeId);
	return type?.placeholders ?? PROJECT_TYPES[0].placeholders;
}

export function getSuggestionsForType(typeId: string): Suggestion[] {
	const type = ALL_TYPES.find((t) => t.id === typeId);
	return type?.suggestions ?? PROJECT_TYPES[0].suggestions;
}

export function getCategoriesForType(typeId: string): CategoryTag[] {
	return CATEGORY_TAGS.filter((c) => c.forTypes.includes(typeId));
}
