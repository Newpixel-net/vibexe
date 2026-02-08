/**
 * Core execution function: Executes an Activepieces piece action.
 *
 * Execution order:
 *   1. Try built-in implementation (direct API calls, no npm packages needed)
 *   2. Fall back to loading the @activepieces/piece-* npm package
 */

import { tryBuiltInExecution } from "./built-in-pieces";
import { buildActionContext, type StoreAdapter } from "./context-builder";
import { loadPiece } from "./piece-registry";

export interface ExecutePieceActionArgs {
	pieceName: string;
	actionName: string;
	pieceVersion: string;
	properties: Record<string, unknown>;
	auth: unknown;
	store?: StoreAdapter;
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

	const actions = (piece as Record<string, unknown>).actions;
	if (!actions || typeof actions !== "object") {
		throw new Error(`Piece "${args.pieceName}" has no actions`);
	}

	const action = (actions as Record<string, unknown>)[args.actionName];
	if (!action || typeof action !== "object") {
		throw new Error(
			`Action "${args.actionName}" not found in piece "${args.pieceName}"`,
		);
	}

	const runFn = (action as Record<string, unknown>).run;
	if (typeof runFn !== "function") {
		throw new Error(
			`Action "${args.actionName}" in piece "${args.pieceName}" has no run function`,
		);
	}

	const context = buildActionContext({
		auth: args.auth,
		propsValue: args.properties,
		store: args.store,
	});

	const result = await runFn(context);
	return result;
}
