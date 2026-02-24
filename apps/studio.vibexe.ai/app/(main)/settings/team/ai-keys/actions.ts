"use server";

import { revalidatePath } from "next/cache";
import {
	deleteTeamProviderKey,
	upsertTeamProviderKey,
} from "@/lib/team-ai-provider-keys";
import { fetchCurrentTeam } from "@/services/teams";

export type ActionState = {
	success: boolean;
	error?: string;
};

export async function saveTeamProviderKeyAction(
	_prevState: ActionState | undefined,
	formData: FormData,
): Promise<ActionState> {
	try {
		const team = await fetchCurrentTeam();
		const provider = formData.get("provider") as string;
		const apiKey = formData.get("apiKey") as string;

		if (!provider || !apiKey) {
			return { success: false, error: "Provider and API key are required" };
		}

		await upsertTeamProviderKey(team.dbId, provider, apiKey.trim());
		revalidatePath("/settings/team/ai-keys");
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to save key",
		};
	}
}

export async function deleteTeamProviderKeyAction(
	_prevState: ActionState | undefined,
	formData: FormData,
): Promise<ActionState> {
	try {
		const team = await fetchCurrentTeam();
		const provider = formData.get("provider") as string;

		if (!provider) {
			return { success: false, error: "Provider is required" };
		}

		await deleteTeamProviderKey(team.dbId, provider);
		revalidatePath("/settings/team/ai-keys");
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to delete key",
		};
	}
}
