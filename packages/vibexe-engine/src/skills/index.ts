import type { SkillDefinition } from "../types";
import { animationPatterns } from "./animation-patterns";
import { apiDesign } from "./api-design";
import { backendPatterns } from "./backend-patterns";
import { codingStandards } from "./coding-standards";
import { deploymentPatterns } from "./deployment-patterns";
import { dockerPatterns } from "./docker-patterns";
import { frontendPatterns } from "./frontend-patterns";
import { postgresPatterns } from "./postgres-patterns";
import { securityReview } from "./security-review";
import { tddWorkflow } from "./tdd-workflow";
import { verificationLoop } from "./verification-loop";
import { continuationAnalysis } from "./continuation-analysis";
import { visualReplication } from "./visual-replication";
import { mobileDesignReplication } from "./mobile-design-replication";

export const DEFAULT_SKILLS: SkillDefinition[] = [
	codingStandards,
	frontendPatterns,
	backendPatterns,
	securityReview,
	tddWorkflow,
	postgresPatterns,
	apiDesign,
	deploymentPatterns,
	dockerPatterns,
	verificationLoop,
	visualReplication,
	mobileDesignReplication,
	animationPatterns,
	continuationAnalysis,
];
