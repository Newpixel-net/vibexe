"use client";

import { PageHeading } from "@vibexe-internal/ui/page-heading";
import { AdminDataTable } from "../components/admin-data-table";
import { CheckCircle, XCircle } from "lucide-react";

type UserRow = {
	dbId: number;
	id: string;
	email: string;
	displayName: string;
	avatarUrl: string | null;
	hasPassword: boolean;
	emailVerified: boolean;
	teamCount: number;
	sessionCount: number;
	oauthProviders: string[];
};

function AuthBadges({ user }: { user: UserRow }) {
	const badges: string[] = [...user.oauthProviders];
	if (user.hasPassword) badges.push("password");
	if (badges.length === 0) badges.push("none");

	return (
		<div className="flex gap-1 flex-wrap">
			{badges.map((b) => (
				<span
					key={b}
					className="px-1.5 py-0.5 rounded text-[11px] bg-black-400/20 text-black-400 capitalize"
				>
					{b}
				</span>
			))}
		</div>
	);
}

const columns = [
	{
		key: "user",
		label: "User",
		render: (row: UserRow) => (
			<div className="flex items-center gap-2">
				{row.avatarUrl ? (
					<img
						src={row.avatarUrl}
						alt=""
						className="size-6 rounded-full"
					/>
				) : (
					<div className="size-6 rounded-full bg-black-400/30" />
				)}
				<div className="flex flex-col">
					<span className="text-white-900 text-[13px]">
						{row.displayName || row.email}
					</span>
					{row.displayName && (
						<span className="text-black-400 text-[11px]">{row.email}</span>
					)}
				</div>
			</div>
		),
	},
	{
		key: "auth",
		label: "Auth",
		render: (row: UserRow) => <AuthBadges user={row} />,
	},
	{
		key: "verified",
		label: "Verified",
		render: (row: UserRow) =>
			row.emailVerified ? (
				<CheckCircle className="size-4 text-green-500" />
			) : (
				<XCircle className="size-4 text-black-400" />
			),
	},
	{
		key: "teams",
		label: "Teams",
		render: (row: UserRow) => row.teamCount,
	},
	{
		key: "sessions",
		label: "Sessions",
		render: (row: UserRow) => row.sessionCount,
	},
];

export function UsersClient({ users }: { users: UserRow[] }) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeading>Users ({users.length})</PageHeading>
			<AdminDataTable
				data={users}
				columns={columns}
				searchPlaceholder="Search users..."
				searchKeys={["email", "displayName"]}
				pageSize={25}
			/>
		</div>
	);
}
