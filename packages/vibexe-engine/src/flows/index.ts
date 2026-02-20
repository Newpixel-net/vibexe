import type { OrchestrationFlow } from "../types";

export const FEATURE_FLOW: OrchestrationFlow = {
	id: "feature",
	name: "Feature Flow",
	description:
		"Full pipeline: architect -> planner -> developer -> reviewer -> security",
	steps: [
		{ agentId: "architect", order: 1, required: true },
		{ agentId: "planner", order: 2, required: true },
		{ agentId: "fullstack-developer", order: 3, required: true },
		{ agentId: "code-reviewer", order: 4, required: false },
		{ agentId: "security-reviewer", order: 5, required: false },
	],
};

export const QUICK_FLOW: OrchestrationFlow = {
	id: "quick",
	name: "Quick Flow",
	description: "Single agent for simple requests",
	steps: [{ agentId: "fullstack-developer", order: 1, required: true }],
};

export const FIX_FLOW: OrchestrationFlow = {
	id: "fix",
	name: "Fix Flow",
	description: "Build error resolver -> code reviewer",
	steps: [
		{ agentId: "build-error-resolver", order: 1, required: true },
		{ agentId: "code-reviewer", order: 2, required: false },
	],
};

export const REFACTOR_FLOW: OrchestrationFlow = {
	id: "refactor",
	name: "Refactor Flow",
	description: "Architect -> refactor cleaner -> code reviewer",
	steps: [
		{ agentId: "architect", order: 1, required: true },
		{ agentId: "refactor-cleaner", order: 2, required: true },
		{ agentId: "code-reviewer", order: 3, required: false },
	],
};

export const REPLICATE_FLOW: OrchestrationFlow = {
	id: "replicate",
	name: "Replicate Flow",
	description: "Site replicator for URL-based website recreation",
	steps: [{ agentId: "site-replicator", order: 1, required: true }],
};

export const CONTINUE_FLOW: OrchestrationFlow = {
	id: "continue",
	name: "Continue Flow",
	description: "Analyze existing project and suggest next steps",
	steps: [{ agentId: "continuation-analyst", order: 1, required: true }],
};

export const ALL_FLOWS: OrchestrationFlow[] = [
	FEATURE_FLOW,
	QUICK_FLOW,
	FIX_FLOW,
	REFACTOR_FLOW,
	REPLICATE_FLOW,
	CONTINUE_FLOW,
];
