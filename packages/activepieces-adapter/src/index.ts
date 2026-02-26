/**
 * Client-safe exports for the activepieces adapter.
 * Only exports static catalog data and type definitions.
 *
 * For server-only code (executePieceAction, loadPiece, inspectPiece, etc.),
 * import from "@vibexe-ai/activepieces-adapter/server" instead.
 */

export {
	PIECE_CATALOG,
	INSTALLED_CATALOG,
	TOTAL_INSTALLED,
	getCatalogEntry,
	getAllPieceNames,
	getAllCategories,
	getPiecesByCategory,
	searchPieces,
	TOTAL_PIECES,
	INSTALLED_PIECES,
	isInstalledPiece,
	getPieceCategoryColor,
} from "./piece-catalog";
export type {
	PieceCatalogEntry,
	PieceCategory,
	PieceAuthType,
	PieceType,
} from "./piece-catalog";

export { getOAuthProvider, getPiecesForProvider } from "./oauth-providers";

// Re-export types only (no runtime imports) for convenience
export type { ExecutePieceActionArgs } from "./execute-piece-action";
export type { StoreAdapter, ConnectionResolver } from "./context-builder";
export type { AuthType, StoredCredential } from "./auth-resolver";
export type { PropertyType } from "./property-resolver";
export type {
	PieceMetadata,
	PieceActionMetadata,
	PieceTriggerMetadata,
} from "./piece-registry";
export type {
	PieceInfo,
	PieceActionInfo,
	PieceAuthInfo,
	PropertyInfo,
} from "./piece-inspector";
