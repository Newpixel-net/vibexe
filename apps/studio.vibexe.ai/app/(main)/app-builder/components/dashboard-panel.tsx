"use client";

/**
 * DashboardPanel Component
 *
 * Main dashboard panel combining sidebar navigation and content area.
 * Settings section has 3 sub-items: App Settings, Authentication, App Template.
 */

import { useEffect, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";
import { AgentsPanel } from "./agents-panel";
import { AnalyticsPanel } from "./analytics-panel";
import { BackupsPanel } from "./backups-panel";
import { ApiDocsPanel } from "./api-docs-panel";
import { AuthenticationPanel } from "./authentication-panel";
import { BackendSettings } from "./backend-settings";
import { ExportPanel } from "./export-panel";
import { AppTemplatePanel } from "./app-template-panel";
import { WebhooksPanel } from "./automations-panel";
import { CodePanel } from "./code-panel";
import { type DashboardSection, DashboardSidebar } from "./dashboard-sidebar";
import { DataBrowser } from "./data-browser";
import { DomainsPanel } from "./domains-panel";
import { EnvironmentsPanel } from "./environments-panel";
import { IntegrationsPanel } from "./integrations-panel";
import { JobsPanel } from "./jobs-panel";
import { LogsPanel } from "./logs-panel";
import { OverviewPanel } from "./overview-panel";
import { SecurityPanel } from "./security-panel";
import { SettingsPanel } from "./settings-panel";
import { StoragePanel } from "./storage-panel";
import { UsersPanel } from "./users-panel";

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

export function DashboardPanel({
	appId,
	files,
	selectedFileId,
	onFileSelect,
	onFileUpdate,
}: DashboardPanelProps) {
	const [activeSection, setActiveSection] =
		useState<DashboardSection>("overview");

	// Fetch app schema for data browser + API docs + overview
	const [schema, setSchema] = useState<{
		entities: Array<{
			name: string;
			tableName: string;
			fields: Array<{ name: string; type: string; required?: boolean }>;
		}>;
	} | null>(null);

	useEffect(() => {
		async function fetchSchema() {
			try {
				const res = await fetch(`/api/apps/${appId}/schema`);
				if (res.ok) {
					const data = await res.json();
					setSchema(data.schema);
				}
			} catch {
				// Schema not available yet
			}
		}
		fetchSchema();
	}, [appId]);

	const renderContent = () => {
		switch (activeSection) {
			case "overview":
				return (
					<OverviewPanel
						appId={appId}
						files={files}
						schema={schema}
						onNavigate={(section) =>
							setActiveSection(section as DashboardSection)
						}
					/>
				);
			case "code":
				return (
					<CodePanel
						appId={appId}
						files={files}
						selectedFileId={selectedFileId}
						onFileSelect={onFileSelect}
						onFileUpdate={onFileUpdate}
					/>
				);
			case "data":
				return <DataBrowser appId={appId} schema={schema} />;
			case "storage":
				return <StoragePanel appId={appId} />;
			case "environments":
				return <EnvironmentsPanel appId={appId} />;
			case "backups":
				return <BackupsPanel appId={appId} />;
			case "users":
				return <UsersPanel appId={appId} />;
			case "agents":
				return <AgentsPanel appId={appId} />;
			case "automations":
				return <WebhooksPanel appId={appId} schema={schema} />;
			case "jobs":
				return <JobsPanel appId={appId} />;
			case "analytics":
				return <AnalyticsPanel appId={appId} files={files} />;
			case "domains":
				return <DomainsPanel appId={appId} />;
			case "integrations":
				return <IntegrationsPanel appId={appId} />;
			case "security":
				return <SecurityPanel appId={appId} />;
			case "logs":
				return <LogsPanel appId={appId} />;
			case "api":
				return <ApiDocsPanel appId={appId} schema={schema} />;
			case "settings":
			case "settings-app":
				return <SettingsPanel appId={appId} />;
			case "settings-auth":
				return <AuthenticationPanel appId={appId} />;
			case "settings-backend":
				return <BackendSettings appId={appId} />;
			case "settings-export":
				return <ExportPanel appId={appId} />;
			case "settings-template":
				return <AppTemplatePanel appId={appId} />;
		}
	};

	return (
		<div className="flex h-full min-h-0">
			<DashboardSidebar
				activeSection={activeSection}
				onSectionChange={setActiveSection}
			/>
			<div className="flex-1 min-w-0 min-h-0 overflow-y-auto backdrop-blur-xl bg-white/[0.02]">{renderContent()}</div>
		</div>
	);
}

export type { DashboardSection };
