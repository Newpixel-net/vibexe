"use client";

import { PageHeading } from "@vibexe-internal/ui/page-heading";
import {
	Users,
	Building2,
	Monitor,
	LayoutGrid,
	ListTodo,
	BrainCircuit,
	KeyRound,
	Link2,
} from "lucide-react";
import { StatCard } from "../components/stat-card";

type DashboardStats = {
	userCount: number;
	totalTeams: number;
	teamsByPlan: Record<string, number>;
	activeSessionCount: number;
	workspaceCount: number;
	taskCountTotal: number;
	taskCount24h: number;
	activeProviders: number;
	totalProviders: number;
	oauthConfigCount: number;
	credentialCount: number;
};

export function DashboardClient({ stats }: { stats: DashboardStats }) {
	const planSummary = Object.entries(stats.teamsByPlan)
		.map(([plan, count]) => `${count} ${plan}`)
		.join(", ");

	return (
		<div className="flex flex-col gap-8">
			<PageHeading>Admin Dashboard</PageHeading>

			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard
					label="Users"
					value={stats.userCount}
					icon={<Users className="size-4" />}
				/>
				<StatCard
					label="Teams"
					value={stats.totalTeams}
					subtitle={planSummary}
					icon={<Building2 className="size-4" />}
				/>
				<StatCard
					label="Active Sessions"
					value={stats.activeSessionCount}
					icon={<Monitor className="size-4" />}
				/>
				<StatCard
					label="Workspaces"
					value={stats.workspaceCount}
					icon={<LayoutGrid className="size-4" />}
				/>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard
					label="Tasks (Total)"
					value={stats.taskCountTotal}
					icon={<ListTodo className="size-4" />}
				/>
				<StatCard
					label="Tasks (24h)"
					value={stats.taskCount24h}
					icon={<ListTodo className="size-4" />}
				/>
				<StatCard
					label="AI Providers"
					value={`${stats.activeProviders}/${stats.totalProviders}`}
					subtitle="active"
					icon={<BrainCircuit className="size-4" />}
				/>
				<StatCard
					label="OAuth Apps"
					value={stats.oauthConfigCount}
					subtitle={`${stats.credentialCount} credentials`}
					icon={<KeyRound className="size-4" />}
				/>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
				{[
					{ label: "Users", href: "/admin/users" },
					{ label: "Teams", href: "/admin/teams" },
					{ label: "Sessions", href: "/admin/sessions" },
					{ label: "System", href: "/admin/system" },
					{ label: "AI Providers", href: "/admin/settings/ai-providers" },
					{ label: "OAuth Apps", href: "/admin/settings/oauth-apps" },
					{ label: "Suggestions", href: "/admin/suggestions" },
					{ label: "Engine", href: "/admin/engine" },
				].map((link) => (
					<a
						key={link.href}
						href={link.href}
						className="flex items-center gap-2 rounded-[8px] border border-black-400 bg-black-850 px-4 py-3 text-[13px] text-white-900 hover:bg-black-900 transition-colors"
					>
						<Link2 className="size-4 text-black-400" />
						{link.label}
					</a>
				))}
			</div>
		</div>
	);
}
