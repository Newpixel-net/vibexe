import type { IntentClassification } from "../types";

const CONTINUATION_KEYWORDS = [
	"continue",
	"what next",
	"what's next",
	"resume",
	"pick up",
	"where was i",
	"where did i leave",
	"next steps",
	"what should i do",
	"keep going",
	"carry on",
];

/**
 * Check if user prompt is a continuation intent (returning to an existing project).
 */
export function isContinuationIntent(prompt: string): boolean {
	const lower = prompt.toLowerCase().trim();
	return CONTINUATION_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Keywords that indicate the user wants to fix a bug/error (routes to FIX_FLOW) */
const FIX_KEYWORDS = [
	"fix",
	"error",
	"bug",
	"broken",
	"crash",
	"not working",
	"doesn't work",
	"doesn't load",
	"blank screen",
	"white screen",
	"unexpected token",
	"module not found",
	"cannot read",
	"is not defined",
	"is not a function",
	"type error",
	"syntax error",
	"failed to fetch",
	"not valid json",
	"infinite loop",
	"too many re-renders",
];

/** Keywords that indicate refactoring intent (routes to REFACTOR_FLOW) */
const REFACTOR_KEYWORDS = [
	"refactor",
	"clean up",
	"cleanup",
	"restructure",
	"reorganize",
	"simplify",
	"split into",
	"extract component",
	"extract hook",
	"improve code quality",
	"code smell",
	"dry",
	"reduce duplication",
];

/** Keywords that indicate mobile app intent (routes to MOBILE_FLOW) */
const MOBILE_KEYWORDS = [
	"mobile",
	"ios",
	"android",
	"phone app",
	"native app",
	"mobile app",
	"pwa",
	"[project type: mobile",
];

function isMobileIntent(lower: string): boolean {
	return MOBILE_KEYWORDS.some((kw) => lower.includes(kw));
}

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
		"environment",
		"staging",
		"production",
		"backup",
		"restore",
		"promote",
		"deploy",
	],
};

const TECH_SIGNALS: Record<string, string[]> = {
	react: ["react", "component", "hook", "jsx", "tsx", "ui"],
	tailwind: ["tailwind", "style", "css", "design", "theme"],
	auth: ["auth", "login", "signup", "password", "session", "jwt", "oauth"],
	api: ["api", "endpoint", "rest", "fetch", "server", "backend"],
	database: ["database", "db", "sql", "postgres", "crud", "table"],
	state: ["state", "redux", "zustand", "context", "store"],
	platform: ["environment", "staging", "production", "backup", "restore", "promote", "deploy", "migration", "rollback", "snapshot"],
	mobile: ["mobile", "ios", "android", "phone", "pwa", "native", "app store"],
};

export function classifyIntent(prompt: string): IntentClassification {
	const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;
	const detectedUrls = prompt.match(URL_REGEX) || [];

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

	// --- Flow detection: check fix/refactor FIRST (highest priority after URL) ---

	// Count fix signals — if user is reporting an error, route to FIX_FLOW
	const fixSignalCount = FIX_KEYWORDS.filter((kw) => lower.includes(kw)).length;
	const hasFixIntent = fixSignalCount >= 1;

	// Count refactor signals
	const refactorSignalCount = REFACTOR_KEYWORDS.filter((kw) => lower.includes(kw)).length;
	const hasRefactorIntent = refactorSignalCount >= 1;

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

	// Priority 1: URL replication
	if (detectedUrls.length > 0) {
		suggestedFlow = "replicate";
		complexity = "complex";
		type = "website-replication";
	}
	// Priority 2: Fix/error intent — route to build-error-resolver
	else if (hasFixIntent) {
		suggestedFlow = "fix";
		// Fix requests are always at least medium complexity (need to read + diagnose + fix)
		complexity = hasComplexSignals >= 1 ? "complex" : "medium";
		type = "bug-fix";
	}
	// Priority 3: Refactor intent
	else if (hasRefactorIntent) {
		suggestedFlow = "refactor";
		complexity = hasComplexSignals >= 2 ? "complex" : "medium";
		type = "refactoring";
	}
	// Priority 3.5: Mobile app intent
	else if (isMobileIntent(lower)) {
		suggestedFlow = "mobile";
		complexity = hasComplexSignals >= 2 ? "complex" : "medium";
		type = "mobile-app";
	}
	// Priority 4: Normal feature/quick flow based on complexity
	else if (hasComplexSignals >= 2 || words.length > 30) {
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

	const reasoning = `Detected ${complexity} complexity: ${hasComplexSignals} complex signals, ${hasSimpleSignals} simple signals, ${fixSignalCount} fix signals, ${refactorSignalCount} refactor signals, ${techStack.length} tech areas. Suggested flow: ${suggestedFlow}.`;

	return { complexity, type, techStack, suggestedFlow, reasoning, detectedUrls };
}
