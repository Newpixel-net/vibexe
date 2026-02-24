import type { LanguageModelProvider } from "@vibexe-ai/language-model";
import type { VibexeLogger } from "@vibexe-ai/logger";
import type { WorkspaceId } from "@vibexe-ai/protocol";
import type { VibexeStorage } from "@vibexe-ai/storage";
import type { Vault } from "@vibexe-ai/vault";
import type { TelemetrySettings } from "../telemetry";
import type { VibexeCallbacks } from "./callbacks";
import type { VibexeIntegrationConfig } from "./integrations";
import type { VectorStoreQueryServices } from "./query-services";
import type {
	ConsumeAgentTimeCallback,
	FetchUsageLimitsFn,
} from "./usage-limits";
import type { WaitUntil } from "./wait-until";

export type ApiSecretScryptConfig = {
	params?: {
		n: number;
		r: number;
		p: number;
		keyLen: number;
	};
	saltBytes?: number;
	/**
	 * When enabled, logs derived-key duration to `logger.debug` for observability.
	 * Never logs secrets or tokens.
	 */
	logDuration?: boolean;
};

export interface VibexeConfig {
	storage: VibexeStorage;
	sampleAppWorkspaceIds?: WorkspaceId[];
	llmProviders?: LanguageModelProvider[];
	/**
	 * scrypt configuration for API publishing secret hashing.
	 *
	 * These values affect only newly issued API secrets because the chosen params
	 * are stored in the ApiSecretRecord for verification.
	 */
	apiSecretScrypt?: ApiSecretScryptConfig;
	integrationConfigs?: VibexeIntegrationConfig;
	onConsumeAgentTime?: ConsumeAgentTimeCallback;
	telemetry?: {
		isEnabled?: boolean;
		waitForFlushFn?: () => Promise<unknown>;
		metadata?: TelemetrySettings["metadata"];
	};
	fetchUsageLimitsFn?: FetchUsageLimitsFn;
	vault: Vault;
	vectorStoreQueryServices?: VectorStoreQueryServices;
	callbacks?: VibexeCallbacks;
	logger?: VibexeLogger;
	waitUntil?: WaitUntil;
	experimental_contentGenerationNode?: boolean;
}
