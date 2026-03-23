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
export type { TemplateFile } from "./shared/game-3d-templates";
export { GAME_3D_TEMPLATE_FILES, GAME_3D_SCENE_STARTER, GAME_3D_SCENE_STARTER_CHARACTER, GAME_3D_SCENE_STARTER_RUNNER, GAME_3D_SCENE_STARTER_SHOOTER } from "./shared/game-3d-templates";

// 3D game assets reference (3D model catalog for runtime injection)
export { GAME_3D_ASSETS_REFERENCE, PACKS_3D } from "./shared/game-assets-reference-3d";
export type { AssetPack3D } from "./shared/game-assets-reference-3d";

// 2D game templates & assets (Pixi.js + Proton)
export { GAME_2D_TEMPLATE_FILES, GAME_2D_SCENE_STARTER, GAME_2D_SCENE_STARTER_RUNNER, GAME_2D_SCENE_STARTER_PUZZLE, GAME_2D_SCENE_STARTER_SHOOTER, buildGame2dSceneStarter, buildGame2dSceneStarterRunner, buildGame2dSceneStarterPuzzle, buildGame2dSceneStarterShooter } from "./shared/game-2d-templates";
export { PACKS_2D, SCALES_2D, PALETTES, buildAssetReferencePrompt as GAME_2D_ASSETS_REFERENCE_BUILDER } from "./shared/game-2d-assets";
export type { AssetPack2D, ColorPalette } from "./shared/game-2d-assets";

// 2D game seed variety system
export { expandSeed, buildCreativeBriefPrompt } from "./shared/game-2d-seed";
export type { CreativeBrief, SubGenre } from "./shared/game-2d-seed";

// 2D game asset MCP integration (Flux LoRA prompts)
export { buildAssetPrompts } from "./shared/game-2d-asset-prompts";
export type { AssetPromptMap } from "./shared/game-2d-asset-prompts";

// Module system
export {
	ALL_MODULE_MANIFESTS,
	TERRAIN_PAINTER_MANIFEST,
	WORLD_BUILDER_MANIFEST,
	SKY_WEATHER_MANIFEST,
	CHARACTER_SYSTEM_MANIFEST,
	registerModule,
	getModule,
	getAllModules,
	getModulesByCategory,
	getModuleManifests,
} from "./shared/modules";
export type {
	ModuleManifest,
	ModuleCategory,
	ModuleInstance,
	ModuleRegistryEntry,
	ModuleMessage,
} from "./shared/modules";

// Population system
export {
	PopulationEngine,
	DEFAULT_POPULATION_LAYER,
	DEFAULT_TREE_ENTRY,
	DEFAULT_DETAIL_ENTRY,
	DEFAULT_AUTO_RULE,
	DENSITY_DISTANCES,
	BIOME_PRESETS,
	getBiomePreset,
	getBiomePresetIds,
	poissonDiskSampling,
	poissonDiskSamplingSeeded,
} from "./shared/modules/world-builder/population";
export type {
	PopulationLayer,
	TreePopulationEntry,
	DetailPopulationEntry,
	AutoHeatmapRule,
	HeatmapSource,
	ComputedHeatmap,
	PopulatedObject,
	PopulationResult,
	PopulationState,
	TerrainInfo,
	WorldPopulationBlueprint,
	BiomePreset,
	PresetAssetSlot,
	PresetLayerTemplate,
} from "./shared/modules/world-builder/population";
