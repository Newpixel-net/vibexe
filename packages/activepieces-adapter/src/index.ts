export { executePieceAction } from "./execute-piece-action";
export type { ExecutePieceActionArgs } from "./execute-piece-action";

export { buildActionContext } from "./context-builder";
export type { StoreAdapter } from "./context-builder";

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

export {
	PIECE_CATALOG,
	getCatalogEntry,
	getAllPieceNames,
	getAllCategories,
	getPiecesByCategory,
	searchPieces,
	TOTAL_PIECES,
} from "./piece-catalog";
export type {
	PieceCatalogEntry,
	PieceCategory,
	PieceAuthType,
	PieceType,
} from "./piece-catalog";

export { inspectPiece, getActionProps } from "./piece-inspector";
export type {
	PieceInfo,
	PieceActionInfo,
	PieceAuthInfo,
	PropertyInfo,
} from "./piece-inspector";

export { ensureFreshToken } from "./token-refresh";
export type { ConnectionResolver } from "./context-builder";

export * from "./n8n";
