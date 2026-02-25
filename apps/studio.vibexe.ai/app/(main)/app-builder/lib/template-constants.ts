/**
 * Template Constants — Hierarchical Category System
 *
 * Categories are stored in the database as "Main Category > Subcategory"
 * e.g., "Websites > Restaurant & Food"
 *
 * Safe to import from both client and server components.
 */

export interface CategoryGroup {
	label: string;
	gradient: string;
	subcategories: string[];
}

/**
 * The full category tree. Each key is a main category,
 * with an array of subcategories underneath.
 */
export const TEMPLATE_CATEGORY_TREE: Record<string, CategoryGroup> = {
	Websites: {
		label: "Websites",
		gradient: "from-blue-500/10 to-cyan-500/10",
		subcategories: [
			"Business & Corporate",
			"Portfolio & Creative",
			"Blog & Magazine",
			"Restaurant & Food",
			"Real Estate",
			"Travel & Hospitality",
			"Health & Wellness",
			"Education & Courses",
			"Non-Profit & Charity",
			"Agency & Studio",
			"Technology & SaaS",
			"Event & Entertainment",
			"Fashion & Beauty",
			"Legal & Finance",
			"Photography",
			"Wedding",
			"Construction & Architecture",
			"Automotive",
			"Sports & Recreation",
			"Personal & Resume",
		],
	},
	"Web Applications": {
		label: "Web Applications",
		gradient: "from-purple-500/10 to-pink-500/10",
		subcategories: [
			"Project Management",
			"CRM & Sales",
			"Social & Community",
			"Content Management",
			"HR & Team Management",
			"Finance & Accounting",
			"Inventory & Logistics",
			"Booking & Scheduling",
			"Learning Management",
			"Customer Support",
			"Marketplace",
			"SaaS Starter",
			"Health & Fitness Tracker",
			"Productivity Tools",
			"Survey & Forms",
		],
	},
	"Mobile Apps": {
		label: "Mobile Apps",
		gradient: "from-green-500/10 to-emerald-500/10",
		subcategories: [
			"Social & Messaging",
			"Health & Fitness",
			"Food & Delivery",
			"Shopping & Marketplace",
			"Travel & Navigation",
			"Entertainment & Media",
			"Productivity & Tools",
			"Finance & Banking",
			"Education & Learning",
			"Lifestyle & Personal",
		],
	},
	"E-Commerce": {
		label: "E-Commerce",
		gradient: "from-emerald-500/10 to-green-500/10",
		subcategories: [
			"Online Store",
			"Marketplace",
			"Subscription & Membership",
			"Digital Products",
			"Dropshipping",
			"Food & Grocery",
			"Fashion & Apparel",
			"Handmade & Crafts",
		],
	},
	"Marketing & Funnels": {
		label: "Marketing & Funnels",
		gradient: "from-orange-500/10 to-amber-500/10",
		subcategories: [
			"Lead Generation",
			"Sales Funnel",
			"Webinar Funnel",
			"Product Launch",
			"Upsell & Cross-sell",
			"Quiz & Survey Funnel",
			"Landing Page",
			"Newsletter & Email",
			"Affiliate & Referral",
		],
	},
	"Dashboards & Analytics": {
		label: "Dashboards & Analytics",
		gradient: "from-violet-500/10 to-purple-500/10",
		subcategories: [
			"Analytics Dashboard",
			"Admin Panel",
			"Reporting & BI",
			"Monitoring & DevOps",
			"User Management",
			"Financial Dashboard",
		],
	},
	"AI & Automation": {
		label: "AI & Automation",
		gradient: "from-cyan-500/10 to-blue-500/10",
		subcategories: [
			"Chatbot & Virtual Assistant",
			"Content Generation",
			"Data Processing & ETL",
			"Recommendation Engine",
			"Workflow Automation",
			"AI Agent",
		],
	},
	"Internal Tools": {
		label: "Internal Tools",
		gradient: "from-slate-500/10 to-gray-500/10",
		subcategories: [
			"Employee Portal",
			"Data Entry & Forms",
			"Approval Workflow",
			"Knowledge Base",
			"Asset Management",
			"Help Desk",
		],
	},
	Communication: {
		label: "Communication",
		gradient: "from-sky-500/10 to-blue-500/10",
		subcategories: [
			"Chat Application",
			"Forum & Community",
			"Social Network",
			"Video & Conferencing",
			"Notification System",
		],
	},
	Other: {
		label: "Other",
		gradient: "from-gray-500/10 to-slate-500/10",
		subcategories: ["General", "Experimental", "Utility"],
	},
};

/**
 * Get all main category names.
 */
export const MAIN_CATEGORIES = Object.keys(TEMPLATE_CATEGORY_TREE);

/**
 * Build a flat array of all "Main > Sub" category strings.
 * Used for validation and auto-fill AI prompt.
 */
export const ALL_CATEGORY_PATHS: string[] = Object.entries(
	TEMPLATE_CATEGORY_TREE,
).flatMap(([main, group]) =>
	group.subcategories.map((sub) => `${main} > ${sub}`),
);

/**
 * Flat array of category strings for backward compatibility.
 * Includes both main categories (for old data) and all "Main > Sub" paths.
 */
export const TEMPLATE_CATEGORIES: readonly string[] = [
	...MAIN_CATEGORIES,
	...ALL_CATEGORY_PATHS,
] as const;

export type TemplateCategory = string;

// ---------- Helpers ----------

/** Parse "Main > Sub" into parts. Returns [main, sub] or [raw, ""] for legacy. */
export function parseCategory(category: string): [string, string] {
	const sep = category.indexOf(" > ");
	if (sep === -1) return [category, ""];
	return [category.slice(0, sep), category.slice(sep + 3)];
}

/** Get the main category from a stored category string. */
export function getMainCategory(category: string): string {
	return parseCategory(category)[0];
}

/** Get the subcategory from a stored category string (empty for legacy). */
export function getSubcategory(category: string): string {
	return parseCategory(category)[1];
}

/** Get gradient classes for a category (matches by main category). */
export function getCategoryGradient(category: string): string {
	const main = getMainCategory(category);
	return (
		TEMPLATE_CATEGORY_TREE[main]?.gradient ??
		TEMPLATE_CATEGORY_TREE.Other.gradient
	);
}

/** Get display label — returns subcategory if present, else main category. */
export function getCategoryDisplayLabel(category: string): string {
	const [main, sub] = parseCategory(category);
	return sub || main;
}

/**
 * Map legacy flat categories to new hierarchical format.
 * Used for backward compatibility with existing templates.
 */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
	"Project Management": "Web Applications > Project Management",
	"E-Commerce": "E-Commerce > Online Store",
	Dashboard: "Dashboards & Analytics > Analytics Dashboard",
	CRM: "Web Applications > CRM & Sales",
	Social: "Communication > Social Network",
	"Content Management": "Web Applications > Content Management",
	Education: "Web Applications > Learning Management",
	"Health & Fitness": "Web Applications > Health & Fitness Tracker",
	Analytics: "Dashboards & Analytics > Analytics Dashboard",
	Communication: "Communication > Chat Application",
	Utility: "Other > Utility",
	Other: "Other > General",
};

/** Normalize a category — maps legacy flat categories to new format. */
export function normalizeCategory(category: string): string {
	if (category.includes(" > ")) return category;
	return LEGACY_CATEGORY_MAP[category] ?? `Other > ${category}`;
}
