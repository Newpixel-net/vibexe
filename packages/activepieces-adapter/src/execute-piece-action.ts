/**
 * Core execution function: Executes an Activepieces piece action.
 *
 * This is the main bridge between Giselle and Activepieces.
 * It loads a piece, finds the action, builds the context, and runs it.
 */

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
	// Load the piece
	const piece = await loadPiece(args.pieceName);
	if (!piece || typeof piece !== "object") {
		throw new Error(`Failed to load piece: ${args.pieceName}`);
	}

	// Find the action
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

	// Build context
	const context = buildActionContext({
		auth: args.auth,
		propsValue: args.properties,
		store: args.store,
	});

	// Execute the action
	const result = await runFn(context);
	return result;
}
