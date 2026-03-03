/**
 * Vibexe Engine — Multi-Agent Orchestration
 *
 * Public API exports for the engine package.
 */

// Types
export type {
	AgentDefinition,
	AgentEvent,
	AgentTool,
	EngineConfig,
	FlowStep,
	IntentClassification,
	IntentComplexity,
	OrchestrationFlow,
	RuleDefinition,
	SkillCategory,
	SkillDefinition,
} from "./types";

// Registries
export {
	getAgent,
	getAllAgents,
	getAgentsByTier,
	registerAgents,
} from "./registry/agent-registry";
export {
	getAllSkills,
	getSkill,
	getSkillsByCategory,
	getSkillsForContext,
	registerSkills,
} from "./registry/skill-registry";
export { getAllRules, getRule } from "./registry/rule-registry";

// Agents
export { DEFAULT_AGENTS } from "./agents";

// Skills
export { DEFAULT_SKILLS } from "./skills";

// Orchestrator
export { classifyIntent } from "./orchestrator/intent-classifier";
export { selectAgentSequence } from "./orchestrator/agent-router";
export { resolveSkills } from "./orchestrator/skill-resolver";
export { assemblePrompt } from "./orchestrator/prompt-assembler";
export {
	executeOrchestration,
	type OrchestrationPlan,
} from "./orchestrator/orchestration-engine";

// Flows
export {
	ALL_FLOWS,
	CONTINUE_FLOW,
	FEATURE_FLOW,
	FIX_FLOW,
	QUICK_FLOW,
	REFACTOR_FLOW,
	REPLICATE_FLOW,
} from "./flows";

// Intent helpers
export { isContinuationIntent } from "./orchestrator/intent-classifier";

// Templates
export { GAME_TEMPLATE_FILES } from "./shared/game-templates";
export type { TemplateFile } from "./shared/game-templates";
export { GAME_3D_TEMPLATE_FILES, GAME_3D_SCENE_STARTER, GAME_3D_SCENE_STARTER_CHARACTER, GAME_3D_SCENE_STARTER_RUNNER, GAME_3D_SCENE_STARTER_SHOOTER } from "./shared/game-3d-templates";

// Game assets reference (sprite catalog for runtime injection)
export { GAME_ASSETS_REFERENCE } from "./shared/game-assets-reference";

// 3D game assets reference (3D model catalog for runtime injection)
export { GAME_3D_ASSETS_REFERENCE, PACKS_3D } from "./shared/game-assets-reference-3d";
export type { AssetPack3D } from "./shared/game-assets-reference-3d";
