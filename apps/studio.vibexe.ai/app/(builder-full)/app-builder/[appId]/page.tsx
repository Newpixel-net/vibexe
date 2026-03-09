// Individual App Builder Page (Server Component)
// Full-screen mode without Vibexe sidebar
//
// Deploy to: /opt/vibexe/apps/studio.vibexe.ai/app/(builder-full)/app-builder/[appId]/page.tsx

import { notFound, redirect } from "next/navigation";
import {
	getAppById,
	getFilesForApp,
} from "@/app/(main)/app-builder/lib/queries";
import { getUser } from "@/lib/auth/get-user";
import { PageClient } from "./page.client";

interface Props {
	params: Promise<{ appId: string }>;
}

export default async function AppBuilderAppPage({ params }: Props) {
	const { appId } = await params;

	const user = await getUser();
	if (!user) redirect("/login");

	const app = await getAppById(appId, user.dbId);
	if (!app) notFound();

	const files = await getFilesForApp(appId);

	// Convert to the shape expected by BuilderLayout
	const appData = {
		id: app.id,
		name: app.name,
		projectType: app.projectType ?? "app",
	};

	const fileData = files.map((f) => ({
		id: f.id,
		path: f.path,
		content: f.content,
		language: f.language,
	}));

	return <PageClient app={appData} files={fileData} />;
}
