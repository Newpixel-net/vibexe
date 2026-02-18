import type { IntentClassification } from "../types";

const COMPLEXITY_SIGNALS = {
	simple: [
		"counter",
		"hello",
		"button",
		"toggle",
		"simple",
		"basic",
		"single",
		"quick",
	],
	complex: [
		"auth",
		"dashboard",
		"stripe",
		"payment",
		"multi-page",
		"saas",
		"admin",
		"crud",
		"database",
		"api",
		"real-time",
		"chat",
		"e-commerce",
		"marketplace",
	],
};

const TECH_SIGNALS: Record<string, string[]> = {
	react: ["react", "component", "hook", "jsx", "tsx", "ui"],
	tailwind: ["tailwind", "style", "css", "design", "theme"],
	auth: ["auth", "login", "signup", "password", "session", "jwt", "oauth"],
	api: ["api", "endpoint", "rest", "fetch", "server", "backend"],
	database: ["database", "db", "sql", "postgres", "crud", "table"],
	state: ["state", "redux", "zustand", "context", "store"],
};

export function classifyIntent(prompt: string): IntentClassification {
	const lower = prompt.toLowerCase();
	const words = lower.split(/\s+/);

	// Detect tech stack
	const techStack: string[] = [];
	for (const [tech, signals] of Object.entries(TECH_SIGNALS)) {
		if (signals.some((s) => lower.includes(s))) {
			techStack.push(tech);
		}
	}
	if (!techStack.includes("react")) techStack.unshift("react");
	if (!techStack.includes("tailwind")) techStack.push("tailwind");

	// Detect complexity
	const hasComplexSignals = COMPLEXITY_SIGNALS.complex.filter((s) =>
		lower.includes(s),
	).length;
	const hasSimpleSignals = COMPLEXITY_SIGNALS.simple.filter((s) =>
		lower.includes(s),
	).length;

	let complexity: "simple" | "medium" | "complex";
	let suggestedFlow: string;
	let type: string;

	if (hasComplexSignals >= 2 || words.length > 30) {
		complexity = "complex";
		suggestedFlow = "feature";
		type = "full-app";
	} else if (hasComplexSignals >= 1 || techStack.length >= 3) {
		complexity = "medium";
		suggestedFlow = "feature";
		type = "multi-component";
	} else {
		complexity = "simple";
		suggestedFlow = "quick";
		type = "single-component";
	}

	const reasoning = `Detected ${complexity} complexity: ${hasComplexSignals} complex signals, ${hasSimpleSignals} simple signals, ${techStack.length} tech areas. Suggested flow: ${suggestedFlow}.`;

	return { complexity, type, techStack, suggestedFlow, reasoning };
}
