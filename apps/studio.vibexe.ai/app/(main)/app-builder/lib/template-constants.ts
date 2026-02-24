/**
 * Template Constants
 *
 * Shared constants for the app template system.
 * Safe to import from both client and server components.
 */

export const TEMPLATE_CATEGORIES = [
	"Project Management",
	"E-Commerce",
	"Dashboard",
	"CRM",
	"Social",
	"Content Management",
	"Education",
	"Analytics",
	"Communication",
	"Utility",
	"Other",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
