export interface AgentDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	modelTier: "opus" | "sonnet" | "haiku";
	tools: AgentTool[];
	readOnly: boolean;
	skills: string[];
	activationTriggers: string[];
	systemPrompt: string;
	enabled: boolean;
}

export type AgentTool =
	| "create_file"
	| "update_file"
	| "delete_file"
	| "read_file"
	| "search_code"
	| "define_entities";

export interface SkillDefinition {
	id: string;
	name: string;
	category: SkillCategory;
	description: string;
	activationTriggers: string[];
	content: string;
	enabled: boolean;
}

export type SkillCategory =
	| "framework"
	| "database"
	| "workflow"
	| "infrastructure"
	| "specialized";

export interface RuleDefinition {
	id: string;
	name: string;
	description: string;
	value: string | number | boolean;
	type: "number" | "string" | "boolean";
	enabled: boolean;
}

export interface OrchestrationFlow {
	id: string;
	name: string;
	description: string;
	steps: FlowStep[];
}

export interface FlowStep {
	agentId: string;
	order: number;
	required: boolean;
}

export type IntentComplexity = "simple" | "medium" | "complex";

export interface IntentClassification {
	complexity: IntentComplexity;
	type: string;
	techStack: string[];
	suggestedFlow: string;
	reasoning: string;
	detectedUrls: string[];
}

export interface AgentEvent {
	type:
		| "agent-start"
		| "agent-complete"
		| "skill-loaded"
		| "phase-start"
		| "review-verdict"
		| "thinking";
	agentId?: string;
	agentName?: string;
	modelTier?: string;
	skillId?: string;
	skillName?: string;
	phaseId?: string;
	phaseName?: string;
	fileCount?: number;
	result?: "success" | "warning" | "error";
	verdict?: "approve" | "warning" | "block";
	issues?: string[];
	content?: string;
}

export interface EngineConfig {
	defaultModelTier: "opus" | "sonnet" | "haiku";
	enabledAgents: string[];
	enabledSkills: string[];
	maxTokenBudget: number;
	rules: RuleDefinition[];
}
