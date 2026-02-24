import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { teamMemberships } from "@/db/schema";
import { getUser } from "@/lib/auth/get-user";
import { AppBuilderList } from "./components/app-builder-list";
import { createApp } from "./lib/queries";
import { getAppsForTeamGrouped, createProject } from "./lib/project-queries";

export default async function AppBuilderPage() {
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
						You need to be part of a team to use the App Builder.
					</p>
				</div>
			</div>
		);
	}

	const teamDbId = membership.teamDbId;
	const { projects, unorganizedApps } = await getAppsForTeamGrouped(teamDbId);

	async function handleCreateApp() {
		"use server";
		const user = await getUser();
		if (!user) redirect("/login");
		const membership = await db.query.teamMemberships.findFirst({
			where: eq(teamMemberships.userDbId, user.dbId),
		});
		if (!membership) redirect("/app-builder");
		const app = await createApp(membership.teamDbId, user.dbId, "Untitled App");
		redirect(`/app-builder/${app.id}`);
	}

	async function handleCreateProject() {
		"use server";
		const user = await getUser();
		if (!user) redirect("/login");
		const membership = await db.query.teamMemberships.findFirst({
			where: eq(teamMemberships.userDbId, user.dbId),
		});
		if (!membership) redirect("/app-builder");
		await createProject(membership.teamDbId, user.dbId, "Untitled Project");
		redirect("/app-builder");
	}

	return (
		<AppBuilderList
			projects={projects}
			unorganizedApps={unorganizedApps}
			createAppAction={handleCreateApp}
			createProjectAction={handleCreateProject}
		/>
	);
}
