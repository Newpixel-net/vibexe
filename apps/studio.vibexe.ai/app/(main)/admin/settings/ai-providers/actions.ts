"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { deleteProviderKey, upsertProviderKey } from "@/lib/ai-provider-keys";

export type ActionState = {
	success: boolean;
	error?: string;
};

export async function saveProviderKeyAction(
	_prevState: ActionState | undefined,
	formData: FormData,
): Promise<ActionState> {
	try {
		await requireAdmin();
		const provider = formData.get("provider") as string;
		const apiKey = formData.get("apiKey") as string;

		if (!provider || !apiKey) {
			return { success: false, error: "Provider and API key are required" };
		}

		await upsertProviderKey(provider, apiKey.trim());
		revalidatePath("/admin/settings/ai-providers");
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to save key",
		};
	}
}

export async function deleteProviderKeyAction(
	_prevState: ActionState | undefined,
	formData: FormData,
): Promise<ActionState> {
	try {
		await requireAdmin();
		const provider = formData.get("provider") as string;

		if (!provider) {
			return { success: false, error: "Provider is required" };
		}

		await deleteProviderKey(provider);
		revalidatePath("/admin/settings/ai-providers");
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to delete key",
		};
	}
}
