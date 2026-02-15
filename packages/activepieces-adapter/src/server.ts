/**
 * Server-only exports for the activepieces adapter.
 * These modules import @activepieces packages that use Node.js built-ins (fs, net, etc.)
 * and must NOT be imported from client components.
 *
 * Client code should import from "@giselles-ai/activepieces-adapter" (the main entry).
 * Server code should import from "@giselles-ai/activepieces-adapter/server".
 */

export { executePieceAction } from "./execute-piece-action";
export type { ExecutePieceActionArgs } from "./execute-piece-action";

export { buildActionContext } from "./context-builder";
export type { StoreAdapter, ConnectionResolver } from "./context-builder";

export { resolveAuth } from "./auth-resolver";
export type { AuthType, StoredCredential } from "./auth-resolver";

export { resolvePropertyValue, resolveProperties } from "./property-resolver";
export type { PropertyType } from "./property-resolver";

export {
	loadPiece,
	getPieceMetadata,
	getAvailablePieceNames,
	isPieceAvailable,
} from "./piece-registry";
export type {
	PieceMetadata,
	PieceActionMetadata,
	PieceTriggerMetadata,
} from "./piece-registry";

export { inspectPiece, getActionProps, resolveDynamicOptions } from "./piece-inspector";
export type {
	PieceInfo,
	PieceActionInfo,
	PieceAuthInfo,
	PropertyInfo,
} from "./piece-inspector";

export { ensureFreshToken } from "./token-refresh";

export { getPieceOAuth2Metadata } from "./piece-auth-metadata";
export type { PieceOAuth2Metadata } from "./piece-auth-metadata";

export * from "./n8n";
