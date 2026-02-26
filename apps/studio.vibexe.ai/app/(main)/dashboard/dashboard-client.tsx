"use client";

/**
 * DashboardClient — Emergent-style dashboard home
 *
 * Layout: Promo banner → Project selector → Hero text → Chat input card
 * → Recent projects → Showcase gallery → CTA → Footer
 */

import {
	ArrowRight,
	BookOpen,
	Github,
	Layers,
	Twitter,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { DashboardData } from "@/lib/dashboard/get-dashboard-data";
import { HeroPrompt } from "./hero-prompt";
import { RecentProjects } from "./recent-projects";
import { ProjectSelector } from "./project-selector";
import { PromoBanner } from "./promo-banner";
import { ShowcaseSection } from "./showcase-section";

// ====================================================================
// MAIN DASHBOARD CLIENT
// ====================================================================

interface DashboardClientProps {
	data: DashboardData;
}

export function DashboardClient({ data }: DashboardClientProps) {
	const [selectedType, setSelectedType] = useState("app");
	const { user, team, recentApps, suggestedTemplates } = data;

	return (
		<div className="min-h-screen">
			{/* Dark gradient background */}
			<div className="fixed inset-0 pointer-events-none z-0">
				<div className="absolute inset-0 bg-gradient-to-b from-[#0a0a14] via-[#0d0d1a] to-[#0a0a14]" />
				<div
					className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-[0.04]"
					style={{
						background: "radial-gradient(ellipse, hsl(219, 90%, 52%) 0%, transparent 70%)",
					}}
				/>
			</div>

			{/* Content */}
			<div className="relative z-10 max-w-4xl mx-auto px-6 py-8">
				{/* Promo Banner */}
				<PromoBanner />

				{/* Project Selector */}
				<div className="mb-8 dash-animate-fade-up">
					<ProjectSelector teamName={team.name} teamPlan={team.plan} />
				</div>

				{/* Hero Text */}
				<div className="text-center mb-10 dash-animate-fade-up" style={{ animationDelay: "0.05s" }}>
					<h1 className="text-[42px] sm:text-[52px] font-bold tracking-tight leading-[1.1] text-white/90">
						Where ideas become{" "}
						<span
							className="dash-animate-gradient bg-clip-text text-transparent"
							style={{
								backgroundImage:
									"linear-gradient(135deg, hsl(219, 90%, 72%), hsl(178, 94%, 60%), hsl(280, 90%, 72%))",
								backgroundSize: "200% 200%",
							}}
						>
							reality
						</span>
					</h1>
					<p className="text-white/30 text-[16px] mt-4 max-w-md mx-auto leading-relaxed">
						Describe what you want to build — AI handles the architecture,
						code, and deployment
					</p>
				</div>

				{/* Chat Input Card (Hero Prompt) */}
				<HeroPrompt onTypeChange={setSelectedType} />

				{/* Recent Projects Pills */}
				<RecentProjects apps={recentApps} selectedType={selectedType} />

				{/* Spacer */}
				<div className="h-16" />

				{/* Showcase Gallery */}
				<ShowcaseSection templates={suggestedTemplates} />

				{/* Spacer */}
				<div className="h-16" />

				{/* CTA Section */}
				<div className="text-center dash-animate-fade-up" style={{ animationDelay: "0.5s" }}>
					<div className="inline-flex flex-col items-center gap-4 px-10 py-8 rounded-2xl border border-white/[0.04] bg-white/[0.02]">
						<Layers className="h-6 w-6 text-white/15" />
						<h2 className="text-[20px] font-semibold text-white/70">
							Start building with Vibexe today
						</h2>
						<p className="text-[14px] text-white/25 max-w-sm">
							Full-stack apps, mobile apps, and landing pages — all from a single prompt
						</p>
						<button
							type="button"
							onClick={() => {
								document.querySelector("textarea")?.focus();
								window.scrollTo({ top: 0, behavior: "smooth" });
							}}
							className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/[0.08] text-[14px] font-medium text-white/70 hover:bg-white/[0.12] hover:text-white/90 transition-colors"
						>
							Keep Building
							<ArrowRight className="h-4 w-4" />
						</button>
					</div>
				</div>

				{/* Spacer */}
				<div className="h-16" />

				{/* Footer */}
				<footer className="border-t border-white/[0.04] pt-10 pb-8 dash-animate-fade-up" style={{ animationDelay: "0.55s" }}>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
						{/* Product */}
						<div>
							<h4 className="text-[11px] font-medium text-white/25 uppercase tracking-wider mb-3">
								Product
							</h4>
							<div className="space-y-2">
								<Link href="/app-builder" className="block text-[13px] text-white/30 hover:text-white/50 transition-colors">
									App Builder
								</Link>
								<Link href="/playground" className="block text-[13px] text-white/30 hover:text-white/50 transition-colors">
									Workflows
								</Link>
								<Link href="/dashboard" className="block text-[13px] text-white/30 hover:text-white/50 transition-colors">
									Dashboard
								</Link>
							</div>
						</div>

						{/* Solutions */}
						<div>
							<h4 className="text-[11px] font-medium text-white/25 uppercase tracking-wider mb-3">
								Solutions
							</h4>
							<div className="space-y-2">
								<span className="block text-[13px] text-white/30">SaaS Apps</span>
								<span className="block text-[13px] text-white/30">Landing Pages</span>
								<span className="block text-[13px] text-white/30">Mobile Apps</span>
							</div>
						</div>

						{/* Resources */}
						<div>
							<h4 className="text-[11px] font-medium text-white/25 uppercase tracking-wider mb-3">
								Resources
							</h4>
							<div className="space-y-2">
								<Link
									href="https://docs.vibexe.ai/en/guides/introduction"
									target="_blank"
									className="block text-[13px] text-white/30 hover:text-white/50 transition-colors"
								>
									Documentation
								</Link>
								<span className="block text-[13px] text-white/30">Templates</span>
								<span className="block text-[13px] text-white/30">Changelog</span>
							</div>
						</div>

						{/* Company */}
						<div>
							<h4 className="text-[11px] font-medium text-white/25 uppercase tracking-wider mb-3">
								Company
							</h4>
							<div className="space-y-2">
								<span className="block text-[13px] text-white/30">About</span>
								<span className="block text-[13px] text-white/30">Blog</span>
								<span className="block text-[13px] text-white/30">Careers</span>
							</div>
						</div>
					</div>

					{/* Bottom bar */}
					<div className="flex items-center justify-between pt-6 border-t border-white/[0.04]">
						<div className="flex items-center gap-2">
							<Layers className="h-4 w-4 text-white/15" />
							<span className="text-[12px] text-white/15">Vibexe</span>
						</div>
						<div className="flex items-center gap-3">
							<a
								href="https://github.com/Newpixel-net/vibexe"
								target="_blank"
								rel="noopener noreferrer"
								className="text-white/15 hover:text-white/30 transition-colors"
							>
								<Github className="h-4 w-4" />
							</a>
							<a
								href="https://twitter.com"
								target="_blank"
								rel="noopener noreferrer"
								className="text-white/15 hover:text-white/30 transition-colors"
							>
								<Twitter className="h-4 w-4" />
							</a>
							<a
								href="https://docs.vibexe.ai/en/guides/introduction"
								target="_blank"
								rel="noopener noreferrer"
								className="text-white/15 hover:text-white/30 transition-colors"
							>
								<BookOpen className="h-4 w-4" />
							</a>
						</div>
					</div>
				</footer>
			</div>
		</div>
	);
}
