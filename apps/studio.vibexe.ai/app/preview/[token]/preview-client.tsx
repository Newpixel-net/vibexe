"use client";

import {
	SandpackPreview as SandpackPreviewPane,
	SandpackProvider,
} from "@codesandbox/sandpack-react";
import { Maximize2, Minimize2, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppFile } from "@/app/(main)/app-builder/adapters/file-adapter";
import {
	convertToSandpackFiles,
	extractDependencies,
} from "@/app/(main)/app-builder/adapters/sandpack-adapter";

interface PreviewClientProps {
	appName: string;
	appId: string;
	projectType: string;
	files: AppFile[];
}

/** Strip "[Project Type: ..., Platform: ...]" prefix from app name */
function cleanAppName(name: string): string {
	return name.replace(/^\[.*?\]\s*/g, "").trim() || name;
}

/** Check if this project type should render in a mobile frame on desktop */
function isMobileProject(projectType: string): boolean {
	const mobile = ["game-mobile", "mobile-app", "mobile"];
	return mobile.includes(projectType);
}

const fullScreenStyles = `
  html, body, #__next { height: 100%; margin: 0; }
  .sp-wrapper { height: 100vh !important; }
  .sp-layout { height: 100% !important; }
  .sp-stack { height: 100% !important; }
  .sp-preview-container { height: 100% !important; }
  .sp-preview { height: 100% !important; }
  .sp-preview iframe { height: 100% !important; }
`;

const phoneFrameStyles = `
  .preview-phone-container .sp-wrapper { height: 100% !important; }
  .preview-phone-container .sp-layout { height: 100% !important; }
  .preview-phone-container .sp-stack { height: 100% !important; }
  .preview-phone-container .sp-preview-container { height: 100% !important; }
  .preview-phone-container .sp-preview { height: 100% !important; }
  .preview-phone-container .sp-preview iframe { height: 100% !important; }
`;

/**
 * Inline PhoneFrame for preview page — avoids importing from app-builder components
 * which may pull in client-only dependencies that break the preview route.
 */
function PreviewPhoneFrame({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-col items-center">
			<div
				className="relative bg-[#1a1a1a] rounded-[44px] p-3 shadow-2xl shadow-black/50"
				style={{ width: 401, minHeight: 838 }}
			>
				<div className="absolute inset-[11px] rounded-[36px] ring-1 ring-white/[0.08] pointer-events-none z-20" />
				<div className="relative bg-black rounded-[36px] overflow-hidden" style={{ width: 375, height: 812 }}>
					{/* Status bar */}
					<div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 pt-3 pb-1 bg-gradient-to-b from-black/60 to-transparent">
						<span className="text-white text-xs font-semibold tracking-tight" style={{ fontSize: 13 }}>
							9:41
						</span>
						<div className="absolute top-3 left-1/2 -translate-x-1/2 w-[120px] h-[34px] bg-black rounded-full z-20" />
						<div className="flex items-center gap-1.5">
							<svg width="16" height="12" viewBox="0 0 16 12" className="text-white">
								<rect x="0" y="8" width="3" height="4" rx="0.5" fill="currentColor" />
								<rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="currentColor" />
								<rect x="9" y="2" width="3" height="10" rx="0.5" fill="currentColor" />
								<rect x="13" y="0" width="3" height="12" rx="0.5" fill="currentColor" />
							</svg>
							<svg width="14" height="12" viewBox="0 0 14 12" className="text-white">
								<path d="M7 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" fill="currentColor" transform="translate(0,-2)" />
								<path d="M3.5 8.5a5 5 0 017 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" transform="translate(0,-2)" />
								<path d="M1 5.5a9 9 0 0112 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" transform="translate(0,-2)" />
							</svg>
							<div className="flex items-center gap-0.5">
								<div className="w-[22px] h-[11px] rounded-[3px] border border-white/80 flex items-center p-[1.5px]">
									<div className="flex-1 h-full bg-white rounded-[1.5px]" />
								</div>
								<div className="w-[1.5px] h-[4px] bg-white/80 rounded-r-sm" />
							</div>
						</div>
					</div>
					{/* Content */}
					<div className="w-full h-full">{children}</div>
					{/* Home indicator */}
					<div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[134px] h-[5px] bg-white/30 rounded-full z-10" />
				</div>
				{/* Side buttons */}
				<div className="absolute top-[140px] -right-[3px] w-[3px] h-[80px] bg-[#2a2a2a] rounded-r-sm" />
				<div className="absolute top-[120px] -left-[3px] w-[3px] h-[30px] bg-[#2a2a2a] rounded-l-sm" />
				<div className="absolute top-[160px] -left-[3px] w-[3px] h-[30px] bg-[#2a2a2a] rounded-l-sm" />
				<div className="absolute top-[80px] -left-[3px] w-[3px] h-[16px] bg-[#2a2a2a] rounded-l-sm" />
			</div>
		</div>
	);
}

export function PreviewClient({ appName, appId, projectType, files }: PreviewClientProps) {
	const apiOrigin = typeof window !== "undefined" ? window.location.origin : "";
	const sandpackFiles = useMemo(() => convertToSandpackFiles(files, undefined, apiOrigin, appId), [files, apiOrigin, appId]);
	const dependencies = useMemo(() => extractDependencies(files), [files]);
	const displayName = useMemo(() => cleanAppName(appName), [appName]);
	const isMobile = isMobileProject(projectType);

	// Detect if viewer is on an actual phone (viewport < 768px)
	const [isSmallViewport, setIsSmallViewport] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(max-width: 767px)");
		setIsSmallViewport(mq.matches);
		const handler = (e: MediaQueryListEvent) => setIsSmallViewport(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	// Fullscreen toggle (for games / mobile on desktop — expands to fill viewport)
	const [isFullscreen, setIsFullscreen] = useState(false);
	const toggleFullscreen = useCallback(() => setIsFullscreen((v) => !v), []);

	// Show phone frame only for mobile projects on desktop viewports (not on actual phones)
	const showPhoneFrame = isMobile && !isSmallViewport && !isFullscreen;

	// Phone frame scale-to-fit
	const phoneContainerRef = useRef<HTMLDivElement>(null);
	const [phoneScale, setPhoneScale] = useState(0.75);
	useEffect(() => {
		if (!showPhoneFrame) return;
		const container = phoneContainerRef.current;
		if (!container) return;
		const PHONE_FULL_HEIGHT = 850;
		const update = () => {
			const h = container.clientHeight;
			if (h > 0) {
				setPhoneScale(Math.min(1, (h - 32) / PHONE_FULL_HEIGHT));
			}
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(container);
		return () => observer.disconnect();
	}, [showPhoneFrame]);

	const sandpackElement = (
		<SandpackProvider
			template="react-ts"
			files={sandpackFiles}
			customSetup={{ dependencies }}
			options={{
				autorun: true,
				autoReload: true,
				recompileMode: "delayed",
				recompileDelay: 300,
				externalResources: ["https://cdn.tailwindcss.com"],
			}}
			theme="auto"
		>
			<SandpackPreviewPane
				showNavigator={false}
				showRefreshButton={false}
				showOpenInCodeSandbox={false}
				style={{ height: "100%", width: "100%" }}
			/>
		</SandpackProvider>
	);

	return (
		<div className="h-dvh w-screen flex flex-col bg-[#0a0a0f]">
			{/* Header bar */}
			<div className="h-10 flex items-center justify-between px-4 border-b border-white/[0.06] bg-white/[0.03] flex-shrink-0">
				<div className="flex items-center gap-2 min-w-0">
					{isMobile && (
						<Smartphone className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
					)}
					<span className="text-sm font-medium text-white/90 truncate">
						{displayName}
					</span>
				</div>
				<div className="flex items-center gap-3">
					{/* Fullscreen toggle — shown for mobile projects on desktop */}
					{isMobile && !isSmallViewport && (
						<button
							type="button"
							onClick={toggleFullscreen}
							className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
							title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
						>
							{isFullscreen ? (
								<Minimize2 className="w-3.5 h-3.5" />
							) : (
								<Maximize2 className="w-3.5 h-3.5" />
							)}
							<span className="hidden sm:inline">
								{isFullscreen ? "Phone View" : "Fullscreen"}
							</span>
						</button>
					)}
					<span className="text-xs text-white/30">
						Built with Vibexe
					</span>
				</div>
			</div>

			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Internal CSS constant */}
			<style dangerouslySetInnerHTML={{ __html: showPhoneFrame ? phoneFrameStyles : fullScreenStyles }} />

			{showPhoneFrame ? (
				/* Mobile project on desktop: phone frame centered with gradient background */
				<div
					ref={phoneContainerRef}
					className="flex-1 min-h-0 flex items-center justify-center"
					style={{
						background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 70%)",
					}}
				>
					<div
						className="preview-phone-container flex-shrink-0 relative"
						style={{
							width: Math.round(407 * phoneScale),
							height: Math.round(850 * phoneScale),
						}}
					>
						<div style={{ transform: `scale(${phoneScale})`, transformOrigin: "top left" }}>
							<PreviewPhoneFrame>
								{sandpackElement}
							</PreviewPhoneFrame>
						</div>
					</div>
				</div>
			) : (
				/* Desktop project OR fullscreen mode OR actual phone: fill viewport */
				<div className="flex-1 min-h-0">
					{sandpackElement}
				</div>
			)}
		</div>
	);
}
