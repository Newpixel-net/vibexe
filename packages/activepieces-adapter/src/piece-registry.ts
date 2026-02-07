/**
 * Piece Registry: Discovers and loads installed Activepieces pieces.
 *
 * Activepieces pieces are npm packages that export a `Piece` object.
 * We dynamically import them at runtime based on piece name.
 */

export interface PieceMetadata {
	name: string;
	displayName: string;
	description: string;
	version: string;
	actions: Record<string, PieceActionMetadata>;
	triggers: Record<string, PieceTriggerMetadata>;
}

export interface PieceActionMetadata {
	name: string;
	displayName: string;
	description: string;
}

export interface PieceTriggerMetadata {
	name: string;
	displayName: string;
	description: string;
}

// Map of piece name -> npm package name
const PIECE_PACKAGE_MAP: Record<string, string> = {
	http: "@activepieces/piece-http",
	slack: "@activepieces/piece-slack",
	"google-sheets": "@activepieces/piece-google-sheets",
	gmail: "@activepieces/piece-gmail",
	discord: "@activepieces/piece-discord",
	"telegram-bot": "@activepieces/piece-telegram-bot",
	openai: "@activepieces/piece-openai",
	"google-drive": "@activepieces/piece-google-drive",
	notion: "@activepieces/piece-notion",
	airtable: "@activepieces/piece-airtable",
	stripe: "@activepieces/piece-stripe",
	hubspot: "@activepieces/piece-hubspot",
	mailchimp: "@activepieces/piece-mailchimp",
	twitter: "@activepieces/piece-twitter",
	linkedin: "@activepieces/piece-linkedin",
	"google-calendar": "@activepieces/piece-google-calendar",
	dropbox: "@activepieces/piece-dropbox",
	webhook: "@activepieces/piece-webhook",
	store: "@activepieces/piece-store",
	json: "@activepieces/piece-json",
	"text-helper": "@activepieces/piece-text-helper",
	"date-helper": "@activepieces/piece-date-helper",
	"math-helper": "@activepieces/piece-math-helper",
	"google-contacts": "@activepieces/piece-google-contacts",
	zoom: "@activepieces/piece-zoom",
};

// Cache for loaded pieces
const pieceCache = new Map<string, unknown>();

/**
 * Load an Activepieces piece by name.
 * Returns the piece's exported Piece object.
 */
export async function loadPiece(pieceName: string): Promise<unknown> {
	const cached = pieceCache.get(pieceName);
	if (cached) {
		return cached;
	}

	const packageName =
		PIECE_PACKAGE_MAP[pieceName] ?? `@activepieces/piece-${pieceName}`;

	try {
		const pieceModule = await import(packageName);
		// Activepieces pieces typically export the piece as default or as a named export
		const piece =
			pieceModule.default ?? pieceModule[Object.keys(pieceModule)[0]];
		if (!piece) {
			throw new Error(
				`Piece module ${packageName} does not export a valid piece`,
			);
		}
		pieceCache.set(pieceName, piece);
		return piece;
	} catch (error) {
		throw new Error(
			`Failed to load piece "${pieceName}" (package: ${packageName}): ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

/**
 * Get metadata for a loaded piece.
 */
export function getPieceMetadata(piece: unknown): PieceMetadata | null {
	if (!piece || typeof piece !== "object") return null;

	const p = piece as Record<string, unknown>;
	return {
		name: (p.name as string) ?? "unknown",
		displayName: (p.displayName as string) ?? (p.name as string) ?? "Unknown",
		description: (p.description as string) ?? "",
		version: (p.version as string) ?? "0.0.0",
		actions: extractActionMetadata(p.actions),
		triggers: extractTriggerMetadata(p.triggers),
	};
}

function extractActionMetadata(
	actions: unknown,
): Record<string, PieceActionMetadata> {
	if (!actions || typeof actions !== "object") return {};

	const result: Record<string, PieceActionMetadata> = {};
	for (const [key, value] of Object.entries(
		actions as Record<string, unknown>,
	)) {
		if (value && typeof value === "object") {
			const a = value as Record<string, unknown>;
			result[key] = {
				name: (a.name as string) ?? key,
				displayName: (a.displayName as string) ?? key,
				description: (a.description as string) ?? "",
			};
		}
	}
	return result;
}

function extractTriggerMetadata(
	triggers: unknown,
): Record<string, PieceTriggerMetadata> {
	if (!triggers || typeof triggers !== "object") return {};

	const result: Record<string, PieceTriggerMetadata> = {};
	for (const [key, value] of Object.entries(
		triggers as Record<string, unknown>,
	)) {
		if (value && typeof value === "object") {
			const t = value as Record<string, unknown>;
			result[key] = {
				name: (t.name as string) ?? key,
				displayName: (t.displayName as string) ?? key,
				description: (t.description as string) ?? "",
			};
		}
	}
	return result;
}

/**
 * List all available piece names.
 */
export function getAvailablePieceNames(): string[] {
	return Object.keys(PIECE_PACKAGE_MAP);
}

/**
 * Check if a piece is available (registered).
 */
export function isPieceAvailable(pieceName: string): boolean {
	return (
		pieceName in PIECE_PACKAGE_MAP ||
		pieceCache.has(pieceName)
	);
}
