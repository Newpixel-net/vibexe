import type { WorkspaceId } from "@giselles-ai/protocol";
import { notFound } from "next/navigation";
import { giselle } from "@/app/giselle";
import { db } from "@/db";
import {
	aiGatewayFlag,
	aiGatewayUnsupportedModelsFlag,
	dataStoreFlag,
	generateContentNodeFlag,
	googleUrlContextFlag,
	layoutV3Flag,
	privatePreviewToolsFlag,
	webSearchActionFlag,
} from "@/flags";
import { getTeamDataStores } from "@/lib/data-stores/queries";
import { logger } from "@/lib/logger";
import {
	getDocumentVectorStores,
	getOfficialDocumentVectorStores,
} from "@/lib/vector-stores/document/queries";
import {
	getGitHubRepositoryIndexes,
	getOfficialGitHubRepositoryIndexes,
} from "@/lib/vector-stores/github";
import { getGitHubIntegrationState } from "@/packages/lib/github";
import { getUsageLimitsForTeam } from "@/packages/lib/usage-limits";
import { fetchCurrentUser } from "@/services/accounts";
import { fetchWorkspaceTeam, isMemberOfTeam } from "@/services/teams";
import { isInternalPlan } from "@/services/teams/utils";

export async function dataLoader(workspaceId: WorkspaceId) {
	const t0 = Date.now();
	const log = (label: string) =>
		console.log(`[dataLoader] ${label}: ${Date.now() - t0}ms`);

	logger.debug("Loading workspace");
	log("start");
	const agent = await db.query.agents.findFirst({
		where: (agents, { eq }) => eq(agents.workspaceId, workspaceId),
	});
	log("agent query done");
	if (agent === undefined) {
		return notFound();
	}
	const currentUser = await fetchCurrentUser();
	log("fetchCurrentUser done");

	// Check if user is a member of the workspace's team before other operations
	const isUserMemberOfWorkspaceTeam = await isMemberOfTeam(
		currentUser.dbId,
		agent.teamDbId,
	);
	log("isMemberOfTeam done");
	if (!isUserMemberOfWorkspaceTeam) {
		return notFound();
	}

	const gitHubIntegrationState = await getGitHubIntegrationState(agent.dbId);
	log("getGitHubIntegrationState done");

	const workspaceTeam = await fetchWorkspaceTeam(agent.teamDbId);
	log("fetchWorkspaceTeam done");
	if (!workspaceTeam) {
		return notFound();
	}

	const sdkAvailability = isInternalPlan(workspaceTeam);
	const usageLimits = await getUsageLimitsForTeam(workspaceTeam);
	log("getUsageLimitsForTeam done");
	const webSearchAction = await webSearchActionFlag();
	log("webSearchActionFlag done");
	const layoutV3 = await layoutV3Flag();
	log("layoutV3Flag done");
	const stage = true;
	const aiGateway = await aiGatewayFlag();
	log("aiGatewayFlag done");
	const aiGatewayUnsupportedModels = await aiGatewayUnsupportedModelsFlag();
	log("aiGatewayUnsupportedModelsFlag done");
	const googleUrlContext = await googleUrlContextFlag();
	log("googleUrlContextFlag done");
	const data = await giselle.getWorkspace(workspaceId);
	log("giselle.getWorkspace done");
	const generateContentNode = await generateContentNodeFlag();
	log("generateContentNodeFlag done");
	const privatePreviewTools = await privatePreviewToolsFlag();
	log("privatePreviewToolsFlag done");
	const dataStore = await dataStoreFlag();
	log("dataStoreFlag done");
	const [teamGitHubRepositoryIndexes, officialGitHubRepositoryIndexes] =
		await Promise.all([
			getGitHubRepositoryIndexes(workspaceTeam.dbId),
			getOfficialGitHubRepositoryIndexes(),
		]);
	log("gitHubRepositoryIndexes done");

	const officialGitHubIds = new Set(
		officialGitHubRepositoryIndexes.map((r) => r.id),
	);
	const teamGitHubIds = new Set(teamGitHubRepositoryIndexes.map((r) => r.id));
	const gitHubRepositoryIndexes = [
		...teamGitHubRepositoryIndexes.map((repo) => ({
			...repo,
			isOfficial: officialGitHubIds.has(repo.id),
		})),
		...officialGitHubRepositoryIndexes
			.filter((repo) => !teamGitHubIds.has(repo.id))
			.map((repo) => ({ ...repo, isOfficial: true })),
	];

	const [teamDocumentStores, officialDocumentStores, teamDataStores] =
		await Promise.all([
			getDocumentVectorStores(workspaceTeam.dbId),
			getOfficialDocumentVectorStores(),
			getTeamDataStores(workspaceTeam.dbId),
		]);
	log("documentStores done");

	// Merge stores with isOfficial flag, deduplicating official stores already in team stores
	const officialStoreIds = new Set(officialDocumentStores.map((s) => s.id));
	const teamStoreIds = new Set(teamDocumentStores.map((s) => s.id));
	const documentVectorStores = [
		...teamDocumentStores.map((store) => ({
			...store,
			isOfficial: officialStoreIds.has(store.id),
		})),
		...officialDocumentStores
			.filter((store) => !teamStoreIds.has(store.id))
			.map((store) => ({ ...store, isOfficial: true })),
	];

	const llmProviders = giselle.getLanguageModelProviders();
	log("ALL DONE - total");

	return {
		currentUser,
		agent,
		gitHubIntegrationState,
		workspaceTeam,
		usageLimits,
		gitHubRepositoryIndexes,
		webSearchAction,
		layoutV3,
		stage,
		aiGateway,
		aiGatewayUnsupportedModels,
		googleUrlContext,
		data,
		documentVectorStores,
		teamDataStores,
		featureFlags: {
			webSearchAction,
			layoutV3,
			stage,
			aiGateway,
			aiGatewayUnsupportedModels,
			googleUrlContext,
			generateContentNode,
			privatePreviewTools,
			dataStore,
			sdkAvailability,
		},
		llmProviders,
	};
}

export type LoaderData = Awaited<ReturnType<typeof dataLoader>>;
