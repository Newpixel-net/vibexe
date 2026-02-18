import type {
	AgentDefinition,
	IntentClassification,
	OrchestrationFlow,
	SkillDefinition,
} from "../types";
import { selectAgentSequence } from "./agent-router";
import { classifyIntent } from "./intent-classifier";
import { assemblePrompt } from "./prompt-assembler";
import { resolveSkills } from "./skill-resolver";

export interface OrchestrationPlan {
	intent: IntentClassification;
	agents: AgentDefinition[];
	agentSkills: Map<string, SkillDefinition[]>;
	agentPrompts: Map<string, string>;
}

export function executeOrchestration(
	userPrompt: string,
	flows: OrchestrationFlow[],
	projectContext?: string,
): OrchestrationPlan {
	// 1. Classify intent
	const intent = classifyIntent(userPrompt);

	// 2. Select agent sequence
	const agents = selectAgentSequence(intent, flows);

	// 3. Resolve skills per agent
	const agentSkills = new Map<string, SkillDefinition[]>();
	for (const agent of agents) {
		const skills = resolveSkills(agent, intent.techStack);
		agentSkills.set(agent.id, skills);
	}

	// 4. Assemble prompts per agent (with complexity for developer agents)
	const agentPrompts = new Map<string, string>();
	for (const agent of agents) {
		const skills = agentSkills.get(agent.id) || [];
		const prompt = assemblePrompt(
			agent,
			skills,
			projectContext,
			userPrompt,
			intent.complexity,
		);
		agentPrompts.set(agent.id, prompt);
	}

	return { intent, agents, agentSkills, agentPrompts };
}
