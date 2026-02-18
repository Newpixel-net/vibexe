import type {
	AgentDefinition,
	IntentClassification,
	OrchestrationFlow,
} from "../types";
import { getAgent } from "../registry/agent-registry";

export function selectAgentSequence(
	intent: IntentClassification,
	flows: OrchestrationFlow[],
): AgentDefinition[] {
	const flow = flows.find((f) => f.id === intent.suggestedFlow) || flows[0];
	if (!flow) return [];

	const agents: AgentDefinition[] = [];
	const sortedSteps = [...flow.steps].sort((a, b) => a.order - b.order);

	for (const step of sortedSteps) {
		const agent = getAgent(step.agentId);
		if (agent && agent.enabled) {
			agents.push(agent);
		}
	}

	return agents;
}
