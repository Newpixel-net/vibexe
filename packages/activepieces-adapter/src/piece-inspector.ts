/**
 * Piece Inspector: Extracts metadata from loaded Activepieces NPM packages.
 *
 * Loads a piece and inspects its actions, auth requirements, and property schemas.
 * Results are cached since piece metadata is static per deployment.
 */

import { loadPiece } from "./piece-registry";

// ─── Types ──────────────────────────────────────────────

export interface PropertyInfo {
	name: string;
	displayName: string;
	description: string;
	type: string;
	required: boolean;
	defaultValue?: unknown;
	options?: { label: string; value: unknown }[];
}

export interface PieceActionInfo {
	name: string;
	displayName: string;
	description: string;
	requireAuth: boolean;
	props: Record<string, PropertyInfo>;
}

export interface PieceAuthInfo {
	type: string;
	displayName: string;
	description: string;
	props?: Record<string, PropertyInfo>;
}

export interface PieceInfo {
	name: string;
	displayName: string;
	description: string;
	version: string;
	auth: PieceAuthInfo | null;
	actions: PieceActionInfo[];
}

// ─── Cache ──────────────────────────────────────────────

const pieceInfoCache = new Map<string, PieceInfo>();
const actionPropsCache = new Map<string, Record<string, PropertyInfo>>();

// ─── Property extraction ────────────────────────────────

function extractPropertyInfo(
	name: string,
	prop: Record<string, unknown>,
): PropertyInfo {
	// Static dropdown options
	let options: { label: string; value: unknown }[] | undefined;
	if (prop.type === "STATIC_DROPDOWN" && prop.options) {
		const opts = prop.options as Record<string, unknown>;
		if (Array.isArray(opts.options)) {
			options = (opts.options as Array<Record<string, unknown>>).map((o) => ({
				label: String(o.label ?? o.value ?? ""),
				value: o.value,
			}));
		}
	}

	return {
		name,
		displayName: String(prop.displayName ?? name),
		description: String(prop.description ?? ""),
		type: String(prop.type ?? "SHORT_TEXT"),
		required: Boolean(prop.required ?? false),
		defaultValue: prop.defaultValue,
		options,
	};
}

function extractPropsFromObject(
	propsObj: unknown,
): Record<string, PropertyInfo> {
	if (!propsObj || typeof propsObj !== "object") return {};

	const result: Record<string, PropertyInfo> = {};
	for (const [key, value] of Object.entries(
		propsObj as Record<string, unknown>,
	)) {
		if (value && typeof value === "object") {
			result[key] = extractPropertyInfo(
				key,
				value as Record<string, unknown>,
			);
		}
	}
	return result;
}

// ─── Auth extraction ────────────────────────────────────

function extractAuthInfo(auth: unknown): PieceAuthInfo | null {
	if (!auth || typeof auth !== "object") return null;

	const a = auth as Record<string, unknown>;
	const type = String(a.type ?? "UNKNOWN");

	// Skip if it looks like "NONE" or empty
	if (type === "NONE" || type === "UNKNOWN") return null;

	return {
		type,
		displayName: String(a.displayName ?? "Authentication"),
		description: String(a.description ?? ""),
		props: a.props ? extractPropsFromObject(a.props) : undefined,
	};
}

// ─── Main functions ─────────────────────────────────────

/**
 * Inspect a piece by name. Returns full metadata including actions and auth.
 */
export async function inspectPiece(pieceName: string): Promise<PieceInfo> {
	const cached = pieceInfoCache.get(pieceName);
	if (cached) return cached;

	const piece = await loadPiece(pieceName);
	if (!piece || typeof piece !== "object") {
		throw new Error(`Failed to load piece: ${pieceName}`);
	}

	const p = piece as Record<string, unknown>;

	const actions: PieceActionInfo[] = [];
	if (p.actions && typeof p.actions === "object") {
		for (const [key, value] of Object.entries(
			p.actions as Record<string, unknown>,
		)) {
			if (value && typeof value === "object") {
				const action = value as Record<string, unknown>;
				actions.push({
					name: String(action.name ?? key),
					displayName: String(action.displayName ?? key),
					description: String(action.description ?? ""),
					requireAuth: Boolean(action.requireAuth ?? true),
					props: extractPropsFromObject(action.props),
				});
			}
		}
	}

	const info: PieceInfo = {
		name: String(p.name ?? pieceName),
		displayName: String(p.displayName ?? pieceName),
		description: String(p.description ?? ""),
		version: String(p.version ?? "0.0.0"),
		auth: extractAuthInfo(p.auth),
		actions,
	};

	pieceInfoCache.set(pieceName, info);
	return info;
}

/**
 * Get detailed properties for a specific action of a piece.
 */
export async function getActionProps(
	pieceName: string,
	actionName: string,
): Promise<Record<string, PropertyInfo>> {
	const cacheKey = `${pieceName}:${actionName}`;
	const cached = actionPropsCache.get(cacheKey);
	if (cached) return cached;

	const piece = await loadPiece(pieceName);
	if (!piece || typeof piece !== "object") {
		throw new Error(`Failed to load piece: ${pieceName}`);
	}

	const p = piece as Record<string, unknown>;
	const actions = p.actions as Record<string, unknown> | undefined;
	if (!actions) {
		throw new Error(`Piece "${pieceName}" has no actions`);
	}

	const action = actions[actionName] as Record<string, unknown> | undefined;
	if (!action) {
		throw new Error(
			`Action "${actionName}" not found in piece "${pieceName}"`,
		);
	}

	const props = extractPropsFromObject(action.props);
	actionPropsCache.set(cacheKey, props);
	return props;
}
