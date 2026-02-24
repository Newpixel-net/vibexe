"use client";

/**
 * SettingsPanel Component
 *
 * App configuration: name, description, visibility, sharing, clone, badge, and danger zone.
 * Uses existing API endpoints for updates.
 */

import {
	Check,
	Copy as CopyIcon,
	ExternalLink,
	Eye,
	EyeOff,
	Globe,
	Loader2,
	Lock,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface SettingsPanelProps {
	appId: string;
}

export function SettingsPanel({ appId }: SettingsPanelProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [visibility, setVisibility] = useState("public");
	const [requireLogin, setRequireLogin] = useState(false);
	const [platformBadge, setPlatformBadge] = useState(true);
	const [shareEnabled, setShareEnabled] = useState(false);
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [copied, setCopied] = useState(false);
	const [loading, setLoading] = useState(true);
	const [cloning, setCloning] = useState(false);

	// Fetch current app info
	useEffect(() => {
		async function fetchApp() {
			try {
				const res = await fetch(`/api/app-builder/apps/${appId}`);
				if (res.ok) {
					const data = await res.json();
					setName(data.name || "");
					setDescription(data.description || "");
					setVisibility(data.visibility || "public");
					setRequireLogin(data.requireLogin || false);
				}
			} catch {
				// Ignore
			}

			// Fetch share status
			try {
				const shareRes = await fetch(
					`/api/app-builder/apps/${appId}/share`,
				);
				if (shareRes.ok) {
					const shareData = await shareRes.json();
					setShareEnabled(!!shareData.shareUrl);
					setShareUrl(shareData.shareUrl || null);
				}
			} catch {
				// Ignore
			}

			setLoading(false);
		}
		fetchApp();
	}, [appId]);

	const handleSave = useCallback(async () => {
		setSaving(true);
		try {
			await fetch(`/api/app-builder/apps/${appId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name,
					description,
					visibility,
					requireLogin,
				}),
			});
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} catch {
			// Error handling
		}
		setSaving(false);
	}, [appId, name, description, visibility, requireLogin]);

	const handleShareToggle = useCallback(async () => {
		const newEnabled = !shareEnabled;
		try {
			const res = await fetch(`/api/app-builder/apps/${appId}/share`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: newEnabled }),
			});
			if (res.ok) {
				const data = await res.json();
				setShareEnabled(newEnabled);
				setShareUrl(newEnabled ? data.shareUrl : null);
			}
		} catch {
			// Ignore
		}
	}, [appId, shareEnabled]);

	const handleCopy = useCallback(async () => {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard may fail
		}
	}, [shareUrl]);

	const handleClone = useCallback(async () => {
		if (
			!window.confirm(
				"Clone this app? A copy will be created with all files.",
			)
		)
			return;
		setCloning(true);
		try {
			const res = await fetch(`/api/app-builder/apps/${appId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "duplicate" }),
			});
			if (res.ok) {
				const data = await res.json();
				if (data.appId) {
					window.location.href = `/app-builder/${data.appId}`;
				}
			}
		} catch {
			// Error handling
		}
		setCloning(false);
	}, [appId]);

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-white/40" />
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-2xl mx-auto space-y-8">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-white/90">
						App Settings
					</h1>
					<p className="text-sm text-white/40 mt-1">
						Configure your app settings and preferences
					</p>
				</div>

				{/* General */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 space-y-4">
					<h2 className="text-lg font-semibold text-white/90">
						General
					</h2>

					<div className="space-y-2">
						<label
							htmlFor="app-name"
							className="text-sm font-medium text-white/90"
						>
							App Name
						</label>
						<input
							id="app-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
							placeholder="My App"
						/>
					</div>

					<div className="space-y-2">
						<label
							htmlFor="app-desc"
							className="text-sm font-medium text-white/90"
						>
							Description
						</label>
						<textarea
							id="app-desc"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={3}
							className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-none"
							placeholder="A brief description of your app..."
						/>
					</div>
				</div>

				{/* App Visibility */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 space-y-4">
					<h2 className="text-lg font-semibold text-white/90">
						Visibility
					</h2>
					<p className="text-sm text-white/40">
						Control who can access your app and its data.
					</p>

					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								{visibility === "public" ? (
									<Globe className="h-4 w-4 text-green-500" />
								) : (
									<Lock className="h-4 w-4 text-amber-500" />
								)}
								<div>
									<span className="text-sm font-medium text-white/90">
										App Access
									</span>
									<p className="text-xs text-white/40">
										{visibility === "public"
											? "Anyone with the link can view this app"
											: "Only invited users can access this app"}
									</p>
								</div>
							</div>
							<select
								value={visibility}
								onChange={(e) => setVisibility(e.target.value)}
								className="px-3 py-1.5 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
							>
								<option value="public">Public</option>
								<option value="private">Private</option>
							</select>
						</div>

						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								{requireLogin ? (
									<Eye className="h-4 w-4 text-blue-500" />
								) : (
									<EyeOff className="h-4 w-4 text-white/40" />
								)}
								<div>
									<span className="text-sm font-medium text-white/90">
										Require Login
									</span>
									<p className="text-xs text-white/40">
										Users must sign in before accessing the
										app
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() =>
									setRequireLogin(!requireLogin)
								}
								className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
									requireLogin
										? "bg-gradient-to-r from-violet-500 to-cyan-500"
										: "bg-white/[0.08]"
								}`}
							>
								<span
									className={`inline-block h-4 w-4 transform rounded-full bg-white/[0.02] transition-transform ${
										requireLogin
											? "translate-x-6"
											: "translate-x-1"
									}`}
								/>
							</button>
						</div>
					</div>
				</div>

				{/* Sharing */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 space-y-4">
					<h2 className="text-lg font-semibold text-white/90">
						Sharing
					</h2>
					<p className="text-sm text-white/40">
						Share your app with a public preview link. Anyone with
						the link can view the app.
					</p>

					<div className="flex items-center justify-between">
						<span className="text-sm text-white/90">
							Public sharing
						</span>
						<button
							type="button"
							onClick={handleShareToggle}
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
								shareEnabled ? "bg-green-500" : "bg-white/[0.04]"
							}`}
						>
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
									shareEnabled
										? "translate-x-6"
										: "translate-x-1"
								}`}
							/>
						</button>
					</div>

					{shareUrl && (
						<div className="flex items-center gap-2 p-3 rounded-md bg-white/[0.06]">
							<ExternalLink className="h-4 w-4 text-white/40 flex-shrink-0" />
							<a
								href={shareUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-white/90 truncate hover:underline flex-1"
							>
								{shareUrl}
							</a>
							<button
								type="button"
								onClick={handleCopy}
								className="p-1.5 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/90 transition-colors flex-shrink-0"
								title={copied ? "Copied!" : "Copy link"}
							>
								{copied ? (
									<Check className="h-3.5 w-3.5 text-green-500" />
								) : (
									<CopyIcon className="h-3.5 w-3.5" />
								)}
							</button>
						</div>
					)}
				</div>

				{/* Platform Badge */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 space-y-4">
					<h2 className="text-lg font-semibold text-white/90">
						Platform Badge
					</h2>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Sparkles className="h-4 w-4 text-white/40" />
							<div>
								<span className="text-sm font-medium text-white/90">
									Show &quot;Built with Vibexe&quot; badge
								</span>
								<p className="text-xs text-white/40">
									Display a small badge in the footer of your
									deployed app
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => setPlatformBadge(!platformBadge)}
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
								platformBadge
									? "bg-gradient-to-r from-violet-500 to-cyan-500"
									: "bg-white/[0.08]"
							}`}
						>
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white/[0.02] transition-transform ${
									platformBadge
										? "translate-x-6"
										: "translate-x-1"
								}`}
							/>
						</button>
					</div>
				</div>

				{/* App ID */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 space-y-2">
					<h2 className="text-lg font-semibold text-white/90">
						App ID
					</h2>
					<p className="text-sm text-white/40">
						Use this ID when calling the Vibexe SDK or API.
					</p>
					<code className="block px-3 py-2 rounded-md bg-white/[0.06] text-sm font-mono text-white/90">
						{appId}
					</code>
				</div>

				{/* Save */}
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={handleSave}
						disabled={saving}
						className="px-4 py-2 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white text-sm font-medium hover:from-violet-500 hover:to-cyan-500 transition-opacity disabled:opacity-50 flex items-center gap-2"
					>
						{saving ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : saved ? (
							<Check className="h-3.5 w-3.5" />
						) : null}
						{saved ? "Saved" : "Save Changes"}
					</button>
				</div>

				{/* Danger Zone */}
				<div className="rounded-xl border border-red-500/20 bg-red-500/[0.02] p-6 space-y-4">
					<h2 className="text-lg font-semibold text-red-500">
						Danger Zone
					</h2>

					<div className="space-y-4">
						{/* Clone App */}
						<div className="flex items-center justify-between p-3 rounded-md border border-white/[0.08]">
							<div>
								<h3 className="text-sm font-medium text-white/90">
									Clone App
								</h3>
								<p className="text-xs text-white/40">
									Create a copy of this app with all its files
								</p>
							</div>
							<button
								type="button"
								onClick={handleClone}
								disabled={cloning}
								className="px-3 py-1.5 rounded-md border border-white/[0.08] text-sm font-medium text-white/90 hover:bg-white/[0.06] transition-colors disabled:opacity-50 flex items-center gap-2"
							>
								{cloning && (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								)}
								Clone
							</button>
						</div>

						{/* Delete */}
						<div className="flex items-center justify-between p-3 rounded-md border border-red-500/20">
							<div>
								<h3 className="text-sm font-medium text-red-500">
									Delete App
								</h3>
								<p className="text-xs text-white/40">
									Permanently delete this app and all its
									data. This cannot be undone.
								</p>
							</div>
							<button
								type="button"
								onClick={() => {
									if (
										window.confirm(
											"Are you sure? This will permanently delete the app and all its files.",
										)
									) {
										fetch(
											`/api/app-builder/apps/${appId}`,
											{
												method: "DELETE",
											},
										).then(() => {
											window.location.href =
												"/app-builder";
										});
									}
								}}
								className="px-3 py-1.5 rounded-md border border-red-500/50 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors flex items-center gap-2"
							>
								<Trash2 className="h-3.5 w-3.5" />
								Delete
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
