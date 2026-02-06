// Individual App Builder Page (Server Component)
// Full-screen mode without Giselle sidebar
//
// Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(builder-full)/app-builder/[appId]/page.tsx

import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/get-user";
import { getAppById, getFilesForApp } from "@/app/(main)/app-builder/lib/queries";
import { PageClient } from "./page.client";

interface Props {
  params: Promise<{ appId: string }>;
}

export default async function AppBuilderAppPage({ params }: Props) {
  const { appId } = await params;

  const user = await getUser();
  if (!user) redirect("/login");

  const app = await getAppById(appId, user.id);
  if (!app) notFound();

  const files = await getFilesForApp(appId);

  // Convert to the shape expected by BuilderLayout
  const appData = {
    id: app.id,
    name: app.name,
  };

  const fileData = files.map((f) => ({
    id: f.id,
    path: f.path,
    content: f.content,
    language: f.language,
  }));

  return <PageClient app={appData} files={fileData} />;
}
