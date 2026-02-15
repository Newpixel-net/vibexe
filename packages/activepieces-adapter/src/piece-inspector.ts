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

// ─── Auth overrides ────────────────────────────────────
// Some pieces declare OAuth2 in their npm package but work better with API keys
// in our UI. This map overrides the auth type returned by inspectPiece().

const PIECE_AUTH_OVERRIDES: Record<string, PieceAuthInfo> = {
	youtube: {
		type: "SECRET_TEXT",
		displayName: "YouTube API Key",
		description:
			"Get a YouTube Data API key from Google Cloud Console",
	},
};

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
	// Activepieces Piece class exposes actions as a method: piece.actions() → Record<string, Action>
	const actionsObj =
		typeof p.actions === "function"
			? (p.actions as () => Record<string, unknown>)()
			: p.actions;
	if (actionsObj && typeof actionsObj === "object") {
		for (const [key, value] of Object.entries(
			actionsObj as Record<string, unknown>,
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
		auth: PIECE_AUTH_OVERRIDES[pieceName] ?? extractAuthInfo(p.auth),
		actions,
	};

	pieceInfoCache.set(pieceName, info);
	return info;
}

/**
 * Resolve dynamic dropdown options for a property.
 * Calls the property's options() function with auth and current values.
 */
export async function resolveDynamicOptions(
	pieceName: string,
	actionName: string,
	propertyName: string,
	auth: unknown,
	currentValues: Record<string, unknown>,
): Promise<{ options: { label: string; value: unknown }[] }> {
	const piece = await loadPiece(pieceName);
	if (!piece || typeof piece !== "object") {
		throw new Error(`Failed to load piece: ${pieceName}`);
	}

	const p = piece as Record<string, unknown>;
	const actionsObj =
		typeof p.actions === "function"
			? (p.actions as () => Record<string, unknown>)()
			: (p.actions as Record<string, unknown> | undefined);

	if (!actionsObj) {
		throw new Error(`Piece "${pieceName}" has no actions`);
	}

	const action = actionsObj[actionName] as Record<string, unknown> | undefined;
	if (!action) {
		throw new Error(
			`Action "${actionName}" not found in piece "${pieceName}"`,
		);
	}

	const propsObj = action.props as Record<string, unknown> | undefined;
	if (!propsObj) {
		throw new Error(`Action "${actionName}" has no props`);
	}

	const propDef = propsObj[propertyName] as Record<string, unknown> | undefined;
	if (!propDef) {
		throw new Error(
			`Property "${propertyName}" not found in action "${actionName}"`,
		);
	}

	// Check if this property has a dynamic options function
	const optionsField = propDef.options;
	if (!optionsField) {
		// No options to resolve — return static options if available
		if (propDef.type === "STATIC_DROPDOWN" && propDef.options) {
			const opts = propDef.options as Record<string, unknown>;
			if (Array.isArray(opts.options)) {
				return {
					options: (opts.options as Array<Record<string, unknown>>).map(
						(o) => ({
							label: String(o.label ?? o.value ?? ""),
							value: o.value,
						}),
					),
				};
			}
		}
		return { options: [] };
	}

	// If options is a function, call it to resolve dynamic options
	if (typeof optionsField === "function") {
		try {
			const result = await (optionsField as Function)({
				auth,
				...currentValues,
			});
			if (result && typeof result === "object" && Array.isArray((result as Record<string, unknown>).options)) {
				return {
					options: ((result as Record<string, unknown>).options as Array<Record<string, unknown>>).map(
						(o) => ({
							label: String(o.label ?? o.value ?? ""),
							value: o.value,
						}),
					),
				};
			}
		} catch (err) {
			console.error(
				`Failed to resolve dynamic options for ${pieceName}/${actionName}/${propertyName}:`,
				err,
			);
		}
	}

	return { options: [] };
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
	// Activepieces Piece class exposes actions as a method: piece.actions() → Record<string, Action>
	const actionsObj =
		typeof p.actions === "function"
			? (p.actions as () => Record<string, unknown>)()
			: (p.actions as Record<string, unknown> | undefined);
	if (!actionsObj) {
		throw new Error(`Piece "${pieceName}" has no actions`);
	}

	const action = actionsObj[actionName] as Record<string, unknown> | undefined;
	if (!action) {
		throw new Error(
			`Action "${actionName}" not found in piece "${pieceName}"`,
		);
	}

	const props = extractPropsFromObject(action.props);
	actionPropsCache.set(cacheKey, props);
	return props;
}
