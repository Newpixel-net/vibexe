"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function revokeSessionAction(
	sessionId: number,
): Promise<{ success: boolean; error?: string }> {
	try {
		await requireAdmin();
	} catch {
		return { success: false, error: "Unauthorized" };
	}

	await db
		.update(sessions)
		.set({ expiresAt: new Date() })
		.where(eq(sessions.id, sessionId));

	revalidatePath("/admin/sessions");
	return { success: true };
}

export async function revokeAllUserSessionsAction(
	userId: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		await requireAdmin();
	} catch {
		return { success: false, error: "Unauthorized" };
	}

	await db
		.update(sessions)
		.set({ expiresAt: new Date() })
		.where(eq(sessions.userId, userId));

	revalidatePath("/admin/sessions");
	return { success: true };
}
