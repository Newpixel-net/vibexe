/**
 * Piece Auth Metadata: Extracts OAuth2 configuration from Activepieces pieces.
 *
 * Pieces define auth via PieceAuth.OAuth2({...}) which produces an object with
 * type "OAUTH2" and direct properties: authUrl, tokenUrl, scope, etc.
 * Some pieces (e.g. Google Sheets) export auth as an array of auth types.
 */

import { loadPiece } from "./piece-registry";

export interface PieceOAuth2Metadata {
	authUrl: string;
	tokenUrl: string;
	scope: string[];
	pkce?: boolean;
	pkceMethod?: "plain" | "S256";
	authorizationMethod?: "HEADER" | "BODY";
	extra?: Record<string, string>;
	grantType?: string;
	prompt?: "none" | "consent" | "login" | "omit";
}

// Cache: piece auth metadata is static per deployment
const authMetadataCache = new Map<string, PieceOAuth2Metadata | null>();

/**
 * Extract OAuth2 metadata from an installed Activepieces piece.
 *
 * Returns the OAuth2 config (authUrl, tokenUrl, scope, etc.) or null if
 * the piece does not use OAuth2 authentication.
 */
export async function getPieceOAuth2Metadata(
	pieceName: string,
): Promise<PieceOAuth2Metadata | null> {
	const cached = authMetadataCache.get(pieceName);
	if (cached !== undefined) return cached;

	try {
		const piece = await loadPiece(pieceName);
		if (!piece || typeof piece !== "object") {
			authMetadataCache.set(pieceName, null);
			return null;
		}

		const p = piece as Record<string, unknown>;
		const auth = p.auth;
		if (!auth) {
			authMetadataCache.set(pieceName, null);
			return null;
		}

		// Find the OAuth2 auth entry - handle both single auth and array formats
		// Google Sheets, for example, exports auth as [OAuth2Auth, CustomAuth]
		let oauth2Auth: Record<string, unknown> | null = null;

		if (Array.isArray(auth)) {
			const found = auth.find(
				(a: unknown) =>
					a &&
					typeof a === "object" &&
					(a as Record<string, unknown>).type === "OAUTH2",
			);
			if (found && typeof found === "object") {
				oauth2Auth = found as Record<string, unknown>;
			}
		} else if (
			typeof auth === "object" &&
			(auth as Record<string, unknown>).type === "OAUTH2"
		) {
			oauth2Auth = auth as Record<string, unknown>;
		}

		if (!oauth2Auth) {
			authMetadataCache.set(pieceName, null);
			return null;
		}

		// Extract OAuth2 metadata from the auth property
		// PieceAuth.OAuth2() spreads the request object and adds type: "OAUTH2",
		// so authUrl, tokenUrl, scope, etc. are direct properties
		const authUrl = oauth2Auth.authUrl;
		const tokenUrl = oauth2Auth.tokenUrl;

		if (typeof authUrl !== "string" || typeof tokenUrl !== "string") {
			authMetadataCache.set(pieceName, null);
			return null;
		}

		const rawScope = oauth2Auth.scope;
		const scope: string[] = Array.isArray(rawScope)
			? rawScope.filter((s): s is string => typeof s === "string")
			: typeof rawScope === "string"
				? [rawScope]
				: [];

		const metadata: PieceOAuth2Metadata = {
			authUrl,
			tokenUrl,
			scope,
		};

		// Optional fields - only include if defined
		if (typeof oauth2Auth.pkce === "boolean") {
			metadata.pkce = oauth2Auth.pkce;
		}
		if (
			oauth2Auth.pkceMethod === "plain" ||
			oauth2Auth.pkceMethod === "S256"
		) {
			metadata.pkceMethod = oauth2Auth.pkceMethod;
		}
		if (
			oauth2Auth.authorizationMethod === "HEADER" ||
			oauth2Auth.authorizationMethod === "BODY"
		) {
			metadata.authorizationMethod = oauth2Auth.authorizationMethod;
		}
		if (
			oauth2Auth.extra &&
			typeof oauth2Auth.extra === "object" &&
			!Array.isArray(oauth2Auth.extra)
		) {
			metadata.extra = oauth2Auth.extra as Record<string, string>;
		}
		if (typeof oauth2Auth.grantType === "string") {
			metadata.grantType = oauth2Auth.grantType;
		}
		if (
			oauth2Auth.prompt === "none" ||
			oauth2Auth.prompt === "consent" ||
			oauth2Auth.prompt === "login" ||
			oauth2Auth.prompt === "omit"
		) {
			metadata.prompt = oauth2Auth.prompt;
		}

		authMetadataCache.set(pieceName, metadata);
		return metadata;
	} catch (error) {
		console.error(
			`Failed to extract OAuth2 metadata for ${pieceName}:`,
			error,
		);
		authMetadataCache.set(pieceName, null);
		return null;
	}
}
