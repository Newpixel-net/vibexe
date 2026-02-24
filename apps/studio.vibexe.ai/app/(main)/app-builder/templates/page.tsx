import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { teamMemberships } from "@/db/schema";
import { getUser } from "@/lib/auth/get-user";
import { listTemplates } from "../lib/template-queries";
import { TEMPLATE_CATEGORIES } from "../lib/template-constants";
import { TemplateGallery } from "./template-gallery";

export default async function TemplatesPage() {
	const user = await getUser();
	if (!user) redirect("/login");

	const membership = await db.query.teamMemberships.findFirst({
		where: eq(teamMemberships.userDbId, user.dbId),
	});

	const teamDbId = membership?.teamDbId;

	const { templates, total } = await listTemplates({
		teamDbId,
		limit: 50,
	});

	return (
		<TemplateGallery
			templates={templates}
			categories={[...TEMPLATE_CATEGORIES]}
			totalCount={total}
		/>
	);
}
