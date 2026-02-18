import type { AgentDefinition } from "../types";

let agents: AgentDefinition[] = [];

export function registerAgents(defs: AgentDefinition[]) {
	agents = defs;
}

export function getAgent(id: string): AgentDefinition | undefined {
	return agents.find((a) => a.id === id);
}

export function getAllAgents(): AgentDefinition[] {
	return agents.filter((a) => a.enabled);
}

export function getAgentsByTier(
	tier: "opus" | "sonnet" | "haiku",
): AgentDefinition[] {
	return agents.filter((a) => a.enabled && a.modelTier === tier);
}
