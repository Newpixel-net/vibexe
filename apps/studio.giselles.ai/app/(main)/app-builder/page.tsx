// giselle-integration/pages/app-builder/page.tsx
// App Builder List Page
//
// Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/page.tsx
//
// Shows all apps for the current user's team with a create button.
// Uses Giselle's auth pattern with getUser() from @/lib/supabase/get-user.

import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/supabase/get-user";
import { db } from "@/db";
import { teamMemberships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAppsForTeam, createApp } from "./lib/queries";
import { Plus, Folder, Clock } from "lucide-react";

export default async function AppBuilderPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  // Get user's team membership to find teamDbId
  // Giselle uses teamMemberships table to link users to teams
  const membership = await db.query.teamMemberships.findFirst({
    where: eq(teamMemberships.userDbId, user.dbId),
    with: {
      team: true,
    },
  });

  if (!membership) {
    // User has no team - this shouldn't happen in normal flow
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
  const apps = await getAppsForTeam(teamDbId);

  // Server action for creating a new app
  async function handleCreateApp() {
    "use server";
    const user = await getUser();
    if (!user) redirect("/login");

    // Re-fetch membership in server action context
    const membership = await db.query.teamMemberships.findFirst({
      where: eq(teamMemberships.userDbId, user.dbId),
    });

    if (!membership) redirect("/app-builder");

    const app = await createApp(
      membership.teamDbId,
      user.dbId,
      "Untitled App"
    );
    redirect(`/app-builder/${app.id}`);
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">App Builder</h1>
          <p className="text-muted-foreground">
            Create and manage your AI-generated applications
          </p>
        </div>
        <form action={handleCreateApp}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New App
          </button>
        </form>
      </div>

      {apps.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-lg">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No apps yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first app to get started
          </p>
          <form action={handleCreateApp}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create App
            </button>
          </form>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/app-builder/${app.id}`}
              className="block p-4 border rounded-lg hover:border-primary transition-colors bg-card"
            >
              <h3 className="font-medium mb-1">{app.name}</h3>
              {app.description && (
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {app.description}
                </p>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(app.updatedAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
