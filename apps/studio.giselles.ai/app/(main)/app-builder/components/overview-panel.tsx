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
	HardDrive,
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
			className="flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] hover:bg-white/[0.06] transition-all duration-150 text-left group"
		>
			<div className="flex items-center justify-between">
				<Icon className="h-4 w-4 text-white/30" />
				{onClick && (
					<ArrowRight className="h-3.5 w-3.5 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
				)}
			</div>
			<div>
				<div className="text-3xl font-light tracking-tight text-white/90">{value}</div>
				<div className="text-[11px] text-white/30 uppercase tracking-wider mt-1">{label}</div>
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

	// Storage stats
	const [storageFileCount, setStorageFileCount] = useState(0);

	// Fetch app settings + storage stats
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
		async function fetchStorageStats() {
			try {
				const res = await fetch(`/api/apps/${appId}/storage?limit=50`);
				if (res.ok) {
					const data = await res.json();
					setStorageFileCount(data.files?.length ?? 0);
				}
			} catch {}
		}
		fetchSettings();
		fetchStorageStats();
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
					<h1 className="text-2xl font-semibold text-white/90">
						{appName || "Overview"}
					</h1>
					{appDescription && (
						<p className="text-sm text-white/40 mt-1">
							{appDescription}
						</p>
					)}
					{!appDescription && (
						<p className="text-sm text-white/40 mt-1">
							Your app at a glance
						</p>
					)}
				</div>

				{/* App Visibility + Invite Users */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{/* App Visibility */}
					<div className="rounded-2xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] p-4">
						<div className="flex items-center justify-between mb-3">
							<div>
								<h3 className="text-sm font-medium text-white/80">
									App Visibility
								</h3>
								<p className="text-xs text-white/30 mt-0.5">
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
									className="flex-1 px-3 py-2 rounded-xl border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
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
									className="rounded border-white/[0.1]"
								/>
								<span className="text-sm text-white/40">
									Require login to access
								</span>
							</label>
						</div>
					</div>

					{/* Invite Users */}
					<div className="rounded-2xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] p-4">
						<div className="flex items-center justify-between mb-3">
							<div>
								<h3 className="text-sm font-medium text-white/80">
									Invite Users
								</h3>
								<p className="text-xs text-white/30 mt-0.5">
									Grow your user base by inviting others
								</p>
							</div>
							<Link2 className="h-4 w-4 text-white/20" />
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={copyInviteLink}
								className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-sm font-medium text-white/70 hover:bg-white/[0.04] transition-colors"
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
								className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white text-sm font-medium hover:from-violet-500/90 hover:to-cyan-500/90 transition-colors"
							>
								<Send className="h-3.5 w-3.5" />
								Send Invites
							</button>
						</div>
					</div>
				</div>

				{/* Stats Grid */}
				<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
						icon={HardDrive}
						label="Storage Files"
						value={storageFileCount}
						onClick={() => onNavigate("storage")}
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
					<div>
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">
								Project Files
							</h3>
							<button
								type="button"
								onClick={() => onNavigate("code")}
								className="text-xs text-white/30 hover:text-white/60 transition-colors"
							>
								View all
							</button>
						</div>
						<div className="divide-y divide-white/[0.06]">
							{recentFiles.length === 0 ? (
								<div className="py-6 text-sm text-white/30 text-center">
									No files yet. Start generating!
								</div>
							) : (
								recentFiles.map((file) => (
									<div
										key={file.id}
										className="flex items-center gap-3 px-2 py-2.5 hover:bg-white/[0.04] rounded-lg transition-colors"
									>
										<Code2 className="h-3.5 w-3.5 text-white/20 flex-shrink-0" />
										<span className="text-sm text-white/70 truncate">
											{file.path}
										</span>
										<span className="text-xs text-white/20 ml-auto flex-shrink-0">
											{file.language}
										</span>
									</div>
								))
							)}
						</div>
					</div>

					{/* Schema Overview */}
					<div>
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">
								Database Schema
							</h3>
							<button
								type="button"
								onClick={() => onNavigate("data")}
								className="text-xs text-white/30 hover:text-white/60 transition-colors"
							>
								Browse data
							</button>
						</div>
						<div className="divide-y divide-white/[0.06]">
							{!schema || schema.entities.length === 0 ? (
								<div className="py-8 text-center">
									<Database className="h-7 w-7 text-white/10 mx-auto mb-2" />
									<p className="text-sm text-white/30">
										No database yet
									</p>
									<p className="text-xs text-white/20 mt-1">
										Ask the AI to build an app with data entities
									</p>
								</div>
							) : (
								schema.entities.map((entity) => (
									<div
										key={entity.name}
										className="flex items-center justify-between px-2 py-2.5 hover:bg-white/[0.04] rounded-lg transition-colors"
									>
										<div className="flex items-center gap-3">
											<Database className="h-3.5 w-3.5 text-white/20 flex-shrink-0" />
											<span className="text-sm text-white/70">
												{entity.name}
											</span>
										</div>
										<span className="text-xs text-white/20">
											{entity.fields.length} fields
										</span>
									</div>
								))
							)}
						</div>
					</div>
				</div>

				{/* App Info */}
				<div className="pt-2">
					<h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">
						App Details
					</h3>
					<div className="grid grid-cols-2 gap-6 text-sm">
						<div>
							<span className="text-white/30 text-xs">App ID</span>
							<p className="text-white/70 font-mono text-xs mt-1">
								{appId}
							</p>
						</div>
						<div>
							<span className="text-white/30 text-xs">Blueprint</span>
							<p className="text-white/70 mt-1">
								{stats.hasBlueprint ? "Generated" : "Not yet created"}
							</p>
						</div>
						<div>
							<span className="text-white/30 text-xs">File Types</span>
							<p className="text-white/70 mt-1">
								{Object.entries(stats.byExtension)
									.map(([ext, count]) => `.${ext} (${count})`)
									.join(", ") || "None"}
							</p>
						</div>
						<div>
							<span className="text-white/30 text-xs">Database Fields</span>
							<p className="text-white/70 mt-1">
								{stats.fieldCount > 0
									? `${stats.fieldCount} across ${stats.entityCount} entities`
									: "No schema defined"}
							</p>
						</div>
					</div>
				</div>

				{/* Quick Actions */}
				<div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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
							label: "Storage",
							section: "storage",
							icon: HardDrive,
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
							className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-150 text-sm text-white/40 hover:text-white/70"
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
