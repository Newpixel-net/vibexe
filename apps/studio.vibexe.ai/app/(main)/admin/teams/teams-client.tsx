"use client";

import { PageHeading } from "@vibexe-internal/ui/page-heading";
import { Button } from "@vibexe-internal/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@vibexe-internal/ui/dialog";
import { AdminDataTable } from "../components/admin-data-table";
import { useState, useTransition } from "react";
import { changeTeamPlanAction } from "./actions";

type TeamRow = {
	dbId: number;
	id: string;
	name: string;
	plan: string;
	memberCount: number;
	workspaceCount: number;
	taskCount: number;
	createdAt: string;
};

const PLAN_COLORS: Record<string, string> = {
	free: "bg-black-400/20 text-black-400",
	pro: "bg-blue-500/20 text-blue-400",
	team: "bg-purple-500/20 text-purple-400",
	enterprise: "bg-amber-500/20 text-amber-400",
	internal: "bg-green-500/20 text-green-400",
};

const PLANS = ["free", "pro", "team", "enterprise", "internal"];

function PlanBadge({ plan }: { plan: string }) {
	const color = PLAN_COLORS[plan] ?? "bg-black-400/20 text-black-400";
	return (
		<span className={`px-2 py-0.5 rounded text-[11px] capitalize ${color}`}>
			{plan}
		</span>
	);
}

export function TeamsClient({ teams }: { teams: TeamRow[] }) {
	const [editTeam, setEditTeam] = useState<TeamRow | null>(null);
	const [selectedPlan, setSelectedPlan] = useState("");
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function openDialog(team: TeamRow) {
		setEditTeam(team);
		setSelectedPlan(team.plan);
		setError(null);
	}

	function handleSave() {
		if (!editTeam) return;
		startTransition(async () => {
			const result = await changeTeamPlanAction(editTeam.dbId, selectedPlan);
			if (result.success) {
				setEditTeam(null);
			} else {
				setError(result.error ?? "Failed to update plan");
			}
		});
	}

	const columns = [
		{
			key: "name",
			label: "Name",
			render: (row: TeamRow) => (
				<span className="font-medium">{row.name}</span>
			),
		},
		{
			key: "plan",
			label: "Plan",
			render: (row: TeamRow) => <PlanBadge plan={row.plan} />,
		},
		{
			key: "members",
			label: "Members",
			render: (row: TeamRow) => row.memberCount,
		},
		{
			key: "workspaces",
			label: "Workspaces",
			render: (row: TeamRow) => row.workspaceCount,
		},
		{
			key: "tasks",
			label: "Tasks",
			render: (row: TeamRow) => row.taskCount,
		},
		{
			key: "created",
			label: "Created",
			render: (row: TeamRow) =>
				new Date(row.createdAt).toLocaleDateString(),
		},
		{
			key: "actions",
			label: "",
			render: (row: TeamRow) => (
				<button
					type="button"
					onClick={() => openDialog(row)}
					className="text-[12px] text-blue-400 hover:text-blue-300"
				>
					Change plan
				</button>
			),
		},
	];

	return (
		<div className="flex flex-col gap-6">
			<PageHeading>Teams ({teams.length})</PageHeading>
			<AdminDataTable
				data={teams}
				columns={columns}
				searchPlaceholder="Search teams..."
				searchKeys={["name"]}
			/>

			<Dialog
				open={editTeam !== null}
				onOpenChange={(open) => !open && setEditTeam(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Change Plan — {editTeam?.name}
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-3 py-4">
						<label className="text-[13px] text-black-400">
							Select plan
						</label>
						<select
							value={selectedPlan}
							onChange={(e) => setSelectedPlan(e.target.value)}
							className="rounded-[6px] border border-black-400 bg-black-850 px-3 py-2 text-[13px] text-white-900 outline-none"
						>
							{PLANS.map((p) => (
								<option key={p} value={p}>
									{p}
								</option>
							))}
						</select>
						{error && (
							<p className="text-[12px] text-red-400">{error}</p>
						)}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="link"
							onClick={() => setEditTeam(null)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleSave}
							disabled={isPending || selectedPlan === editTeam?.plan}
						>
							{isPending ? "Saving..." : "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
