import type {
	GitHubInstallationAppAuth,
	GitHubPersonalAccessTokenAuth,
} from "@vibexe-ai/github-tool";

interface GitHubInstallationAppAuthResolver {
	installationIdForRepo: (repositoryNodeId: string) => Promise<number> | number;
	installationIds: () => Promise<number[]> | number[];
}

export interface GitHubIntegrationConfig {
	auth:
		| GitHubPersonalAccessTokenAuth
		| (Omit<GitHubInstallationAppAuth, "installationId"> & {
				resolver: GitHubInstallationAppAuthResolver;
		  });
	authV2: {
		appId: string;
		privateKey: string;
		clientId: string;
		clientSecret: string;
		webhookSecret: string;
	};
}

export type VibexeIntegrationConfig = {
	github?: GitHubIntegrationConfig;
};
