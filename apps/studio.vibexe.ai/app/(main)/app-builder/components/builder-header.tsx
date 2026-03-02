"use client";

/**
 * BuilderHeader Component — Aurora Glass Design
 *
 * Top bar with frosted glass background, glass pill buttons,
 * and gradient accent buttons.
 */

import { ArrowLeft, Check, Copy, Filter, Gamepad2, Layers, Link, Loader2, Monitor, PanelTop, Save, Smartphone, Sparkles } from "lucide-react";
import { useGameEditor } from "../lib/game-editor-context";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const MODE_CONFIG: Record<string, { label: string; icon: typeof Layers; color: string }> = {
	app: { label: "Full Stack App", icon: Layers, color: "violet" },
	mobile: { label: "Mobile App", icon: Smartphone, color: "cyan" },
	game: { label: "Game", icon: Gamepad2, color: "emerald" },
	"game-mobile": { label: "Mobile Game", icon: Gamepad2, color: "teal" },
	website: { label: "Website", icon: Monitor, color: "blue" },
	landing: { label: "Landing Page", icon: PanelTop, color: "amber" },
	funnel: { label: "Marketing Funnel", icon: Filter, color: "rose" },
};

const COLOR_CLASSES: Record<string, string> = {
	violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
	cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
	blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
	amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
	emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
	rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
	teal: "text-teal-400 bg-teal-500/10 border-teal-500/20",
};

interface BuilderHeaderProps {
	appId: string;
	appName: string;
	projectType?: string;
}

export function BuilderHeader({ appId, appName, projectType }: BuilderHeaderProps) {
	const router = useRouter();
	const gameEditor = useGameEditor();
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

			{/* App name + mode badge */}
			<div className="flex-1 min-w-0 flex items-center gap-3">
				<h1
					className="text-base font-semibold text-white/90 truncate"
					style={{ textShadow: "0 0 20px rgba(124,58,237,0.15)" }}
				>
					{appName}
				</h1>
				{(() => {
					const mode = MODE_CONFIG[projectType ?? "app"] ?? MODE_CONFIG.app;
					const Icon = mode.icon;
					const colors = COLOR_CLASSES[mode.color];
					return (
						<div className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] font-medium whitespace-nowrap ${colors}`}>
							<Icon className="w-3.5 h-3.5" />
							{mode.label}
						</div>
					);
				})()}
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
				{gameEditor.enabled ? (
					<button
						type="button"
						disabled={gameEditor.isSaving || !gameEditor.isDirty}
						onClick={() => gameEditor.saveScene()}
						className={`h-9 px-4 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all duration-200 ${
							gameEditor.isSaving
								? "bg-gradient-to-r from-emerald-600/60 to-green-600/60 text-white/80 cursor-wait"
								: gameEditor.isDirty
									? "bg-gradient-to-r from-emerald-500/80 to-green-500/80 hover:from-emerald-500 hover:to-green-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.2)] cursor-pointer"
									: "bg-white/[0.06] border border-white/[0.08] text-white/40 cursor-default"
						}`}
					>
						{gameEditor.isSaving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Save className="h-4 w-4" />
						)}
						{gameEditor.isSaving ? "Saving..." : gameEditor.isDirty ? "Save Scene" : "Saved"}
					</button>
				) : (
					<button
						type="button"
						className="h-9 px-4 text-xs font-medium rounded-xl bg-gradient-to-r from-violet-500/80 to-cyan-500/80 hover:from-violet-500 hover:to-cyan-500 text-white flex items-center gap-1.5 transition-all duration-200 shadow-[0_0_16px_rgba(124,58,237,0.15)]"
					>
						<Sparkles className="h-4 w-4" />
						Upgrade
					</button>
				)}
			</div>
		</div>
	);
}
