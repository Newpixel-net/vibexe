"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { teams, type TeamPlan } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const VALID_PLANS: TeamPlan[] = [
	"free",
	"pro",
	"team",
	"enterprise",
	"internal",
];

export async function changeTeamPlanAction(
	teamDbId: number,
	newPlan: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		await requireAdmin();
	} catch {
		return { success: false, error: "Unauthorized" };
	}

	if (!VALID_PLANS.includes(newPlan as TeamPlan)) {
		return { success: false, error: `Invalid plan: ${newPlan}` };
	}

	await db
		.update(teams)
		.set({ plan: newPlan as TeamPlan })
		.where(eq(teams.dbId, teamDbId));

	revalidatePath("/admin/teams");
	return { success: true };
}
