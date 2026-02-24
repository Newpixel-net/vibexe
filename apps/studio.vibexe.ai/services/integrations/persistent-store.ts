import { and, eq } from "drizzle-orm";
import { db, integrationStore } from "@/db";
import type { StoreAdapter } from "@vibexe-ai/activepieces-adapter/server";

/**
 * Create a persistent store adapter scoped to a team.
 * Uses PostgreSQL integration_store table for persistence across runs.
 */
export function createPersistentStore(teamDbId: number): StoreAdapter {
	return {
		async get(key: string): Promise<unknown> {
			const rows = await db
				.select()
				.from(integrationStore)
				.where(
					and(
						eq(integrationStore.teamDbId, teamDbId),
						eq(integrationStore.storeKey, key),
					),
				)
				.limit(1);

			if (rows.length === 0) return null;
			const value = rows[0].value;
			if (value === null) return null;
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		},

		async put(key: string, value: unknown): Promise<void> {
			const serialized =
				typeof value === "string" ? value : JSON.stringify(value);

			// Upsert: try insert first, fall back to update on conflict.
			// This avoids the TOCTOU race of update-then-insert where two concurrent
			// requests could both see 0 updated rows and both try to insert.
			try {
				await db.insert(integrationStore).values({
					teamDbId,
					storeKey: key,
					value: serialized,
				});
			} catch {
				// Row already exists — update it
				await db
					.update(integrationStore)
					.set({ value: serialized })
					.where(
						and(
							eq(integrationStore.teamDbId, teamDbId),
							eq(integrationStore.storeKey, key),
						),
					);
			}
		},

		async delete(key: string): Promise<void> {
			await db
				.delete(integrationStore)
				.where(
					and(
						eq(integrationStore.teamDbId, teamDbId),
						eq(integrationStore.storeKey, key),
					),
				);
		},
	};
}
