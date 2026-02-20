"use client";

/**
 * AppTemplatePanel Component
 *
 * Allows users to publish their app as a reusable template.
 * Requires the app to be deployed first.
 */

import { FileCode2, Rocket } from "lucide-react";

interface AppTemplatePanelProps {
	appId: string;
}

export function AppTemplatePanel({ appId }: AppTemplatePanelProps) {
	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-white/90">
						App Template
					</h1>
					<p className="text-sm text-white/40 mt-1">
						Turn your app into a reusable template that others can clone.
					</p>
				</div>

				{/* Empty state */}
				<div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-12 text-center">
					<div className="h-16 w-16 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-4">
						<Rocket className="h-8 w-8 text-white/20" />
					</div>
					<h2 className="text-lg font-semibold text-white/90 mb-2">
						Ready to create a template?
					</h2>
					<p className="text-sm text-white/40 max-w-md">
						Before you can turn this application into a template, it needs
						to be deployed. Click Deploy in the Domains section to publish
						your app, then return here to set it up as a template.
					</p>
					<button
						type="button"
						className="mt-6 px-6 py-2.5 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white text-sm font-medium hover:from-violet-500 hover:to-cyan-500 transition-colors opacity-50 cursor-not-allowed"
						disabled
					>
						Create Template
					</button>
				</div>
			</div>
		</div>
	);
}
