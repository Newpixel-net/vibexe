"use client";

/**
 * PhoneFrame Component
 *
 * iPhone device frame wrapper with bezel, Dynamic Island notch,
 * decorative status bar, and home indicator. Pure Tailwind CSS.
 */

import type { ReactNode } from "react";

interface PhoneFrameProps {
	children: ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
	return (
		<div className="flex flex-col items-center">
			{/* Device bezel */}
			<div
				className="relative bg-[#1a1a1a] rounded-[44px] p-3 shadow-2xl shadow-black/50"
				style={{ width: 401, minHeight: 838 }}
			>
				{/* Screen border glow */}
				<div className="absolute inset-[11px] rounded-[36px] ring-1 ring-white/[0.08] pointer-events-none z-20" />

				{/* Screen area */}
				<div className="relative bg-black rounded-[36px] overflow-hidden" style={{ width: 375, height: 812 }}>
					{/* Status bar */}
					<div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 pt-3 pb-1 bg-gradient-to-b from-black/60 to-transparent">
						{/* Time */}
						<span className="text-white text-xs font-semibold tracking-tight" style={{ fontSize: 13 }}>
							9:41
						</span>

						{/* Dynamic Island */}
						<div className="absolute top-3 left-1/2 -translate-x-1/2 w-[120px] h-[34px] bg-black rounded-full z-20" />

						{/* Status icons */}
						<div className="flex items-center gap-1.5">
							{/* Signal bars */}
							<svg width="16" height="12" viewBox="0 0 16 12" className="text-white">
								<rect x="0" y="8" width="3" height="4" rx="0.5" fill="currentColor" />
								<rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="currentColor" />
								<rect x="9" y="2" width="3" height="10" rx="0.5" fill="currentColor" />
								<rect x="13" y="0" width="3" height="12" rx="0.5" fill="currentColor" />
							</svg>
							{/* WiFi */}
							<svg width="14" height="12" viewBox="0 0 14 12" className="text-white">
								<path d="M7 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" fill="currentColor" transform="translate(0,-2)" />
								<path d="M3.5 8.5a5 5 0 017 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" transform="translate(0,-2)" />
								<path d="M1 5.5a9 9 0 0112 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" transform="translate(0,-2)" />
							</svg>
							{/* Battery */}
							<div className="flex items-center gap-0.5">
								<div className="w-[22px] h-[11px] rounded-[3px] border border-white/80 flex items-center p-[1.5px]">
									<div className="flex-1 h-full bg-white rounded-[1.5px]" />
								</div>
								<div className="w-[1.5px] h-[4px] bg-white/80 rounded-r-sm" />
							</div>
						</div>
					</div>

					{/* Content slot */}
					<div className="w-full h-full">
						{children}
					</div>

					{/* Home indicator */}
					<div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[134px] h-[5px] bg-white/30 rounded-full z-10" />
				</div>

				{/* Side buttons (decorative) */}
				{/* Power button */}
				<div className="absolute top-[140px] -right-[3px] w-[3px] h-[80px] bg-[#2a2a2a] rounded-r-sm" />
				{/* Volume up */}
				<div className="absolute top-[120px] -left-[3px] w-[3px] h-[30px] bg-[#2a2a2a] rounded-l-sm" />
				{/* Volume down */}
				<div className="absolute top-[160px] -left-[3px] w-[3px] h-[30px] bg-[#2a2a2a] rounded-l-sm" />
				{/* Silent switch */}
				<div className="absolute top-[80px] -left-[3px] w-[3px] h-[16px] bg-[#2a2a2a] rounded-l-sm" />
			</div>
		</div>
	);
}
