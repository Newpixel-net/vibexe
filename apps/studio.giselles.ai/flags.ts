// Self-hosted flags: simple functions that return the correct defaults.
// Replaces the Vercel-specific "flags/next" library which can interfere
// with RSC streaming in non-Vercel environments.

function takeLocalEnv(localEnvironmentKey: string) {
	if (process.env.NODE_ENV !== "development") {
		return false;
	}
	if (
		process.env[localEnvironmentKey] === undefined ||
		process.env[localEnvironmentKey] === "false"
	) {
		return false;
	}
	return true;
}

export const developerFlag = async () => takeLocalEnv("DEVELOPER_FLAG");

export const webSearchActionFlag = async () =>
	takeLocalEnv("WEB_SEARCH_ACTION_FLAG");

export const layoutV3Flag = async () => takeLocalEnv("LAYOUT_V3_FLAG");

// Note: experimental_storageFlag defaults to true when edge-config is undefined
export const experimental_storageFlag = async () =>
	takeLocalEnv("EXPERIMENTAL_STORAGE_FLAG") || true;

export const stageV2Flag = async () => takeLocalEnv("STAGE_V2_FLAG");

export const aiGatewayFlag = async () => takeLocalEnv("AI_GATEWAY_FLAG");

export const aiGatewayUnsupportedModelsFlag = async () =>
	takeLocalEnv("AI_GATEWAY_UNSUPPORTED_MODELS_FLAG");

export const googleUrlContextFlag = async () =>
	takeLocalEnv("GOOGLE_URL_CONTEXT_FLAG");

export const newEditorFlag = async () => takeLocalEnv("NEW_EDITOR_FLAG");

export const generateContentNodeFlag = async () =>
	takeLocalEnv("GENERATE_CONTENT_NODE_FLAG");

export const privatePreviewToolsFlag = async () =>
	takeLocalEnv("PRIVATE_PREVIEW_TOOLS_FLAG");

export const dataStoreFlag = async () => takeLocalEnv("DATA_STORE_FLAG");
