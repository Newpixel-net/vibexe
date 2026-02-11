/**
 * Core execution function: Executes an Activepieces piece action.
 *
 * Execution order:
 *   1. Try built-in implementation (direct API calls, no npm packages needed)
 *   2. Fall back to loading the @activepieces/piece-* npm package
 */

import { tryBuiltInExecution } from "./built-in-pieces";
import {
	buildActionContext,
	type ConnectionResolver,
	type StoreAdapter,
} from "./context-builder";
import { loadPiece } from "./piece-registry";
import { resolveProperties, type PropertyType } from "./property-resolver";

const DEFAULT_TIMEOUT_MS = 60_000;

export interface ExecutePieceActionArgs {
	pieceName: string;
	actionName: string;
	pieceVersion: string;
	properties: Record<string, unknown>;
	auth: unknown;
	store?: StoreAdapter;
	connectionResolver?: ConnectionResolver;
	serverUrl?: string;
	timeoutMs?: number;
}

/**
 * Execute an Activepieces piece action.
 *
 * @returns The action result (varies by piece/action)
 */
export async function executePieceAction(
	args: ExecutePieceActionArgs,
): Promise<unknown> {
	// 1. Try built-in implementation first (YouTube, HTTP, etc.)
	const builtIn = await tryBuiltInExecution({
		pieceName: args.pieceName,
		actionName: args.actionName,
		properties: args.properties,
		auth: args.auth,
	});
	if (builtIn !== undefined) {
		return builtIn.result;
	}

	// 2. Fall back to loading the Activepieces npm package
	const piece = await loadPiece(args.pieceName);
	if (!piece || typeof piece !== "object") {
		throw new Error(`Failed to load piece: ${args.pieceName}`);
	}

	// Activepieces Piece class exposes actions as a method: piece.actions() → Record<string, Action>
	const p = piece as Record<string, unknown>;
	const actions =
		typeof p.actions === "function"
			? (p.actions as () => Record<string, unknown>)()
			: (p.actions as Record<string, unknown> | undefined);
	if (!actions || typeof actions !== "object") {
		throw new Error(`Piece "${args.pieceName}" has no actions`);
	}

	const action = actions[args.actionName];
	if (!action || typeof action !== "object") {
		throw new Error(
			`Action "${args.actionName}" not found in piece "${args.pieceName}"`,
		);
	}

	const actionObj = action as Record<string, unknown>;
	const runFn = actionObj.run;
	if (typeof runFn !== "function") {
		throw new Error(
			`Action "${args.actionName}" in piece "${args.pieceName}" has no run function`,
		);
	}

	// Resolve property types (NUMBER→number, CHECKBOX→boolean, JSON→parsed, etc.)
	let resolvedProps = args.properties;
	if (actionObj.props && typeof actionObj.props === "object") {
		const propDefs: Record<string, { type: PropertyType }> = {};
		for (const [key, prop] of Object.entries(
			actionObj.props as Record<string, unknown>,
		)) {
			if (prop && typeof prop === "object" && "type" in prop) {
				propDefs[key] = { type: (prop as { type: PropertyType }).type };
			}
		}
		if (Object.keys(propDefs).length > 0) {
			resolvedProps = resolveProperties(propDefs, args.properties);
		}
	}

	const context = buildActionContext({
		auth: args.auth,
		propsValue: resolvedProps,
		store: args.store,
		connectionResolver: args.connectionResolver,
		serverUrl: args.serverUrl,
	});

	// Execute with timeout to prevent hung integrations
	const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const result = await Promise.race([
		runFn(context),
		new Promise<never>((_, reject) =>
			setTimeout(
				() =>
					reject(
						new Error(
							`Integration "${args.pieceName}/${args.actionName}" timed out after ${timeoutMs / 1000}s`,
						),
					),
				timeoutMs,
			),
		),
	]);
	return result;
}
