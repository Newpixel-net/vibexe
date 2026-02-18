"use client";

/**
 * BuilderHeader Component
 *
 * Top bar for the App Builder with back, app name, Share, and Publish buttons.
 */

import { ArrowLeft, Check, Copy, Link, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface BuilderHeaderProps {
	appId: string;
	appName: string;
}

export function BuilderHeader({ appId, appName }: BuilderHeaderProps) {
	const router = useRouter();
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);

	// Fetch current share status on mount
	useEffect(() => {
		fetch(`/api/app-builder/apps/${appId}/share`)
			.then((r) => r.json())
			.then((data) => {
				if (data.shareUrl) setShareUrl(data.shareUrl);
			})
			.catch(() => {});
	}, [appId]);

	const handleShare = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/app-builder/apps/${appId}/share`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: true }),
			});
			const data = await res.json();
			if (data.shareUrl) {
				setShareUrl(data.shareUrl);
				await navigator.clipboard.writeText(data.shareUrl);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}
		} catch {
			// Failed to generate share link
		} finally {
			setLoading(false);
		}
	}, [appId]);

	const handleCopyLink = useCallback(async () => {
		if (!shareUrl) return;
		await navigator.clipboard.writeText(shareUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [shareUrl]);

	return (
		<div className="h-14 border-b border-border bg-background flex items-center px-4">
			{/* Back button */}
			<Button
				onClick={() => router.push("/app-builder")}
				className="h-9 w-9 mr-3 text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="h-5 w-5" />
				<span className="sr-only">Back to Apps</span>
			</Button>

			{/* App name */}
			<div className="flex-1 min-w-0">
				<h1 className="text-base font-semibold text-foreground truncate">
					{appName}
				</h1>
			</div>

			{/* Action buttons */}
			<div className="flex items-center gap-2">
				{shareUrl ? (
					<>
						<Button
							variant="outline"
							className="h-9 text-xs"
							onClick={handleCopyLink}
						>
							{copied ? (
								<Check className="h-4 w-4 mr-1.5 text-green-500" />
							) : (
								<Copy className="h-4 w-4 mr-1.5" />
							)}
							{copied ? "Copied!" : "Copy Link"}
						</Button>
						<Button
							variant="outline"
							className="h-9 text-xs"
							onClick={() => window.open(shareUrl, "_blank")}
						>
							<Link className="h-4 w-4 mr-1.5" />
							Open Preview
						</Button>
					</>
				) : (
					<Button
						variant="default"
						className="h-9"
						onClick={handleShare}
						disabled={loading}
					>
						{loading ? (
							<Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
						) : (
							<Link className="h-4 w-4 mr-1.5" />
						)}
						Share
					</Button>
				)}
				<Button variant="link" className="h-9">
					<Sparkles className="h-4 w-4 mr-1.5" />
					Upgrade
				</Button>
			</div>
		</div>
	);
}
