import type { RunningGeneration, Trigger } from "@vibexe-ai/protocol";
import type { EmbeddingMetrics } from "@vibexe-ai/rag";
import type { OnAppConnectionChange, OnAppCreate, OnAppDelete } from "../apps";
import type {
	GenerationMetadata,
	OnGenerationComplete,
	OnGenerationError,
} from "../generations";
import type { OnTaskCreate } from "../tasks";
import type { BuildAiGatewayHeaders } from "./ai-gateway";
import type { QueryContext } from "./query-services";

export interface EmbeddingCompleteCallbackFunctionArgs {
	embeddingMetrics: EmbeddingMetrics;
	generation: RunningGeneration;
	queryContext: QueryContext;
	generationMetadata?: GenerationMetadata;
}

export type EmbeddingCompleteCallbackFunction = (
	args: EmbeddingCompleteCallbackFunctionArgs,
) => void | Promise<void>;

export type OnTaskFailed = (args: {
	taskId: string;
	workspaceId: string;
	error: string;
}) => void | Promise<void>;

export type VibexeCallbacks = {
	appCreate?: OnAppCreate;
	appDelete?: OnAppDelete;
	appConnectionChange?: OnAppConnectionChange;
	flowTriggerUpdate?: (flowTrigger: Trigger) => Promise<void>;
	embeddingComplete?: EmbeddingCompleteCallbackFunction;
	generationComplete?: OnGenerationComplete;
	generationError?: OnGenerationError;
	taskCreate?: OnTaskCreate;
	taskFailed?: OnTaskFailed;
	buildAiGatewayHeaders?: BuildAiGatewayHeaders;
};
