"use client";

/**
 * DomainsPanel Component
 *
 * Domain configuration and deployment management.
 * Shows current share URL and future subdomain/custom domain settings.
 */

import {
	Check,
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

export function DomainsPanel({ appId }: DomainsPanelProps) {
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [subdomain, setSubdomain] = useState("");
	const [loading, setLoading] = useState(true);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		async function fetchShare() {
			try {
				const res = await fetch(`/api/app-builder/apps/${appId}/share`);
				if (res.ok) {
					const data = await res.json();
					setShareUrl(data.shareUrl || null);
				}
			} catch {
				// Ignore
			}
			setLoading(false);
		}
		fetchShare();
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
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-foreground">Domains</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Configure domains and deploy your app
					</p>
				</div>

				{/* Current Preview URL */}
				{shareUrl && (
					<div className="rounded-lg border border-border bg-card p-4 space-y-3">
						<div className="flex items-center gap-2">
							<Globe className="h-4 w-4 text-green-500" />
							<h3 className="text-sm font-medium text-foreground">
								Preview URL
							</h3>
							<span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
								Live
							</span>
						</div>
						<div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
							<a
								href={shareUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-foreground hover:underline flex-1 truncate"
							>
								{shareUrl}
							</a>
							<button
								type="button"
								onClick={() => handleCopy(shareUrl)}
								className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
							>
								{copied ? (
									<Check className="h-3.5 w-3.5 text-green-500" />
								) : (
									<Copy className="h-3.5 w-3.5" />
								)}
							</button>
							<a
								href={shareUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
							>
								<ExternalLink className="h-3.5 w-3.5" />
							</a>
						</div>
					</div>
				)}

				{/* Subdomain */}
				<div className="rounded-lg border border-border bg-card p-4 space-y-3">
					<div className="flex items-center gap-2">
						<Rocket className="h-4 w-4 text-muted-foreground" />
						<h3 className="text-sm font-medium text-foreground">
							Subdomain
						</h3>
						<span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
							Coming soon
						</span>
					</div>
					<p className="text-xs text-muted-foreground">
						Deploy your app to a custom subdomain on vibexe.online
					</p>
					<div className="flex items-center gap-2">
						<input
							type="text"
							value={subdomain}
							onChange={(e) =>
								setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
							}
							placeholder="my-app"
							className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
						<span className="text-sm text-muted-foreground">.vibexe.online</span>
					</div>
					<button
						type="button"
						disabled
						className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium opacity-50 cursor-not-allowed"
					>
						Deploy
					</button>
				</div>

				{/* Custom Domain */}
				<div className="rounded-lg border border-border bg-card p-4 space-y-3">
					<div className="flex items-center gap-2">
						<Globe className="h-4 w-4 text-muted-foreground" />
						<h3 className="text-sm font-medium text-foreground">
							Custom Domain
						</h3>
						<span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
							Coming soon
						</span>
					</div>
					<p className="text-xs text-muted-foreground">
						Connect your own domain to your deployed app
					</p>
					<input
						type="text"
						disabled
						placeholder="app.yourdomain.com"
						className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm opacity-50 cursor-not-allowed"
					/>
				</div>

				{/* SSL */}
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-start gap-3">
						<Shield className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
						<div>
							<h3 className="text-sm font-medium text-foreground">
								SSL Certificates
							</h3>
							<p className="text-xs text-muted-foreground mt-1">
								All deployed apps automatically receive SSL certificates via
								Let&apos;s Encrypt. Custom domains will also receive free SSL
								upon DNS verification.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
