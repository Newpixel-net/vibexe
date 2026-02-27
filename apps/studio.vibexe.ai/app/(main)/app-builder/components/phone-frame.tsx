"use client";

/**
 * PhoneFrame Component
 *
 * iPhone device frame wrapper with bezel, Dynamic Island notch,
 * decorative status bar, and home indicator. Pure Tailwind CSS.
 */

import type { ReactNode } from "react";

/** Phone frame dimensions */
const PHONE = {
	portrait: { bezelW: 401, bezelH: 838, screenW: 375, screenH: 812 },
	landscape: { bezelW: 838, bezelH: 401, screenW: 812, screenH: 375 },
} as const;

interface PhoneFrameProps {
	children: ReactNode;
	landscape?: boolean;
}

/** Status bar icons — shared between portrait and landscape */
function StatusBarIcons() {
	return (
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
	);
}

export { PHONE };

export function PhoneFrame({ children, landscape = false }: PhoneFrameProps) {
	const d = landscape ? PHONE.landscape : PHONE.portrait;

	return (
		<div className="flex flex-col items-center">
			{/* Device bezel */}
			<div
				className="relative bg-[#1a1a1a] rounded-[44px] p-3 shadow-2xl shadow-black/50"
				style={{ width: d.bezelW, minHeight: d.bezelH }}
			>
				{/* Screen border glow */}
				<div className="absolute inset-[11px] rounded-[36px] ring-1 ring-white/[0.08] pointer-events-none z-20" />

				{/* Screen area */}
				<div className="relative bg-black rounded-[36px] overflow-hidden" style={{ width: d.screenW, height: d.screenH }}>
					{/* Status bar */}
					<div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 pt-3 pb-1 bg-gradient-to-b from-black/60 to-transparent">
						<span className="text-white text-xs font-semibold tracking-tight" style={{ fontSize: 13 }}>
							9:41
						</span>
						{/* Dynamic Island — narrower in landscape */}
						<div
							className="absolute top-3 left-1/2 -translate-x-1/2 bg-black rounded-full z-20"
							style={{ width: landscape ? 90 : 120, height: landscape ? 28 : 34 }}
						/>
						<StatusBarIcons />
					</div>

					{/* Content slot */}
					<div className="w-full h-full">
						{children}
					</div>

					{/* Home indicator — wider bar in landscape */}
					<div
						className="absolute bottom-2 left-1/2 -translate-x-1/2 h-[5px] bg-white/30 rounded-full z-10"
						style={{ width: landscape ? 180 : 134 }}
					/>
				</div>

				{/* Side buttons — repositioned for landscape */}
				{landscape ? (
					<>
						{/* Power button — top edge in landscape */}
						<div className="absolute -top-[3px] left-[140px] h-[3px] w-[80px] bg-[#2a2a2a] rounded-t-sm" />
						{/* Volume up — bottom edge */}
						<div className="absolute -bottom-[3px] left-[120px] h-[3px] w-[30px] bg-[#2a2a2a] rounded-b-sm" />
						{/* Volume down — bottom edge */}
						<div className="absolute -bottom-[3px] left-[160px] h-[3px] w-[30px] bg-[#2a2a2a] rounded-b-sm" />
						{/* Silent switch — bottom edge */}
						<div className="absolute -bottom-[3px] left-[80px] h-[3px] w-[16px] bg-[#2a2a2a] rounded-b-sm" />
					</>
				) : (
					<>
						{/* Power button — right */}
						<div className="absolute top-[140px] -right-[3px] w-[3px] h-[80px] bg-[#2a2a2a] rounded-r-sm" />
						{/* Volume up — left */}
						<div className="absolute top-[120px] -left-[3px] w-[3px] h-[30px] bg-[#2a2a2a] rounded-l-sm" />
						{/* Volume down — left */}
						<div className="absolute top-[160px] -left-[3px] w-[3px] h-[30px] bg-[#2a2a2a] rounded-l-sm" />
						{/* Silent switch — left */}
						<div className="absolute top-[80px] -left-[3px] w-[3px] h-[16px] bg-[#2a2a2a] rounded-l-sm" />
					</>
				)}
			</div>
		</div>
	);
}
