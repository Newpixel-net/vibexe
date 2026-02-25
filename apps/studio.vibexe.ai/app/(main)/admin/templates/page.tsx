import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teamMemberships } from "@/db/schema";
import { getUser } from "@/lib/auth/get-user";
import { listTeamTemplatesAdmin } from "@/app/(main)/app-builder/lib/template-queries";
import {
	ALL_CATEGORY_PATHS,
	MAIN_CATEGORIES,
	TEMPLATE_CATEGORY_TREE,
} from "@/app/(main)/app-builder/lib/template-constants";
import { TemplatesAdminClient } from "./templates-admin-client";

export default async function AdminTemplatesPage() {
	const user = await getUser();

	const membership = await db.query.teamMemberships.findFirst({
		where: eq(teamMemberships.userDbId, user!.dbId),
		with: { team: true },
	});

	if (!membership) {
		return (
			<div className="text-center py-16">
				<h1 className="text-2xl font-bold mb-4">No Team Found</h1>
				<p className="text-muted-foreground">
					No team membership found for this admin account.
				</p>
			</div>
		);
	}

	const templates = await listTeamTemplatesAdmin(membership.teamDbId);

	return (
		<TemplatesAdminClient
			templates={templates}
			categories={[...ALL_CATEGORY_PATHS]}
			mainCategories={[...MAIN_CATEGORIES]}
			categoryTree={TEMPLATE_CATEGORY_TREE}
		/>
	);
}
