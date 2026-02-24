import type { WorkspaceId } from "@vibexe-ai/protocol";
import { notFound } from "next/navigation";
import { vibexe } from "@/app/vibexe";
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

/** Wrap a promise with a timeout. Returns fallback if the promise doesn't resolve in time. */
function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	fallback: T,
): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
	]);
}

export async function dataLoader(workspaceId: WorkspaceId) {
	const t0 = Date.now();
	const mark = (label: string) =>
		console.log(`[dataLoader] ${label}: ${Date.now() - t0}ms`);

	mark("START");

	// Step 1: Agent lookup (required for everything else)
	const agent = await db.query.agents.findFirst({
		where: (agents, { eq }) => eq(agents.workspaceId, workspaceId),
	});
	mark("agent query done");
	if (agent === undefined) {
		return notFound();
	}

	// Step 2: Auth check (required before proceeding)
	const currentUser = await fetchCurrentUser();
	mark("fetchCurrentUser done");

	const isUserMemberOfWorkspaceTeam = await isMemberOfTeam(
		currentUser.dbId,
		agent.teamDbId,
	);
	mark("isMemberOfTeam done");
	if (!isUserMemberOfWorkspaceTeam) {
		return notFound();
	}

	// Step 3: Parallel batch - independent operations that all need agent.teamDbId
	const [gitHubIntegrationState, workspaceTeam] = await Promise.all([
		// Guard GitHub API calls with 5-second timeout
		withTimeout(
			getGitHubIntegrationState(agent.dbId),
			5000,
			{ status: "unauthorized" as const, authUrl: "/auth/connect/github" },
		),
		fetchWorkspaceTeam(agent.teamDbId),
	]);
	mark("github + workspaceTeam done");

	if (!workspaceTeam) {
		return notFound();
	}

	const sdkAvailability = isInternalPlan(workspaceTeam);

	// Step 4: Big parallel batch - workspace data, usage limits, flags, vector stores
	const [
		usageLimits,
		data,
		webSearchAction,
		layoutV3,
		aiGateway,
		aiGatewayUnsupportedModels,
		googleUrlContext,
		generateContentNode,
		privatePreviewTools,
		dataStore,
		teamGitHubRepositoryIndexes,
		officialGitHubRepositoryIndexes,
		teamDocumentStores,
		officialDocumentStores,
		teamDataStores,
	] = await Promise.all([
		getUsageLimitsForTeam(workspaceTeam),
		vibexe.getWorkspace(workspaceId),
		webSearchActionFlag(),
		layoutV3Flag(),
		aiGatewayFlag(),
		aiGatewayUnsupportedModelsFlag(),
		googleUrlContextFlag(),
		generateContentNodeFlag(),
		privatePreviewToolsFlag(),
		dataStoreFlag(),
		getGitHubRepositoryIndexes(workspaceTeam.dbId),
		getOfficialGitHubRepositoryIndexes(),
		getDocumentVectorStores(workspaceTeam.dbId),
		getOfficialDocumentVectorStores(),
		getTeamDataStores(workspaceTeam.dbId),
	]);
	mark("parallel batch done (workspace + flags + stores)");

	const stage = true;

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

	const llmProviders = vibexe.getLanguageModelProviders();

	mark("DONE");

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
