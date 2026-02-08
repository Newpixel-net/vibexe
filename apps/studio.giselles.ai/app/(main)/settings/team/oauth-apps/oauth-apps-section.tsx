"use client";

import {
	CheckCircleIcon,
	EyeIcon,
	EyeOffIcon,
	KeyRoundIcon,
	Loader2Icon,
	PlusIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface OAuthAppConfigDisplay {
	dbId: number;
	provider: string;
	clientId: string;
	clientSecretMasked: string;
	scopes: string | null;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

const PROVIDER_INFO: Record<string, { label: string; description: string; docsUrl: string }> = {
	google: {
		label: "Google",
		description: "Google Sheets, Drive, Gmail, Calendar, Contacts, Forms",
		docsUrl: "https://console.cloud.google.com/apis/credentials",
	},
	slack: {
		label: "Slack",
		description: "Slack messaging and channels",
		docsUrl: "https://api.slack.com/apps",
	},
	discord: {
		label: "Discord",
		description: "Discord messaging and servers",
		docsUrl: "https://discord.com/developers/applications",
	},
	microsoft: {
		label: "Microsoft",
		description: "Teams, Outlook, OneDrive, Excel, SharePoint",
		docsUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
	},
	github: {
		label: "GitHub",
		description: "GitHub repositories and actions",
		docsUrl: "https://github.com/settings/developers",
	},
	notion: {
		label: "Notion",
		description: "Notion pages and databases",
		docsUrl: "https://www.notion.so/my-integrations",
	},
	airtable: {
		label: "Airtable",
		description: "Airtable bases and records",
		docsUrl: "https://airtable.com/create/tokens",
	},
	hubspot: {
		label: "HubSpot",
		description: "HubSpot CRM and marketing",
		docsUrl: "https://developers.hubspot.com",
	},
	salesforce: {
		label: "Salesforce",
		description: "Salesforce CRM",
		docsUrl: "https://developer.salesforce.com",
	},
	shopify: {
		label: "Shopify",
		description: "Shopify e-commerce",
		docsUrl: "https://partners.shopify.com",
	},
	dropbox: {
		label: "Dropbox",
		description: "Dropbox file storage",
		docsUrl: "https://www.dropbox.com/developers/apps",
	},
	zoom: {
		label: "Zoom",
		description: "Zoom meetings",
		docsUrl: "https://marketplace.zoom.us/develop/create",
	},
};

const PROVIDER_OPTIONS = Object.entries(PROVIDER_INFO).map(([key, val]) => ({
	value: key,
	label: val.label,
	description: val.description,
}));

export function OAuthAppsSection() {
	const [configs, setConfigs] = useState<OAuthAppConfigDisplay[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchConfigs = useCallback(async () => {
		try {
			const response = await fetch("/api/admin/oauth-apps");
			if (response.ok) {
				const data = (await response.json()) as {
					configs: OAuthAppConfigDisplay[];
				};
				setConfigs(data.configs);
			}
		} catch {
			console.error("Failed to fetch OAuth app configs");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchConfigs();
	}, [fetchConfigs]);

	const handleDelete = useCallback(
		async (provider: string) => {
			if (!confirm(`Delete OAuth app config for "${provider}"?`)) return;
			try {
				const response = await fetch(
					`/api/admin/oauth-apps?provider=${encodeURIComponent(provider)}`,
					{ method: "DELETE" },
				);
				if (response.ok) {
					await fetchConfigs();
				}
			} catch {
				console.error("Failed to delete config");
			}
		},
		[fetchConfigs],
	);

	const configuredProviders = new Set(configs.map((c) => c.provider));

	return (
		<div className="flex flex-col gap-6">
			{/* Configured providers */}
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-medium text-white/70">
						Configured Providers
					</h2>
					<button
						type="button"
						onClick={() => setShowForm(true)}
						className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary-900 text-white hover:bg-primary-800 transition-colors"
					>
						<PlusIcon className="size-3.5" />
						Add Provider
					</button>
				</div>

				{isLoading ? (
					<div className="flex items-center gap-2 py-8 text-sm text-white/40 justify-center">
						<Loader2Icon className="size-4 animate-spin" />
						Loading...
					</div>
				) : configs.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8 text-white/40 border border-dashed border-white/10 rounded-xl">
						<KeyRoundIcon className="size-8 opacity-50" />
						<p className="text-sm">No OAuth apps configured yet</p>
						<p className="text-xs">
							Add a provider to enable one-click OAuth connect for your
							integrations
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{configs.map((config) => {
							const info = PROVIDER_INFO[config.provider];
							return (
								<div
									key={config.provider}
									className="flex items-start gap-3 p-4 rounded-xl bg-[rgb(27,23,40)] border border-white/[0.08]"
								>
									<div className="mt-0.5">
										<CheckCircleIcon className="size-5 text-green-400" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium text-white">
											{info?.label ?? config.provider}
										</div>
										<div className="text-xs text-white/40 mt-0.5">
											{info?.description ?? "Custom provider"}
										</div>
										<div className="text-xs text-white/30 mt-1 font-mono">
											Client ID: {config.clientId.slice(0, 20)}...
										</div>
										<div className="text-xs text-white/30 font-mono">
											Secret: {config.clientSecretMasked}
										</div>
									</div>
									<button
										type="button"
										className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
										onClick={() => handleDelete(config.provider)}
									>
										<Trash2Icon className="size-4" />
									</button>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Add form modal */}
			{showForm && (
				<AddOAuthAppForm
					existingProviders={configuredProviders}
					onClose={() => {
						setShowForm(false);
						setError(null);
					}}
					onSuccess={() => {
						setShowForm(false);
						setError(null);
						fetchConfigs();
					}}
					error={error}
					setError={setError}
				/>
			)}
		</div>
	);
}

function AddOAuthAppForm({
	existingProviders,
	onClose,
	onSuccess,
	error,
	setError,
}: {
	existingProviders: Set<string>;
	onClose: () => void;
	onSuccess: () => void;
	error: string | null;
	setError: (error: string | null) => void;
}) {
	const [provider, setProvider] = useState("");
	const [customProvider, setCustomProvider] = useState("");
	const [clientId, setClientId] = useState("");
	const [clientSecret, setClientSecret] = useState("");
	const [showSecret, setShowSecret] = useState(false);
	const [scopes, setScopes] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const modalRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
				onClose();
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [onClose]);

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [onClose]);

	const effectiveProvider = provider === "__custom" ? customProvider.trim() : provider;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!effectiveProvider || !clientId || !clientSecret) return;

		setIsSubmitting(true);
		setError(null);

		try {
			const response = await fetch("/api/admin/oauth-apps", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					provider: effectiveProvider,
					clientId,
					clientSecret,
					scopes: scopes || undefined,
				}),
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? "Failed to save");
			}

			onSuccess();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to save OAuth app config",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const selectedInfo =
		provider && provider !== "__custom" ? PROVIDER_INFO[provider] : null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div
				ref={modalRef}
				className="w-full max-w-lg mx-4 rounded-xl bg-[rgb(20,17,32)] border border-white/10 shadow-2xl"
			>
				{/* Header */}
				<div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
					<div>
						<h3 className="text-base font-medium text-white">
							Add OAuth App Configuration
						</h3>
						<p className="text-xs text-white/40 mt-0.5">
							Enter the client credentials from your provider's developer
							console
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1 text-white/40 hover:text-white transition-colors"
					>
						<XIcon className="size-4" />
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
					{/* Provider select */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="provider" className="text-xs text-white/50">
							Provider
						</label>
						<select
							id="provider"
							value={provider}
							onChange={(e) => setProvider(e.target.value)}
							className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-white/25"
							required
						>
							<option value="">Select a provider...</option>
							{PROVIDER_OPTIONS.filter(
								(o) => !existingProviders.has(o.value),
							).map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label} - {opt.description}
								</option>
							))}
							<option value="__custom">Custom provider...</option>
						</select>
					</div>

					{/* Custom provider input */}
					{provider === "__custom" && (
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="custom-provider"
								className="text-xs text-white/50"
							>
								Custom Provider Name
							</label>
							<input
								id="custom-provider"
								type="text"
								value={customProvider}
								onChange={(e) => setCustomProvider(e.target.value)}
								placeholder="e.g., twitter, linkedin"
								className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
								required
							/>
						</div>
					)}

					{/* Developer console link */}
					{selectedInfo && (
						<a
							href={selectedInfo.docsUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-primary-400 hover:text-primary-300 underline"
						>
							Open {selectedInfo.label} Developer Console
						</a>
					)}

					{/* Client ID */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="client-id" className="text-xs text-white/50">
							Client ID
						</label>
						<input
							id="client-id"
							type="text"
							value={clientId}
							onChange={(e) => setClientId(e.target.value)}
							placeholder="Enter OAuth2 Client ID"
							className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25 font-mono"
							required
						/>
					</div>

					{/* Client Secret */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="client-secret" className="text-xs text-white/50">
							Client Secret
						</label>
						<div className="relative">
							<input
								id="client-secret"
								type={showSecret ? "text" : "password"}
								value={clientSecret}
								onChange={(e) => setClientSecret(e.target.value)}
								placeholder="Enter OAuth2 Client Secret"
								className="w-full px-3 py-2 pr-10 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25 font-mono"
								required
							/>
							<button
								type="button"
								onClick={() => setShowSecret(!showSecret)}
								className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60"
							>
								{showSecret ? (
									<EyeOffIcon className="size-4" />
								) : (
									<EyeIcon className="size-4" />
								)}
							</button>
						</div>
					</div>

					{/* Scopes override */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="scopes" className="text-xs text-white/50">
							Scopes Override{" "}
							<span className="text-white/30">(optional)</span>
						</label>
						<input
							id="scopes"
							type="text"
							value={scopes}
							onChange={(e) => setScopes(e.target.value)}
							placeholder="Leave empty to use piece defaults"
							className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
						/>
						<p className="text-[10px] text-white/30">
							Comma-separated. If empty, scopes from the piece definition
							will be used automatically.
						</p>
					</div>

					{/* Redirect URI info */}
					<div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
						<p className="text-xs text-white/50 mb-1">
							Set this as your Redirect URI / Callback URL:
						</p>
						<code className="text-xs text-primary-400 font-mono break-all">
							{typeof window !== "undefined"
								? `${window.location.origin}/api/integrations/oauth2/callback`
								: "/api/integrations/oauth2/callback"}
						</code>
					</div>

					{error && (
						<p className="text-sm text-red-400" role="alert">
							{error}
						</p>
					)}

					<div className="flex gap-2 justify-end pt-1">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 text-sm rounded-lg text-white/50 hover:text-white transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={
								isSubmitting || !effectiveProvider || !clientId || !clientSecret
							}
							className="px-4 py-2 text-sm rounded-lg bg-primary-900 text-white hover:bg-primary-800 transition-colors disabled:opacity-40"
						>
							{isSubmitting ? "Saving..." : "Save Configuration"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
