import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { teamMemberships } from "@/db/schema";
import { getUser } from "@/lib/auth/get-user";
import { listTeamTemplatesAdmin } from "../lib/template-queries";
import { TEMPLATE_CATEGORIES } from "../lib/template-constants";
import { TemplatesAdminClient } from "./templates-admin-client";

export default async function TemplatesAdminPage() {
	const user = await getUser();
	if (!user) redirect("/login");

	const membership = await db.query.teamMemberships.findFirst({
		where: eq(teamMemberships.userDbId, user.dbId),
		with: { team: true },
	});

	if (!membership) {
		return (
			<div className="container mx-auto py-8 px-4">
				<div className="text-center py-16">
					<h1 className="text-2xl font-bold mb-4">No Team Found</h1>
					<p className="text-muted-foreground">
						You need to be part of a team to manage templates.
					</p>
				</div>
			</div>
		);
	}

	const templates = await listTeamTemplatesAdmin(membership.teamDbId);

	return (
		<TemplatesAdminClient
			templates={templates}
			categories={[...TEMPLATE_CATEGORIES]}
		/>
	);
}
