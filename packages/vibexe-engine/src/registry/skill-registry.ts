import type { SkillCategory, SkillDefinition } from "../types";

let skills: SkillDefinition[] = [];

export function registerSkills(defs: SkillDefinition[]) {
	skills = defs;
}

export function getSkill(id: string): SkillDefinition | undefined {
	return skills.find((s) => s.id === id);
}

export function getAllSkills(): SkillDefinition[] {
	return skills.filter((s) => s.enabled);
}

export function getSkillsByCategory(
	category: SkillCategory,
): SkillDefinition[] {
	return skills.filter((s) => s.enabled && s.category === category);
}

export function getSkillsForContext(keywords: string[]): SkillDefinition[] {
	const lowerKeywords = keywords.map((k) => k.toLowerCase());
	return skills.filter(
		(s) =>
			s.enabled &&
			s.activationTriggers.some((trigger) =>
				lowerKeywords.some(
					(kw) =>
						kw.includes(trigger.toLowerCase()) ||
						trigger.toLowerCase().includes(kw),
				),
			),
	);
}
