"use client";

/**
 * IntegrationsPanel Component
 *
 * Third-party service connections and webhook management.
 * Shows available integrations and connection status.
 */

import {
	ExternalLink,
	Link,
	Puzzle,
	Webhook,
	Zap,
} from "lucide-react";
import { useState } from "react";

interface IntegrationsPanelProps {
	appId: string;
}

const AVAILABLE_INTEGRATIONS = [
	{
		id: "supabase",
		name: "Supabase",
		description: "Connect your Supabase project for auth, storage, and database",
		category: "Backend",
		status: "available" as const,
	},
	{
		id: "stripe",
		name: "Stripe",
		description: "Accept payments and manage subscriptions",
		category: "Payments",
		status: "coming_soon" as const,
	},
	{
		id: "resend",
		name: "Resend",
		description: "Send transactional and marketing emails",
		category: "Email",
		status: "coming_soon" as const,
	},
	{
		id: "clerk",
		name: "Clerk",
		description: "User management and authentication",
		category: "Auth",
		status: "coming_soon" as const,
	},
	{
		id: "uploadthing",
		name: "UploadThing",
		description: "File uploads with type-safe API",
		category: "Storage",
		status: "coming_soon" as const,
	},
	{
		id: "webhooks",
		name: "Webhooks",
		description: "Send HTTP callbacks on data changes",
		category: "Automation",
		status: "coming_soon" as const,
	},
];

export function IntegrationsPanel({ appId }: IntegrationsPanelProps) {
	const [filter, setFilter] = useState<string>("all");

	const categories = [
		"all",
		...Array.from(new Set(AVAILABLE_INTEGRATIONS.map((i) => i.category))),
	];
	const filtered =
		filter === "all"
			? AVAILABLE_INTEGRATIONS
			: AVAILABLE_INTEGRATIONS.filter((i) => i.category === filter);

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-4xl mx-auto space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-foreground">Integrations</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Connect third-party services to extend your app
					</p>
				</div>

				{/* Connected (empty for now) */}
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-center gap-2 mb-3">
						<Link className="h-4 w-4 text-muted-foreground" />
						<h3 className="text-sm font-medium text-foreground">
							Connected Services
						</h3>
					</div>
					<p className="text-sm text-muted-foreground text-center py-4">
						No integrations connected yet
					</p>
				</div>

				{/* Category filter */}
				<div className="flex gap-2 flex-wrap">
					{categories.map((cat) => (
						<button
							type="button"
							key={cat}
							onClick={() => setFilter(cat)}
							className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
								filter === cat
									? "bg-foreground text-background"
									: "bg-muted text-muted-foreground hover:text-foreground"
							}`}
						>
							{cat === "all" ? "All" : cat}
						</button>
					))}
				</div>

				{/* Available integrations */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{filtered.map((integration) => (
						<div
							key={integration.id}
							className="rounded-lg border border-border bg-card p-4 hover:border-muted-foreground/30 transition-colors"
						>
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-3">
									<div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
										<Puzzle className="h-5 w-5 text-muted-foreground" />
									</div>
									<div>
										<h3 className="text-sm font-medium text-foreground">
											{integration.name}
										</h3>
										<span className="text-xs text-muted-foreground">
											{integration.category}
										</span>
									</div>
								</div>
								{integration.status === "available" ? (
									<button
										type="button"
										className="px-3 py-1.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
									>
										Connect
									</button>
								) : (
									<span className="px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground">
										Soon
									</span>
								)}
							</div>
							<p className="text-xs text-muted-foreground mt-3">
								{integration.description}
							</p>
						</div>
					))}
				</div>

				{/* Webhook setup */}
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-start gap-3">
						<Webhook className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
						<div>
							<h3 className="text-sm font-medium text-foreground">
								Webhooks
							</h3>
							<p className="text-xs text-muted-foreground mt-1">
								Configure webhooks to receive real-time notifications when data
								changes in your app. Webhooks will be available once your app
								has entities defined.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
