"use server";

import { and, eq } from "drizzle-orm";
import { db, integrationStore } from "@/db";
import type { StoreAdapter } from "@giselles-ai/activepieces-adapter/server";

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

			// Upsert: try update first, insert if not found
			const updated = await db
				.update(integrationStore)
				.set({ value: serialized })
				.where(
					and(
						eq(integrationStore.teamDbId, teamDbId),
						eq(integrationStore.storeKey, key),
					),
				)
				.returning({ dbId: integrationStore.dbId });

			if (updated.length === 0) {
				await db.insert(integrationStore).values({
					teamDbId,
					storeKey: key,
					value: serialized,
				});
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
