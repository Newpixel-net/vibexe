"use client";

/**
 * OverviewPanel Component
 *
 * App health dashboard showing key metrics, recent activity, and quick actions.
 * Uses existing data from files array and schema — no new API calls needed.
 */

import {
	Code2,
	Database,
	FileCode2,
	Key,
	Users,
	Activity,
	ArrowRight,
	Clock,
	Globe,
	Lock,
	Link2,
	Copy,
	Check,
	Send,
	Eye,
	EyeOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";

interface OverviewPanelProps {
	appId: string;
	files: AppFile[];
	schema: {
		entities: Array<{
			name: string;
			tableName: string;
			fields: Array<{ name: string; type: string }>;
		}>;
	} | null;
	onNavigate: (section: string) => void;
}

function StatCard({
	icon: Icon,
	label,
	value,
	onClick,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string | number;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left group"
		>
			<div className="flex items-center justify-between">
				<Icon className="h-5 w-5 text-muted-foreground" />
				{onClick && (
					<ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
				)}
			</div>
			<div>
				<div className="text-2xl font-bold text-foreground">{value}</div>
				<div className="text-xs text-muted-foreground">{label}</div>
			</div>
		</button>
	);
}

export function OverviewPanel({
	appId,
	files,
	schema,
	onNavigate,
}: OverviewPanelProps) {
	// App settings state
	const [visibility, setVisibility] = useState<"public" | "private">("public");
	const [requireLogin, setRequireLogin] = useState(false);
	const [appName, setAppName] = useState("");
	const [appDescription, setAppDescription] = useState("");
	const [saving, setSaving] = useState(false);
	const [copied, setCopied] = useState(false);

	// Fetch app settings
	useEffect(() => {
		async function fetchSettings() {
			try {
				const res = await fetch(`/api/app-builder/apps/${appId}`);
				if (res.ok) {
					const data = await res.json();
					setVisibility(data.visibility || "public");
					setRequireLogin(data.requireLogin || false);
					setAppName(data.name || "");
					setAppDescription(data.description || "");
				}
			} catch {}
		}
		fetchSettings();
	}, [appId]);

	const updateSetting = useCallback(
		async (key: string, value: unknown) => {
			setSaving(true);
			try {
				await fetch(`/api/app-builder/apps/${appId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ [key]: value }),
				});
			} catch {}
			setSaving(false);
		},
		[appId],
	);

	const handleVisibilityChange = useCallback(
		(v: "public" | "private") => {
			setVisibility(v);
			updateSetting("visibility", v);
		},
		[updateSetting],
	);

	const handleRequireLoginToggle = useCallback(() => {
		const next = !requireLogin;
		setRequireLogin(next);
		updateSetting("requireLogin", next);
	}, [requireLogin, updateSetting]);

	const copyInviteLink = useCallback(() => {
		const url = `${window.location.origin}/app-builder/${appId}`;
		navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [appId]);
	const stats = useMemo(() => {
		const sourceFiles = files.filter(
			(f) => f.path !== "Blueprint.md" && !f.path.startsWith("."),
		);
		const entityCount = schema?.entities?.length ?? 0;
		const fieldCount =
			schema?.entities?.reduce((sum, e) => sum + e.fields.length, 0) ?? 0;

		// Group files by extension
		const byExt: Record<string, number> = {};
		for (const f of sourceFiles) {
			const ext = f.path.split(".").pop() || "other";
			byExt[ext] = (byExt[ext] || 0) + 1;
		}

		return {
			totalFiles: sourceFiles.length,
			entityCount,
			fieldCount,
			hasBlueprint: files.some((f) => f.path === "Blueprint.md"),
			byExtension: byExt,
		};
	}, [files, schema]);

	// Recent files (last 5 modified)
	const recentFiles = useMemo(() => {
		return [...files]
			.filter((f) => f.path !== "Blueprint.md")
			.slice(0, 8);
	}, [files]);

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-4xl mx-auto space-y-8">
				{/* Header with app name */}
				<div>
					<h1 className="text-2xl font-bold text-foreground">
						{appName || "Overview"}
					</h1>
					{appDescription && (
						<p className="text-sm text-muted-foreground mt-1">
							{appDescription}
						</p>
					)}
					{!appDescription && (
						<p className="text-sm text-muted-foreground mt-1">
							Your app at a glance
						</p>
					)}
				</div>

				{/* App Visibility + Invite Users */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{/* App Visibility */}
					<div className="rounded-lg border border-border bg-card p-4">
						<div className="flex items-center justify-between mb-3">
							<div>
								<h3 className="text-sm font-medium text-foreground">
									App Visibility
								</h3>
								<p className="text-xs text-muted-foreground mt-0.5">
									Control who can access your application
								</p>
							</div>
						</div>
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<select
									value={visibility}
									onChange={(e) =>
										handleVisibilityChange(
											e.target.value as "public" | "private",
										)
									}
									className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								>
									<option value="public">Public</option>
									<option value="private">Private</option>
								</select>
								{visibility === "public" ? (
									<Globe className="h-4 w-4 text-green-500" />
								) : (
									<Lock className="h-4 w-4 text-yellow-500" />
								)}
							</div>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={requireLogin}
									onChange={handleRequireLoginToggle}
									className="rounded border-border"
								/>
								<span className="text-sm text-muted-foreground">
									Require login to access
								</span>
							</label>
						</div>
					</div>

					{/* Invite Users */}
					<div className="rounded-lg border border-border bg-card p-4">
						<div className="flex items-center justify-between mb-3">
							<div>
								<h3 className="text-sm font-medium text-foreground">
									Invite Users
								</h3>
								<p className="text-xs text-muted-foreground mt-0.5">
									Grow your user base by inviting others
								</p>
							</div>
							<Link2 className="h-4 w-4 text-muted-foreground" />
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={copyInviteLink}
								className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
							>
								{copied ? (
									<Check className="h-3.5 w-3.5 text-green-500" />
								) : (
									<Copy className="h-3.5 w-3.5" />
								)}
								{copied ? "Copied!" : "Copy Link"}
							</button>
							<button
								type="button"
								className="flex items-center gap-2 px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
							>
								<Send className="h-3.5 w-3.5" />
								Send Invites
							</button>
						</div>
					</div>
				</div>

				{/* Stats Grid */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<StatCard
						icon={FileCode2}
						label="Source Files"
						value={stats.totalFiles}
						onClick={() => onNavigate("code")}
					/>
					<StatCard
						icon={Database}
						label="Entities"
						value={stats.entityCount}
						onClick={() => onNavigate("data")}
					/>
					<StatCard
						icon={Key}
						label="API Endpoints"
						value={stats.entityCount > 0 ? stats.entityCount * 5 : 0}
						onClick={() => onNavigate("api")}
					/>
					<StatCard
						icon={Users}
						label="Auth Tables"
						value={stats.entityCount > 0 ? 2 : 0}
						onClick={() => onNavigate("users")}
					/>
				</div>

				{/* Two columns */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* Recent Files */}
					<div className="rounded-lg border border-border bg-card">
						<div className="flex items-center justify-between p-4 border-b border-border">
							<h3 className="text-sm font-medium text-foreground">
								Project Files
							</h3>
							<button
								type="button"
								onClick={() => onNavigate("code")}
								className="text-xs text-muted-foreground hover:text-foreground transition-colors"
							>
								View all
							</button>
						</div>
						<div className="divide-y divide-border">
							{recentFiles.length === 0 ? (
								<div className="p-4 text-sm text-muted-foreground text-center">
									No files yet. Start generating!
								</div>
							) : (
								recentFiles.map((file) => (
									<div
										key={file.id}
										className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
									>
										<Code2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
										<span className="text-sm text-foreground truncate">
											{file.path}
										</span>
										<span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
											{file.language}
										</span>
									</div>
								))
							)}
						</div>
					</div>

					{/* Schema Overview */}
					<div className="rounded-lg border border-border bg-card">
						<div className="flex items-center justify-between p-4 border-b border-border">
							<h3 className="text-sm font-medium text-foreground">
								Database Schema
							</h3>
							<button
								type="button"
								onClick={() => onNavigate("data")}
								className="text-xs text-muted-foreground hover:text-foreground transition-colors"
							>
								Browse data
							</button>
						</div>
						<div className="divide-y divide-border">
							{!schema || schema.entities.length === 0 ? (
								<div className="p-4 text-center">
									<Database className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
									<p className="text-sm text-muted-foreground">
										No database yet
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										Ask the AI to build an app with data entities
									</p>
								</div>
							) : (
								schema.entities.map((entity) => (
									<div
										key={entity.name}
										className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
									>
										<div className="flex items-center gap-3">
											<Database className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
											<span className="text-sm text-foreground">
												{entity.name}
											</span>
										</div>
										<span className="text-xs text-muted-foreground">
											{entity.fields.length} fields
										</span>
									</div>
								))
							)}
						</div>
					</div>
				</div>

				{/* App Info */}
				<div className="rounded-lg border border-border bg-card p-4">
					<h3 className="text-sm font-medium text-foreground mb-3">
						App Details
					</h3>
					<div className="grid grid-cols-2 gap-4 text-sm">
						<div>
							<span className="text-muted-foreground">App ID</span>
							<p className="text-foreground font-mono text-xs mt-0.5">
								{appId}
							</p>
						</div>
						<div>
							<span className="text-muted-foreground">Blueprint</span>
							<p className="text-foreground mt-0.5">
								{stats.hasBlueprint ? "Generated" : "Not yet created"}
							</p>
						</div>
						<div>
							<span className="text-muted-foreground">File Types</span>
							<p className="text-foreground mt-0.5">
								{Object.entries(stats.byExtension)
									.map(([ext, count]) => `.${ext} (${count})`)
									.join(", ") || "None"}
							</p>
						</div>
						<div>
							<span className="text-muted-foreground">Database Fields</span>
							<p className="text-foreground mt-0.5">
								{stats.fieldCount > 0
									? `${stats.fieldCount} across ${stats.entityCount} entities`
									: "No schema defined"}
							</p>
						</div>
					</div>
				</div>

				{/* Quick Actions */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					{[
						{
							label: "Edit Code",
							section: "code",
							icon: Code2,
						},
						{
							label: "Browse Data",
							section: "data",
							icon: Database,
						},
						{
							label: "API Docs",
							section: "api",
							icon: Key,
						},
						{
							label: "Settings",
							section: "settings",
							icon: Activity,
						},
					].map((action) => (
						<button
							type="button"
							key={action.section}
							onClick={() => onNavigate(action.section)}
							className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
						>
							<action.icon className="h-4 w-4" />
							{action.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
