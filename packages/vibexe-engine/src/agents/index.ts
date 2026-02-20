import type { AgentDefinition } from "../types";
import { architect } from "./architect";
import { backendDeveloper } from "./backend-developer";
import { buildErrorResolver } from "./build-error-resolver";
import { codeReviewer } from "./code-reviewer";
import { docUpdater } from "./doc-updater";
import { e2eRunner } from "./e2e-runner";
import { frontendDeveloper } from "./frontend-developer";
import { fullstackDeveloper } from "./fullstack-developer";
import { planner } from "./planner";
import { refactorCleaner } from "./refactor-cleaner";
import { securityReviewer } from "./security-reviewer";
import { tddGuide } from "./tdd-guide";
import { uiDesigner } from "./ui-designer";
import { continuationAnalyst } from "./continuation-analyst";
import { siteReplicator } from "./site-replicator";

export const DEFAULT_AGENTS: AgentDefinition[] = [
	planner,
	architect,
	tddGuide,
	codeReviewer,
	securityReviewer,
	buildErrorResolver,
	frontendDeveloper,
	backendDeveloper,
	fullstackDeveloper,
	uiDesigner,
	docUpdater,
	refactorCleaner,
	e2eRunner,
	siteReplicator,
	continuationAnalyst,
];
