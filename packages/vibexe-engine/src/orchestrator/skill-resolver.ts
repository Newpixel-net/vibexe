import type { AgentDefinition, SkillDefinition } from "../types";
import { getSkill, getSkillsForContext } from "../registry/skill-registry";

export function resolveSkills(
	agent: AgentDefinition,
	techStack: string[],
): SkillDefinition[] {
	const skillSet = new Map<string, SkillDefinition>();

	// Load agent's declared skills
	for (const skillId of agent.skills) {
		const skill = getSkill(skillId);
		if (skill && skill.enabled) {
			skillSet.set(skill.id, skill);
		}
	}

	// Load context-driven skills from tech stack keywords
	const contextSkills = getSkillsForContext(techStack);
	for (const skill of contextSkills) {
		skillSet.set(skill.id, skill);
	}

	return Array.from(skillSet.values());
}
