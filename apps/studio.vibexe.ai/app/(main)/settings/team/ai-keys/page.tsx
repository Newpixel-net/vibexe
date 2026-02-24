import {
	AI_PROVIDERS,
	getTeamProviderKeys,
} from "@/lib/team-ai-provider-keys";
import { fetchCurrentTeam } from "@/services/teams";
import { TeamAiKeysPageClient } from "./page-client";

export default async function TeamAiKeysPage() {
	const team = await fetchCurrentTeam();
	const savedKeys = await getTeamProviderKeys(team.dbId);
	const keyMap = new Map(savedKeys.map((k) => [k.provider, k]));

	const providers = AI_PROVIDERS.map((provider) => {
		const saved = keyMap.get(provider.id);
		return {
			...provider,
			isActive: saved?.isActive ?? false,
			maskedKey: saved?.maskedKey ?? null,
			updatedAt: saved?.updatedAt?.toISOString() ?? null,
			errorReason: saved?.errorReason ?? null,
		};
	});

	return <TeamAiKeysPageClient providers={providers} />;
}
