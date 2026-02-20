"use client";

/**
 * BuilderHeader Component — Aurora Glass Design
 *
 * Top bar with frosted glass background, glass pill buttons,
 * and gradient accent buttons.
 */

import { ArrowLeft, Check, Copy, Link, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface BuilderHeaderProps {
	appId: string;
	appName: string;
}

export function BuilderHeader({ appId, appName }: BuilderHeaderProps) {
	const router = useRouter();
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);

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
		<div className="h-14 border-b border-white/[0.08] backdrop-blur-xl bg-white/[0.04] flex items-center px-4">
			{/* Back button — glass pill */}
			<button
				type="button"
				onClick={() => router.push("/app-builder")}
				className="h-9 w-9 mr-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white/90 transition-all duration-200"
			>
				<ArrowLeft className="h-5 w-5" />
				<span className="sr-only">Back to Apps</span>
			</button>

			{/* App name with subtle glow */}
			<div className="flex-1 min-w-0">
				<h1
					className="text-base font-semibold text-white/90 truncate"
					style={{ textShadow: "0 0 20px rgba(124,58,237,0.15)" }}
				>
					{appName}
				</h1>
			</div>

			{/* Action buttons */}
			<div className="flex items-center gap-2">
				{shareUrl ? (
					<>
						<button
							type="button"
							className="h-9 px-3 text-xs font-medium rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white/90 flex items-center gap-1.5 transition-all duration-200"
							onClick={handleCopyLink}
						>
							{copied ? (
								<Check className="h-4 w-4 text-emerald-400" />
							) : (
								<Copy className="h-4 w-4" />
							)}
							{copied ? "Copied!" : "Copy Link"}
						</button>
						<button
							type="button"
							className="h-9 px-3 text-xs font-medium rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white/90 flex items-center gap-1.5 transition-all duration-200"
							onClick={() => window.open(shareUrl, "_blank")}
						>
							<Link className="h-4 w-4" />
							Open Preview
						</button>
					</>
				) : (
					<button
						type="button"
						className="h-9 px-3 text-xs font-medium rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white/90 flex items-center gap-1.5 transition-all duration-200 disabled:opacity-50"
						onClick={handleShare}
						disabled={loading}
					>
						{loading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Link className="h-4 w-4" />
						)}
						Share
					</button>
				)}
				<button
					type="button"
					className="h-9 px-4 text-xs font-medium rounded-xl bg-gradient-to-r from-violet-500/80 to-cyan-500/80 hover:from-violet-500 hover:to-cyan-500 text-white flex items-center gap-1.5 transition-all duration-200 shadow-[0_0_16px_rgba(124,58,237,0.15)]"
				>
					<Sparkles className="h-4 w-4" />
					Upgrade
				</button>
			</div>
		</div>
	);
}
