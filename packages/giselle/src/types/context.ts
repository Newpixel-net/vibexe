import type { LanguageModelProvider } from "@giselles-ai/language-model";
import type { GiselleLogger } from "@giselles-ai/logger";
import type {
	GenerationOrigin,
	RunningGeneration,
	Task,
	WorkspaceId,
} from "@giselles-ai/protocol";
import type { GiselleStorage } from "@giselles-ai/storage";
import type { Vault } from "@giselles-ai/vault";
import type { GenerationMetadata } from "../generations";
import type { TelemetrySettings } from "../telemetry";
import type { GiselleCallbacks } from "./callbacks";
import type { ApiSecretScryptConfig } from "./config";
import type { GitHubIntegrationConfig } from "./integrations";
import type { VectorStoreQueryServices } from "./query-services";
import type {
	ConsumeAgentTimeCallback,
	FetchUsageLimitsFn,
} from "./usage-limits";
import type { WaitUntil } from "./wait-until";

type GenerateContentArgs = {
	context: GiselleContext;
	generation: RunningGeneration;
	metadata?: GenerationMetadata;
};

type GenerateContentProcess =
	| { type: "self" }
	| { type: "external"; process: (args: GenerateContentArgs) => Promise<void> };

export type SetRunTaskProcessArgs = {
	context: GiselleContext;
	task: Task;
	generationOriginType: GenerationOrigin["type"];
};

type RunTaskProcess =
	| { type: "self" }
	| {
			type: "external";
			process: (args: SetRunTaskProcessArgs) => Promise<void>;
	  };

export type RunTask = (args: SetRunTaskProcessArgs) => Promise<void>;

export interface GiselleContext {
	storage: GiselleStorage;
	sampleAppWorkspaceIds?: WorkspaceId[];
	llmProviders: LanguageModelProvider[];
	apiSecretScrypt?: ApiSecretScryptConfig;
	integrationConfigs?: {
		github?: GitHubIntegrationConfig;
	};
	onConsumeAgentTime?: ConsumeAgentTimeCallback;
	fetchUsageLimitsFn?: FetchUsageLimitsFn;
	telemetry?: {
		isEnabled?: boolean;
		waitForFlushFn?: () => Promise<unknown>;
		metadata?: TelemetrySettings["metadata"];
	};
	vault: Vault;
	vectorStoreQueryServices?: VectorStoreQueryServices;
	callbacks?: Omit<
		GiselleCallbacks,
		"generationComplete" | "generationError" | "taskCreate"
	>;
	logger: GiselleLogger;
	waitUntil: WaitUntil;
	generateContentProcess: GenerateContentProcess;
	runTaskProcess: RunTaskProcess;
	experimental_contentGenerationNode: boolean;
	resolveIntegrationCredential?: (credentialId: string) => Promise<{
		authType: string;
		config: Record<string, unknown>;
	} | null>;
	updateIntegrationCredential?: (
		credentialId: string,
		config: Record<string, unknown>,
	) => Promise<void>;
	resolveCredentialByPieceName?: (pieceName: string) => Promise<{
		authType: string;
		config: Record<string, unknown>;
	} | null>;
	createIntegrationStore?: () => {
		get(key: string): Promise<unknown>;
		put(key: string, value: unknown): Promise<void>;
		delete(key: string): Promise<void>;
	};
	/** Helpers for Wait node webhook/approval modes to interact with the DB */
	waitWebhookHelpers?: {
		/** Register a temporary webhook endpoint and return its dbId */
		register(path: string, workspaceId: string, nodeId: string): Promise<number>;
		/** Poll for webhook request logs matching the given endpointDbId. Returns the body or null. */
		poll(endpointDbId: number): Promise<Record<string, unknown> | null>;
		/** Cleanup: delete the temporary webhook endpoint */
		cleanup(endpointDbId: number): Promise<void>;
	};
}
