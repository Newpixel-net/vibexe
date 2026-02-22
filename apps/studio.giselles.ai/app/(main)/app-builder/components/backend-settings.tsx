"use client";

/**
 * BackendSettings Component
 *
 * Choose between Native Backend (built-in) and Supabase Connect (BYOB).
 * Shows service status cards for Database, Storage, Auth, Functions when native.
 */

import {
	AlertCircle,
	Check,
	Cloud,
	Database,
	ExternalLink,
	HardDrive,
	Loader2,
	Lock,
	Server,
	Unplug,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface BackendSettingsProps {
	appId: string;
}

type BackendMode = "native" | "supabase";

interface ExternalDbInfo {
	id: string;
	provider: string;
	url: string;
	status: string;
	createdAt: string;
}

interface ServiceStats {
	entityCount: number;
	storageUsedBytes: number;
	storageQuotaMb: number;
	storageAccessLevel: string;
	functionsCount: number;
}

function formatBytesCompact(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function BackendSettings({ appId }: BackendSettingsProps) {
	const [mode, setMode] = useState<BackendMode>("native");
	const [supabaseUrl, setSupabaseUrl] = useState("");
	const [anonKey, setAnonKey] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [externalDb, setExternalDb] = useState<ExternalDbInfo | null>(null);
	const [stats, setStats] = useState<ServiceStats>({
		entityCount: 0,
		storageUsedBytes: 0,
		storageQuotaMb: 500,
		storageAccessLevel: "authenticated",
		functionsCount: 0,
	});

	useEffect(() => {
		async function fetchConfig() {
			try {
				const res = await fetch(`/api/apps/${appId}/external-db`);
				if (res.ok) {
					const data = await res.json();
					if (data.externalDb) {
						setExternalDb(data.externalDb);
						setMode("supabase");
						setSupabaseUrl(data.externalDb.url || "");
					}
				}
			} catch {
				// Ignore
			}
			setLoading(false);
		}
		fetchConfig();
	}, [appId]);

	// Fetch backend service stats for the service cards
	useEffect(() => {
		async function fetchStats() {
			const results = await Promise.allSettled([
				fetch(`/api/apps/${appId}/schema`).then((r) =>
					r.ok ? r.json() : null,
				),
				fetch(`/api/apps/${appId}/storage/settings`).then((r) =>
					r.ok ? r.json() : null,
				),
				fetch(`/api/apps/${appId}/functions`).then((r) =>
					r.ok ? r.json() : null,
				),
			]);

			const schema =
				results[0].status === "fulfilled" ? results[0].value : null;
			const storageSettings =
				results[1].status === "fulfilled" ? results[1].value : null;
			const functions =
				results[2].status === "fulfilled" ? results[2].value : null;

			setStats({
				entityCount: schema?.schema?.entities?.length ?? 0,
				storageUsedBytes: Number.parseInt(
					storageSettings?.usedStorageBytes ?? "0",
					10,
				),
				storageQuotaMb: storageSettings?.storageQuotaMb ?? 500,
				storageAccessLevel:
					storageSettings?.accessLevel ?? "authenticated",
				functionsCount: functions?.functions?.length ?? 0,
			});
		}
		fetchStats();
	}, [appId]);

	const handleSave = useCallback(async () => {
		if (!supabaseUrl.trim() || !anonKey.trim()) {
			setError("Both Supabase URL and anon key are required");
			return;
		}

		setSaving(true);
		setError(null);
		setSuccess(null);

		try {
			const res = await fetch(`/api/apps/${appId}/external-db`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: supabaseUrl.trim(),
					anonKey: anonKey.trim(),
				}),
			});

			const data = await res.json();
			if (res.ok && data.success) {
				setSuccess("Connected to Supabase successfully!");
				setExternalDb({
					id: "",
					provider: "supabase",
					url: supabaseUrl.trim(),
					status: "connected",
					createdAt: new Date().toISOString(),
				});
				setAnonKey("");
				setTimeout(() => setSuccess(null), 3000);
			} else {
				setError(data.error || "Failed to connect");
			}
		} catch {
			setError("Network error. Please try again.");
		}

		setSaving(false);
	}, [appId, supabaseUrl, anonKey]);

	const handleDisconnect = useCallback(async () => {
		setSaving(true);
		setError(null);

		try {
			const res = await fetch(`/api/apps/${appId}/external-db`, {
				method: "DELETE",
			});
			if (res.ok) {
				setExternalDb(null);
				setMode("native");
				setSupabaseUrl("");
				setAnonKey("");
				setSuccess("Disconnected from Supabase");
				setTimeout(() => setSuccess(null), 3000);
			}
		} catch {
			setError("Failed to disconnect");
		}

		setSaving(false);
	}, [appId]);

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-white/40" />
			</div>
		);
	}

	const storageUsagePercent = Math.min(
		100,
		(stats.storageUsedBytes / (stats.storageQuotaMb * 1024 * 1024)) * 100,
	);

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				<div>
					<h1 className="text-2xl font-bold text-white/90">Backend</h1>
					<p className="text-sm text-white/40 mt-1">
						Choose how your app stores and manages data
					</p>
				</div>

				{/* Success/Error messages */}
				{success && (
					<div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
						<Check className="h-4 w-4 text-green-500 flex-shrink-0" />
						<p className="text-xs text-green-600">{success}</p>
					</div>
				)}
				{error && (
					<div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20">
						<AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
						<p className="text-xs text-red-500">{error}</p>
					</div>
				)}

				{/* Backend Mode Selection */}
				<div className="grid grid-cols-2 gap-4">
					{/* Native Backend */}
					<button
						type="button"
						onClick={() => {
							setMode("native");
							setError(null);
						}}
						className={`relative p-4 rounded-lg border-2 text-left transition-colors ${
							mode === "native"
								? "border-violet-500/50 bg-violet-500/5"
								: "border-white/[0.08] hover:border-white/10"
						}`}
					>
						{mode === "native" && (
							<span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center">
								<Check className="h-3 w-3 text-white" />
							</span>
						)}
						<Server className="h-6 w-6 text-white/90 mb-2" />
						<h3 className="text-sm font-semibold text-white/90">
							Built-in Backend
						</h3>
						<p className="text-xs text-white/40 mt-1">
							Managed PostgreSQL database, REST API, auth, storage,
							and functions. Everything included.
						</p>
						<span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-[10px] font-medium">
							Included
						</span>
					</button>

					{/* Supabase Connect */}
					<button
						type="button"
						onClick={() => {
							setMode("supabase");
							setError(null);
						}}
						className={`relative p-4 rounded-lg border-2 text-left transition-colors ${
							mode === "supabase"
								? "border-violet-500/50 bg-violet-500/5"
								: "border-white/[0.08] hover:border-white/10"
						}`}
					>
						{mode === "supabase" && (
							<span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center">
								<Check className="h-3 w-3 text-white" />
							</span>
						)}
						<Cloud className="h-6 w-6 text-white/90 mb-2" />
						<h3 className="text-sm font-semibold text-white/90">
							Connect Supabase
						</h3>
						<p className="text-xs text-white/40 mt-1">
							Bring your own Supabase project. AI generates
							Supabase-native code.
						</p>
						<span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-medium">
							Free tier
						</span>
					</button>
				</div>

				{/* Native Backend — Service Status Cards */}
				{mode === "native" && (
					<div className="space-y-4">
						<div className="flex items-center gap-2">
							<h3 className="text-sm font-medium text-white/60">
								Backend Services
							</h3>
							<span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
								All Active
							</span>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							{/* Database */}
							<div className="rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2.5">
										<div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
											<Database className="h-4 w-4 text-blue-400" />
										</div>
										<div>
											<h4 className="text-sm font-medium text-white/90">
												Database
											</h4>
											<p className="text-[10px] text-white/30">
												PostgreSQL
											</p>
										</div>
									</div>
									<span
										className="h-2 w-2 rounded-full bg-green-500"
										title="Active"
									/>
								</div>
								<div className="flex items-center justify-between text-xs">
									<span className="text-white/40">
										{stats.entityCount > 0
											? `${stats.entityCount} entit${stats.entityCount === 1 ? "y" : "ies"}`
											: "No entities yet"}
									</span>
									{stats.entityCount > 0 && (
										<span className="text-white/30">
											{stats.entityCount * 5} endpoints
										</span>
									)}
								</div>
								<p className="text-[11px] text-white/30 leading-relaxed">
									Per-app PostgreSQL database with auto-generated
									REST API. Define entities in your app and manage
									data from the Data panel.
								</p>
							</div>

							{/* File Storage */}
							<div className="rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2.5">
										<div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
											<HardDrive className="h-4 w-4 text-violet-400" />
										</div>
										<div>
											<h4 className="text-sm font-medium text-white/90">
												File Storage
											</h4>
											<p className="text-[10px] text-white/30">
												S3-Compatible
											</p>
										</div>
									</div>
									<span
										className="h-2 w-2 rounded-full bg-green-500"
										title="Active"
									/>
								</div>
								<div className="flex items-center justify-between text-xs">
									<span className="text-white/40">
										{formatBytesCompact(stats.storageUsedBytes)}{" "}
										/ {stats.storageQuotaMb} MB
									</span>
									<span className="text-white/30 capitalize">
										{stats.storageAccessLevel}
									</span>
								</div>
								<div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
									<div
										className="h-full rounded-full bg-violet-500/60 transition-all"
										style={{
											width: `${storageUsagePercent}%`,
										}}
									/>
								</div>
								<p className="text-[11px] text-white/30 leading-relaxed">
									Upload, download, and serve files with
									on-the-fly image transforms. Manage from the
									Storage panel.
								</p>
							</div>

							{/* Authentication */}
							<div className="rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2.5">
										<div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
											<Lock className="h-4 w-4 text-green-400" />
										</div>
										<div>
											<h4 className="text-sm font-medium text-white/90">
												Authentication
											</h4>
											<p className="text-[10px] text-white/30">
												Email + JWT
											</p>
										</div>
									</div>
									<span
										className="h-2 w-2 rounded-full bg-green-500"
										title="Active"
									/>
								</div>
								<p className="text-[11px] text-white/30 leading-relaxed">
									Signup, signin, and session management for end
									users. Manage users from the Users panel and
									configure auth in Settings.
								</p>
							</div>

							{/* Serverless Functions */}
							<div className="rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2.5">
										<div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
											<Zap className="h-4 w-4 text-amber-400" />
										</div>
										<div>
											<h4 className="text-sm font-medium text-white/90">
												Functions
											</h4>
											<p className="text-[10px] text-white/30">
												Serverless
											</p>
										</div>
									</div>
									<span
										className="h-2 w-2 rounded-full bg-green-500"
										title="Active"
									/>
								</div>
								<div className="text-xs text-white/40">
									{stats.functionsCount > 0
										? `${stats.functionsCount} function${stats.functionsCount === 1 ? "" : "s"} deployed`
										: "No functions yet"}
								</div>
								<p className="text-[11px] text-white/30 leading-relaxed">
									HTTP endpoints, entity hooks, and scheduled
									cron jobs. TypeScript functions with full
									backend context.
								</p>
							</div>
						</div>

						{/* SDK reference */}
						<div className="rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3">
							<p className="text-xs text-white/40">
								Access all services via{" "}
								<code className="px-1 py-0.5 rounded bg-white/[0.06] text-white/80 text-[11px]">
									@vibexe/sdk
								</code>{" "}
								&mdash;{" "}
								<code className="px-1 py-0.5 rounded bg-white/[0.06] text-white/80 text-[11px]">
									app.data
								</code>
								,{" "}
								<code className="px-1 py-0.5 rounded bg-white/[0.06] text-white/80 text-[11px]">
									app.storage
								</code>
								,{" "}
								<code className="px-1 py-0.5 rounded bg-white/[0.06] text-white/80 text-[11px]">
									app.auth
								</code>
								,{" "}
								<code className="px-1 py-0.5 rounded bg-white/[0.06] text-white/80 text-[11px]">
									app.functions
								</code>
							</p>
						</div>
					</div>
				)}

				{/* Supabase Connect Form */}
				{mode === "supabase" && (
					<div className="rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-4">
						<div className="flex items-center gap-2">
							<Cloud className="h-4 w-4 text-white/90" />
							<h3 className="text-sm font-medium text-white/90">
								Supabase Connection
							</h3>
							{externalDb?.status === "connected" && (
								<span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
									Connected
								</span>
							)}
						</div>

						{externalDb?.status === "connected" ? (
							<>
								<div className="p-3 rounded-md bg-white/[0.04] space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-xs text-white/40">
											Project URL
										</span>
										<a
											href={externalDb.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-xs text-white/90 hover:underline flex items-center gap-1"
										>
											{externalDb.url
												.replace("https://", "")
												.slice(0, 40)}
											...
											<ExternalLink className="h-3 w-3" />
										</a>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-xs text-white/40">
											Status
										</span>
										<span className="flex items-center gap-1 text-xs text-green-600">
											<span className="h-1.5 w-1.5 rounded-full bg-green-500" />
											Connected
										</span>
									</div>
								</div>

								<p className="text-xs text-white/40">
									The AI will generate code using{" "}
									<code className="px-1 py-0.5 rounded bg-white/[0.04] text-white/90">
										@supabase/supabase-js
									</code>{" "}
									for data access and authentication.
								</p>

								<div className="flex items-center gap-3">
									<button
										type="button"
										onClick={handleDisconnect}
										disabled={saving}
										className="px-3 py-1.5 rounded-md border border-red-500/30 text-red-500 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center gap-1.5"
									>
										<Unplug className="h-3.5 w-3.5" />
										Disconnect
									</button>
								</div>
							</>
						) : (
							<>
								<p className="text-xs text-white/40">
									Connect your Supabase project. Find these
									values in your{" "}
									<a
										href="https://supabase.com/dashboard/project/_/settings/api"
										target="_blank"
										rel="noopener noreferrer"
										className="text-white/90 underline"
									>
										Supabase Dashboard &rarr; Settings &rarr;
										API
									</a>
									.
								</p>

								<div className="space-y-3">
									<div>
										<label className="text-xs font-medium text-white/90 block mb-1">
											Project URL
										</label>
										<input
											type="text"
											value={supabaseUrl}
											onChange={(e) => {
												setSupabaseUrl(e.target.value);
												setError(null);
											}}
											placeholder="https://your-project.supabase.co"
											disabled={saving}
											className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
										/>
									</div>

									<div>
										<label className="text-xs font-medium text-white/90 block mb-1">
											Anon Key
										</label>
										<input
											type="password"
											value={anonKey}
											onChange={(e) => {
												setAnonKey(e.target.value);
												setError(null);
											}}
											placeholder="eyJhbGciOiJIUzI1NiIs..."
											disabled={saving}
											className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
										/>
									</div>
								</div>

								<button
									type="button"
									onClick={handleSave}
									disabled={
										saving ||
										!supabaseUrl.trim() ||
										!anonKey.trim()
									}
									className="px-4 py-2 rounded-md bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
								>
									{saving ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" />
											Testing connection...
										</>
									) : (
										<>
											<Check className="h-4 w-4" />
											Connect &amp; Save
										</>
									)}
								</button>
							</>
						)}
					</div>
				)}

				{/* Info box */}
				<div className="rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
					<h3 className="text-sm font-medium text-white/90 mb-2">
						How it works
					</h3>
					<ul className="space-y-2 text-xs text-white/40">
						<li className="flex items-start gap-2">
							<Server className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
							<span>
								<strong className="text-white/90">
									Built-in Backend
								</strong>
								: Your app gets a dedicated PostgreSQL database,
								REST API, file storage, auth system, and
								serverless functions. Use{" "}
								<code className="px-1 py-0.5 rounded bg-white/[0.04]">
									@vibexe/sdk
								</code>{" "}
								to interact with all services.
							</span>
						</li>
						<li className="flex items-start gap-2">
							<Cloud className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
							<span>
								<strong className="text-white/90">
									Supabase Connect
								</strong>
								: Bring your own Supabase project. The AI
								generates code using Supabase&apos;s client
								library directly. You manage your own database,
								auth, and storage through the Supabase dashboard.
							</span>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
