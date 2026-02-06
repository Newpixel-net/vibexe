"use client";

/**
 * DashboardPanel Component
 *
 * Main dashboard panel combining sidebar navigation and content area.
 * Code section uses CodePanel, other sections show placeholders.
 *
 * Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/components/dashboard-panel.tsx
 */

import { useState } from "react";
import { DashboardSidebar, type DashboardSection } from "./dashboard-sidebar";
import { CodePanel } from "./code-panel";
import type { AppFile } from "../adapters/file-adapter";

interface DashboardPanelProps {
  /** App ID for API calls */
  appId: string;
  /** All files for the app */
  files: AppFile[];
  /** Currently selected file ID (null if none) */
  selectedFileId: string | null;
  /** Callback when file selection changes */
  onFileSelect: (fileId: string | null) => void;
  /** Callback when file content is updated */
  onFileUpdate: (fileId: string, content: string) => void;
}

/**
 * Section titles for placeholder content
 */
const sectionTitles: Record<DashboardSection, string> = {
  overview: "Overview",
  users: "Users",
  data: "Data",
  analytics: "Analytics",
  domains: "Domains",
  integrations: "Integrations",
  security: "Security",
  code: "Code",
  agents: "Agents",
  automations: "Automations",
  logs: "Logs",
  api: "API",
  settings: "Settings",
};

/**
 * Section descriptions for placeholder content
 */
const sectionDescriptions: Record<DashboardSection, string> = {
  overview: "View your app's health, metrics, and recent activity at a glance.",
  users: "Manage user accounts, permissions, and authentication settings.",
  data: "Browse and manage your app's database tables and records.",
  analytics: "Track usage metrics, performance, and user behavior.",
  domains: "Configure custom domains and SSL certificates for your app.",
  integrations: "Connect third-party services and manage webhooks.",
  security: "Review security settings, access logs, and API keys.",
  code: "Browse and edit your app's source code files.",
  agents: "Configure AI agents and their capabilities.",
  automations: "Set up automated workflows and triggers.",
  logs: "View application logs and debug issues.",
  api: "Explore your app's API endpoints and documentation.",
  settings: "Configure app-level settings and preferences.",
};

/**
 * Placeholder component for sections not yet implemented
 */
function SectionPlaceholder({ section }: { section: DashboardSection }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <h2 className="text-2xl font-semibold text-foreground mb-2">
        {sectionTitles[section]}
      </h2>
      <p className="text-muted-foreground max-w-md">
        {sectionDescriptions[section]}
      </p>
      <div className="mt-6 px-4 py-2 rounded-md bg-muted text-sm text-muted-foreground">
        Coming soon
      </div>
    </div>
  );
}

/**
 * DashboardPanel - Sidebar navigation + content area
 *
 * Layout:
 * - Left: DashboardSidebar (200px fixed width)
 * - Right: Content area (flex-1)
 *
 * Behavior:
 * - Code section renders CodePanel with file explorer and editor
 * - Other sections render placeholder with title and description
 * - Internal section state (not lifted to parent)
 */
export function DashboardPanel({
  appId,
  files,
  selectedFileId,
  onFileSelect,
  onFileUpdate,
}: DashboardPanelProps) {
  const [activeSection, setActiveSection] =
    useState<DashboardSection>("overview");

  return (
    <div className="flex h-full min-h-0">
      <DashboardSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <div className="flex-1 min-w-0">
        {activeSection === "code" ? (
          <CodePanel
            appId={appId}
            files={files}
            selectedFileId={selectedFileId}
            onFileSelect={onFileSelect}
            onFileUpdate={onFileUpdate}
          />
        ) : (
          <SectionPlaceholder section={activeSection} />
        )}
      </div>
    </div>
  );
}

export type { DashboardSection };
