"use client";

/**
 * MobilePublishPanel Component
 *
 * Panel displayed below the phone frame in mobile preview mode.
 * Shows QR code for real-device testing, preview URL with copy,
 * and placeholder App Store / Google Play publish buttons.
 */

import { Check, Copy, ExternalLink, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { generateQrSvg } from "../lib/qr-code";

interface MobilePublishPanelProps {
	appId: string;
}

export function MobilePublishPanel({ appId }: MobilePublishPanelProps) {
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		let cancelled = false;

		async function ensureShare() {
			try {
				const getRes = await fetch(`/api/app-builder/apps/${appId}/share`);
				const getData = await getRes.json();
				if (getData.shareUrl) {
					if (!cancelled) setShareUrl(getData.shareUrl);
					return;
				}
				const postRes = await fetch(`/api/app-builder/apps/${appId}/share`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ enabled: true }),
				});
				const postData = await postRes.json();
				if (!cancelled && postData.shareUrl) {
					setShareUrl(postData.shareUrl);
				}
			} catch {
				// Silently fail
			}
		}

		ensureShare();
		return () => { cancelled = true; };
	}, [appId]);

	const handleCopy = useCallback(async () => {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API may fail
		}
	}, [shareUrl]);

	const qrSvg = useMemo(() => {
		if (!shareUrl) return null;
		return generateQrSvg(shareUrl, 140);
	}, [shareUrl]);

	const displayUrl = shareUrl?.replace(/^https?:\/\//, "") ?? "";

	return (
		<div className="mt-4 w-full max-w-[420px] mx-auto space-y-4">
			{/* QR Code + URL */}
			<div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
				{/* QR Code */}
				<div className="flex-shrink-0">
					{qrSvg ? (
						<div
							className="rounded-xl overflow-hidden bg-white p-2"
							/* biome-ignore lint/security/noDangerouslySetInnerHtml: Generated SVG from internal utility */
							dangerouslySetInnerHTML={{ __html: qrSvg }}
						/>
					) : (
						<div className="w-[156px] h-[156px] rounded-xl bg-white/[0.06] animate-pulse flex items-center justify-center">
							<Smartphone className="w-8 h-8 text-white/20" />
						</div>
					)}
				</div>

				{/* URL + instructions */}
				<div className="flex-1 min-w-0 space-y-3">
					<div>
						<p className="text-xs font-medium text-white/60 mb-1">Preview URL</p>
						{shareUrl ? (
							<div className="flex items-center gap-1.5">
								<a
									href={shareUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="text-xs text-violet-400 hover:text-violet-300 truncate flex-1"
									title={shareUrl}
								>
									{displayUrl.length > 30 ? `${displayUrl.slice(0, 27)}...` : displayUrl}
								</a>
								<button
									type="button"
									onClick={handleCopy}
									className="p-1 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
									title={copied ? "Copied!" : "Copy link"}
								>
									{copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
								</button>
								<a
									href={shareUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="p-1 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
									title="Open in new tab"
								>
									<ExternalLink className="w-3.5 h-3.5" />
								</a>
							</div>
						) : (
							<div className="h-4 w-40 bg-white/[0.06] rounded animate-pulse" />
						)}
					</div>

					<p className="text-[11px] text-white/30 leading-relaxed">
						Scan the QR code with your phone camera to test on a real device. Browser preview may lack native features.
					</p>
				</div>
			</div>

			{/* Publish to App Stores */}
			<div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
				<p className="text-xs font-medium text-white/60 mb-3">Publish to App Stores</p>
				<div className="flex gap-3">
					{/* Apple App Store */}
					<button
						type="button"
						disabled
						className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/30 cursor-not-allowed group relative"
						title="Coming Soon"
					>
						<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" className="flex-shrink-0">
							<path d="M14.94 13.24c-.33.76-.72 1.46-1.17 2.1-.62.87-1.12 1.47-1.51 1.81-.6.56-1.24.85-1.93.87-.49 0-1.09-.14-1.78-.42-.7-.28-1.34-.42-1.92-.42-.62 0-1.28.14-1.99.42-.71.28-1.29.43-1.72.44-.66.03-1.32-.27-1.96-.9-.42-.37-.95-1-1.58-1.9-.67-.95-1.23-2.05-1.66-3.31C.24 10.63 0 9.36 0 8.14c0-1.4.3-2.6.91-3.61a5.32 5.32 0 011.9-1.93A5.1 5.1 0 015.38 1.7c.52 0 1.21.16 2.06.48.85.32 1.4.48 1.63.48.17 0 .78-.19 1.82-.56.98-.35 1.81-.49 2.49-.44 1.84.15 3.22.88 4.14 2.2-1.65 1-2.46 2.4-2.44 4.19.02 1.39.52 2.55 1.5 3.47.44.42.94.75 1.49.99-.12.35-.25.68-.38 1.01l.25-.28zM11.5.4c0 1.1-.4 2.12-1.2 3.07-.96 1.12-2.12 1.77-3.38 1.67a3.4 3.4 0 01-.03-.41c0-1.05.46-2.17 1.27-3.09.41-.47.92-.86 1.55-1.17C10.33.16 10.92.02 11.48 0c.02.14.03.27.03.4z" />
						</svg>
						<div className="text-left">
							<div className="text-[9px] leading-none opacity-60">Coming Soon</div>
							<div className="text-xs font-medium">App Store</div>
						</div>
					</button>

					{/* Google Play */}
					<button
						type="button"
						disabled
						className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/30 cursor-not-allowed group relative"
						title="Coming Soon"
					>
						<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" className="flex-shrink-0">
							<path d="M.52.42A1.39 1.39 0 000 1.54v14.92c0 .44.19.83.52 1.12l.06.06L9.72 8.5v-.2L.58.36.52.42z" />
							<path d="M12.77 11.55L9.72 8.5v-.2l3.05-3.05.07.04 3.61 2.05c1.03.58 1.03 1.54 0 2.13l-3.61 2.05-.07.03z" />
							<path d="M12.84 11.52L9.72 8.4.52 17.58c.34.36.9.4 1.54.04l10.78-6.1z" />
							<path d="M12.84 5.28L2.06.82C1.42.46.86.5.52.86l9.2 9.14 3.12-3.12-.07-.04.07.04v-.6z" />
						</svg>
						<div className="text-left">
							<div className="text-[9px] leading-none opacity-60">Coming Soon</div>
							<div className="text-xs font-medium">Google Play</div>
						</div>
					</button>
				</div>
			</div>
		</div>
	);
}
