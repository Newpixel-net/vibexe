"use client";

/**
 * DomainsPanel Component
 *
 * Domain configuration and deployment management.
 * Allows deploying apps to {subdomain}.vibexe.online subdomains.
 * Shows deployment status, live URL, and build logs.
 */

import {
	AlertCircle,
	Check,
	ChevronDown,
	ChevronRight,
	Clock,
	Copy,
	ExternalLink,
	Globe,
	Loader2,
	Rocket,
	Shield,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface DomainsPanelProps {
	appId: string;
}

interface Deployment {
	id: string;
	subdomain: string | null;
	customDomain: string | null;
	status: "pending" | "building" | "live" | "failed";
	buildLog: string | null;
	deployedAt: string | null;
	createdAt: string;
	url: string | null;
}

export function DomainsPanel({ appId }: DomainsPanelProps) {
	const [deployment, setDeployment] = useState<Deployment | null>(null);
	const [subdomain, setSubdomain] = useState("");
	const [loading, setLoading] = useState(true);
	const [deploying, setDeploying] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [showLog, setShowLog] = useState(false);
	const [shareUrl, setShareUrl] = useState<string | null>(null);

	// Fetch current deployment + share URL
	useEffect(() => {
		async function fetchData() {
			try {
				const [deployRes, shareRes] = await Promise.all([
					fetch(`/api/apps/${appId}/deploy`),
					fetch(`/api/app-builder/apps/${appId}/share`),
				]);

				if (deployRes.ok) {
					const data = await deployRes.json();
					if (data.deployment) {
						setDeployment(data.deployment);
						if (data.deployment.subdomain) {
							setSubdomain(data.deployment.subdomain);
						}
					}
				}

				if (shareRes.ok) {
					const data = await shareRes.json();
					setShareUrl(data.shareUrl || null);
				}
			} catch {
				// Ignore fetch errors
			}
			setLoading(false);
		}
		fetchData();
	}, [appId]);

	const handleCopy = useCallback(async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard may fail
		}
	}, []);

	const handleDeploy = useCallback(async () => {
		if (!subdomain.trim()) {
			setError("Please enter a subdomain");
			return;
		}

		setDeploying(true);
		setError(null);

		try {
			const res = await fetch(`/api/apps/${appId}/deploy`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ subdomain: subdomain.trim() }),
			});

			const data = await res.json();

			if (res.ok && data.success) {
				setDeployment(data.deployment);
				setError(null);
			} else {
				setError(data.error || data.errors?.join(", ") || "Deploy failed");
				if (data.buildLog) {
					setDeployment((prev) =>
						prev
							? { ...prev, status: "failed", buildLog: data.buildLog }
							: {
									id: "",
									subdomain: subdomain.trim(),
									customDomain: null,
									status: "failed",
									buildLog: data.buildLog,
									deployedAt: null,
									createdAt: new Date().toISOString(),
									url: null,
								},
					);
				}
			}
		} catch {
			setError("Network error. Please try again.");
		}

		setDeploying(false);
	}, [appId, subdomain]);

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-white/40" />
			</div>
		);
	}

	const isLive = deployment?.status === "live";
	const liveUrl = deployment?.url || (deployment?.subdomain ? `https://vibexe.online/apps/${deployment.subdomain}/` : null);

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-white/90">Domains</h1>
					<p className="text-sm text-white/40 mt-1">
						Deploy your app and configure domains
					</p>
				</div>

				{/* Live Deployment Banner */}
				{isLive && liveUrl && (
					<div className="rounded-xl border border-green-500/20 bg-green-500/[0.03] p-4 space-y-3">
						<div className="flex items-center gap-2">
							<span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
							<h3 className="text-sm font-medium text-white/90">
								Your app is live
							</h3>
						</div>
						<div className="flex items-center gap-2 p-3 rounded-md bg-white/[0.04] border border-white/[0.08]">
							<Globe className="h-4 w-4 text-green-500 flex-shrink-0" />
							<a
								href={liveUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-white/90 hover:underline flex-1 truncate font-mono"
							>
								{liveUrl}
							</a>
							<button
								type="button"
								onClick={() => handleCopy(liveUrl)}
								className="p-1.5 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/90 transition-colors"
								title="Copy URL"
							>
								{copied ? (
									<Check className="h-3.5 w-3.5 text-green-500" />
								) : (
									<Copy className="h-3.5 w-3.5" />
								)}
							</button>
							<a
								href={liveUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="p-1.5 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/90 transition-colors"
								title="Open in new tab"
							>
								<ExternalLink className="h-3.5 w-3.5" />
							</a>
						</div>
						{deployment.deployedAt && (
							<div className="flex items-center gap-1.5 text-xs text-white/40">
								<Clock className="h-3 w-3" />
								Last deployed: {new Date(deployment.deployedAt).toLocaleString()}
							</div>
						)}
					</div>
				)}

				{/* Deploy Section */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-4">
					<div className="flex items-center gap-2">
						<Rocket className="h-4 w-4 text-white/90" />
						<h3 className="text-sm font-medium text-white/90">
							{isLive ? "Re-deploy" : "Deploy to Subdomain"}
						</h3>
					</div>

					<p className="text-xs text-white/40">
						{isLive
							? "Deploy the latest version of your app to update the live site."
							: "Choose a subdomain and deploy your app to a live URL."}
					</p>

					<div className="flex items-center gap-2">
						<span className="text-sm text-white/40 whitespace-nowrap font-mono">
							vibexe.online/apps/
						</span>
						<input
							type="text"
							value={subdomain}
							onChange={(e) => {
								setSubdomain(
									e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
								);
								setError(null);
							}}
							placeholder="my-app"
							disabled={deploying}
							className="flex-1 px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
						/>
					</div>

					{error && (
						<div className="flex items-start gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20">
							<AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
							<p className="text-xs text-red-500">{error}</p>
						</div>
					)}

					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={handleDeploy}
							disabled={deploying || !subdomain.trim()}
							className="px-4 py-2 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white text-sm font-medium hover:from-violet-500 hover:to-cyan-500 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
						>
							{deploying ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Building...
								</>
							) : isLive ? (
								<>
									<Rocket className="h-4 w-4" />
									Re-deploy
								</>
							) : (
								<>
									<Rocket className="h-4 w-4" />
									Deploy
								</>
							)}
						</button>

						{deployment?.status === "failed" && (
							<span className="text-xs text-red-500 flex items-center gap-1">
								<AlertCircle className="h-3 w-3" />
								Last build failed
							</span>
						)}
					</div>
				</div>

				{/* Build Log */}
				{deployment?.buildLog && (
					<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden">
						<button
							type="button"
							onClick={() => setShowLog(!showLog)}
							className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
						>
							{showLog ? (
								<ChevronDown className="h-4 w-4 text-white/40" />
							) : (
								<ChevronRight className="h-4 w-4 text-white/40" />
							)}
							<span className="text-sm font-medium text-white/90">
								Build Log
							</span>
							<span
								className={`px-2 py-0.5 rounded-full text-xs font-medium ${
									deployment.status === "live"
										? "bg-green-500/10 text-green-600"
										: deployment.status === "failed"
											? "bg-red-500/10 text-red-500"
											: "bg-yellow-500/10 text-yellow-600"
								}`}
							>
								{deployment.status}
							</span>
						</button>
						{showLog && (
							<div className="px-4 pb-4">
								<pre className="text-[11px] font-mono text-white/40 bg-white/[0.04] rounded-md p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
									{deployment.buildLog}
								</pre>
							</div>
						)}
					</div>
				)}

				{/* Preview URL */}
				{shareUrl && (
					<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-3">
						<div className="flex items-center gap-2">
							<Globe className="h-4 w-4 text-blue-500" />
							<h3 className="text-sm font-medium text-white/90">
								Preview URL
							</h3>
							<span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium">
								In-browser
							</span>
						</div>
						<p className="text-xs text-white/40">
							This URL shows the Sandpack in-browser preview. For a real
							deployed app, use the subdomain above.
						</p>
						<div className="flex items-center gap-2 p-3 rounded-md bg-white/[0.06]">
							<a
								href={shareUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-white/90 hover:underline flex-1 truncate font-mono"
							>
								{shareUrl}
							</a>
							<a
								href={shareUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="p-1.5 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/90 transition-colors"
							>
								<ExternalLink className="h-3.5 w-3.5" />
							</a>
						</div>
					</div>
				)}

				{/* Custom Domain */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-3">
					<div className="flex items-center gap-2">
						<Globe className="h-4 w-4 text-white/40" />
						<h3 className="text-sm font-medium text-white/90">
							Custom Domain
						</h3>
						<span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 text-xs font-medium">
							Coming soon
						</span>
					</div>
					<p className="text-xs text-white/40">
						Connect your own domain to your deployed app
					</p>
					<input
						type="text"
						disabled
						placeholder="app.yourdomain.com"
						className="w-full px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm opacity-50 cursor-not-allowed"
					/>
				</div>

				{/* SSL */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
					<div className="flex items-start gap-3">
						<Shield className="h-5 w-5 text-white/40 flex-shrink-0 mt-0.5" />
						<div>
							<h3 className="text-sm font-medium text-white/90">
								SSL Certificates
							</h3>
							<p className="text-xs text-white/40 mt-1">
								All deployed apps automatically receive SSL certificates.
								Custom domains will also receive free SSL upon DNS
								verification.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
