/**
 * Entity Hooks
 *
 * Runs user functions triggered by entity mutations (beforeCreate, afterCreate, etc.).
 * "before" hooks can modify data or throw to abort the operation.
 * "after" hooks are fire-and-forget (errors logged, don't block response).
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { builderAppFunctions } from "@/db/schema";
import { executeFunction, loadFunctionSource } from "./runner";
import type { AppUser } from "@/lib/app-database/rls";

export type HookType =
	| "beforeCreate"
	| "afterCreate"
	| "beforeUpdate"
	| "afterUpdate"
	| "beforeDelete"
	| "afterDelete";

export interface RunEntityHookOpts {
	databaseName: string;
	appDbId: number;
	appId: string;
	entity: string;
	hookType: HookType;
	data: Record<string, unknown>;
	existing?: Record<string, unknown>;
	user?: AppUser | null;
}

export interface HookResult {
	/** Modified data (from "before" hooks) */
	data?: Record<string, unknown>;
	/** If set, abort the operation with this error message */
	abort?: string;
}

// ---- Recursion guard ----
// Uses AsyncLocalStorage so hook depth is tracked per-request, preventing
// false positives when concurrent requests trigger the same entity hook.
const hookDepthStorage = new AsyncLocalStorage<Map<string, number>>();
const MAX_HOOK_DEPTH = 3;

/**
 * Run an entity hook if one is registered for this entity + hookType.
 *
 * Returns the original data unchanged if no hook is registered.
 * For "before" hooks: returns modified data or abort signal.
 * For "after" hooks: fires and forgets, returns immediately.
 */
export async function runEntityHook(opts: RunEntityHookOpts): Promise<HookResult> {
	const isBefore = opts.hookType.startsWith("before");

	// Get or create per-request depth map
	let depthMap = hookDepthStorage.getStore();
	const isTopLevel = !depthMap;
	if (!depthMap) {
		depthMap = new Map<string, number>();
	}

	const depthKey = `${opts.appDbId}:${opts.entity}:${opts.hookType}`;
	const currentDepth = depthMap.get(depthKey) ?? 0;
	if (currentDepth >= MAX_HOOK_DEPTH) {
		console.warn(`[Entity Hook] Max depth (${MAX_HOOK_DEPTH}) reached for ${depthKey}, skipping to prevent infinite loop`);
		return { data: opts.data };
	}
	depthMap.set(depthKey, currentDepth + 1);

	const run = async (): Promise<HookResult> => {
		try {
			return await _runEntityHookInner(opts, isBefore);
		} finally {
			const dm = hookDepthStorage.getStore() ?? depthMap;
			const depth = dm.get(depthKey) ?? 1;
			if (depth <= 1) {
				dm.delete(depthKey);
			} else {
				dm.set(depthKey, depth - 1);
			}
		}
	};

	// Top-level call: enter AsyncLocalStorage context
	if (isTopLevel) {
		return hookDepthStorage.run(depthMap, run);
	}
	return run();
}

async function _runEntityHookInner(opts: RunEntityHookOpts, isBefore: boolean): Promise<HookResult> {
	const { databaseName, appDbId, appId, entity, hookType, data, existing, user } = opts;

	// Find matching function
	const functions = await db.query.builderAppFunctions.findMany({
		where: and(
			eq(builderAppFunctions.appDbId, appDbId),
			eq(builderAppFunctions.triggerType, "entity_hook"),
			eq(builderAppFunctions.enabled, true),
		),
	});

	// Filter by trigger_config matching entity + hook
	const matchingFn = functions.find((fn) => {
		const config = fn.triggerConfig as Record<string, unknown> | null;
		return config?.entity === entity && config?.hook === hookType;
	});

	if (!matchingFn) {
		// No hook registered — return data unchanged
		return { data };
	}

	// Load source
	const source = await loadFunctionSource(appDbId, matchingFn.filePath);
	if (!source) {
		// Source file missing — skip hook
		console.warn(`[Entity Hook] Source file '${matchingFn.filePath}' not found, skipping hook`);
		return { data };
	}

	const executeHook = async (): Promise<HookResult> => {
		try {
			const result = await executeFunction({
				appId,
				appDbId,
				databaseName,
				source,
				timeoutMs: matchingFn.timeoutMs ?? 10000,
				user,
				entity,
				record: existing,
				hookData: data,
				hookType,
			});

			// Update run stats (fire-and-forget)
			db.update(builderAppFunctions)
				.set({
					lastRunAt: new Date(),
					runCount: (matchingFn.runCount ?? 0) + 1,
					lastError: null,
				})
				.where(eq(builderAppFunctions.dbId, matchingFn.dbId))
				.catch(() => {});

			if (isBefore) {
				// "before" hook can return modified data
				if (result.result && typeof result.result === "object" && !Array.isArray(result.result)) {
					return { data: result.result as Record<string, unknown> };
				}
				return { data };
			}

			return { data };
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : "Hook execution failed";

			// Update error stats (fire-and-forget)
			db.update(builderAppFunctions)
				.set({
					lastRunAt: new Date(),
					errorCount: (matchingFn.errorCount ?? 0) + 1,
					lastError: errMsg,
				})
				.where(eq(builderAppFunctions.dbId, matchingFn.dbId))
				.catch(() => {});

			if (isBefore) {
				// "before" hook errors abort the operation
				return { abort: errMsg };
			}

			// "after" hook errors are logged but don't abort
			console.error(`[Entity Hook] ${hookType} error on ${entity}:`, errMsg);
			return { data };
		}
	};

	if (isBefore) {
		// "before" hooks run synchronously (caller awaits result)
		return executeHook();
	}

	// "after" hooks are fire-and-forget
	executeHook().catch((err) => {
		console.error(`[Entity Hook] ${hookType} fire-and-forget error:`, err);
	});
	return { data };
}
