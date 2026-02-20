"use client";

/**
 * BackendSettings Component
 *
 * Choose between Native Backend (built-in) and Supabase Connect (BYOB).
 * Allows users to paste Supabase URL + anon key, test connection, and save.
 */

import {
	AlertCircle,
	Check,
	Cloud,
	Database,
	ExternalLink,
	Loader2,
	Server,
	Trash2,
	Unplug,
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

export function BackendSettings({ appId }: BackendSettingsProps) {
	const [mode, setMode] = useState<BackendMode>("native");
	const [supabaseUrl, setSupabaseUrl] = useState("");
	const [anonKey, setAnonKey] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [externalDb, setExternalDb] = useState<ExternalDbInfo | null>(null);

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
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				<div>
					<h1 className="text-2xl font-bold text-foreground">Backend</h1>
					<p className="text-sm text-muted-foreground mt-1">
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
								? "border-foreground bg-foreground/5"
								: "border-border hover:border-muted-foreground/50"
						}`}
					>
						{mode === "native" && (
							<span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-foreground flex items-center justify-center">
								<Check className="h-3 w-3 text-background" />
							</span>
						)}
						<Server className="h-6 w-6 text-foreground mb-2" />
						<h3 className="text-sm font-semibold text-foreground">
							Built-in Backend
						</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Managed PostgreSQL database, REST API, auth, and dashboard.
							Everything included.
						</p>
						<span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-foreground/10 text-foreground text-[10px] font-medium">
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
								? "border-foreground bg-foreground/5"
								: "border-border hover:border-muted-foreground/50"
						}`}
					>
						{mode === "supabase" && (
							<span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-foreground flex items-center justify-center">
								<Check className="h-3 w-3 text-background" />
							</span>
						)}
						<Cloud className="h-6 w-6 text-foreground mb-2" />
						<h3 className="text-sm font-semibold text-foreground">
							Connect Supabase
						</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Bring your own Supabase project. AI generates Supabase-native
							code.
						</p>
						<span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-medium">
							Free tier
						</span>
					</button>
				</div>

				{/* Native Backend Info */}
				{mode === "native" && (
					<div className="rounded-lg border border-border bg-card p-4 space-y-3">
						<div className="flex items-center gap-2">
							<Database className="h-4 w-4 text-foreground" />
							<h3 className="text-sm font-medium text-foreground">
								Native Backend
							</h3>
							<span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
								Active
							</span>
						</div>
						<p className="text-xs text-muted-foreground">
							Your app uses the built-in Vibexe backend with PostgreSQL database,
							auto-generated REST API, end-user authentication, and full
							dashboard management. Use <code className="px-1 py-0.5 rounded bg-muted text-foreground">@vibexe/sdk</code> in
							your app code.
						</p>
					</div>
				)}

				{/* Supabase Connect Form */}
				{mode === "supabase" && (
					<div className="rounded-lg border border-border bg-card p-4 space-y-4">
						<div className="flex items-center gap-2">
							<Cloud className="h-4 w-4 text-foreground" />
							<h3 className="text-sm font-medium text-foreground">
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
								<div className="p-3 rounded-md bg-muted/30 space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-xs text-muted-foreground">
											Project URL
										</span>
										<a
											href={externalDb.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-xs text-foreground hover:underline flex items-center gap-1"
										>
											{externalDb.url.replace("https://", "").slice(0, 40)}...
											<ExternalLink className="h-3 w-3" />
										</a>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-xs text-muted-foreground">
											Status
										</span>
										<span className="flex items-center gap-1 text-xs text-green-600">
											<span className="h-1.5 w-1.5 rounded-full bg-green-500" />
											Connected
										</span>
									</div>
								</div>

								<p className="text-xs text-muted-foreground">
									The AI will generate code using{" "}
									<code className="px-1 py-0.5 rounded bg-muted text-foreground">
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
								<p className="text-xs text-muted-foreground">
									Connect your Supabase project. Find these values in your{" "}
									<a
										href="https://supabase.com/dashboard/project/_/settings/api"
										target="_blank"
										rel="noopener noreferrer"
										className="text-foreground underline"
									>
										Supabase Dashboard &rarr; Settings &rarr; API
									</a>
									.
								</p>

								<div className="space-y-3">
									<div>
										<label className="text-xs font-medium text-foreground block mb-1">
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
											className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
										/>
									</div>

									<div>
										<label className="text-xs font-medium text-foreground block mb-1">
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
											className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
										/>
									</div>
								</div>

								<button
									type="button"
									onClick={handleSave}
									disabled={
										saving || !supabaseUrl.trim() || !anonKey.trim()
									}
									className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
				<div className="rounded-lg border border-border bg-card p-4">
					<h3 className="text-sm font-medium text-foreground mb-2">
						How it works
					</h3>
					<ul className="space-y-2 text-xs text-muted-foreground">
						<li className="flex items-start gap-2">
							<Server className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
							<span>
								<strong className="text-foreground">Built-in Backend</strong>:
								Your app gets a dedicated PostgreSQL database, REST API, and
								auth system. Use <code className="px-1 py-0.5 rounded bg-muted">@vibexe/sdk</code> to
								interact with data.
							</span>
						</li>
						<li className="flex items-start gap-2">
							<Cloud className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
							<span>
								<strong className="text-foreground">Supabase Connect</strong>:
								Bring your own Supabase project. The AI generates code using
								Supabase&apos;s client library directly. You manage your own
								database, auth, and storage through the Supabase dashboard.
							</span>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
