"use client";

import { PageHeading } from "@vibexe-internal/ui/page-heading";
import { AdminDataTable } from "../components/admin-data-table";
import { useTransition } from "react";
import { revokeSessionAction, revokeAllUserSessionsAction } from "./actions";
import { useRouter } from "next/navigation";

type SessionRow = {
	id: number;
	userId: string;
	userDbId: number;
	userEmail: string;
	userName: string;
	ipAddress: string;
	userAgent: string;
	createdAt: string;
	expiresAt: string;
};

function parseBrowser(ua: string): string {
	if (!ua) return "Unknown";
	if (ua.includes("Firefox")) return "Firefox";
	if (ua.includes("Edg/")) return "Edge";
	if (ua.includes("Chrome")) return "Chrome";
	if (ua.includes("Safari")) return "Safari";
	if (ua.includes("curl")) return "curl";
	return ua.slice(0, 30);
}

function RevokeButton({
	sessionId,
	onDone,
}: { sessionId: number; onDone: () => void }) {
	const [isPending, startTransition] = useTransition();

	return (
		<button
			type="button"
			disabled={isPending}
			onClick={() => {
				if (!confirm("Revoke this session?")) return;
				startTransition(async () => {
					await revokeSessionAction(sessionId);
					onDone();
				});
			}}
			className="text-[12px] text-red-400 hover:text-red-300 disabled:opacity-50"
		>
			{isPending ? "..." : "Revoke"}
		</button>
	);
}

function RevokeAllButton({
	userId,
	onDone,
}: { userId: string; onDone: () => void }) {
	const [isPending, startTransition] = useTransition();

	return (
		<button
			type="button"
			disabled={isPending}
			onClick={() => {
				if (!confirm("Revoke ALL sessions for this user?")) return;
				startTransition(async () => {
					await revokeAllUserSessionsAction(userId);
					onDone();
				});
			}}
			className="text-[12px] text-red-400 hover:text-red-300 disabled:opacity-50"
		>
			{isPending ? "..." : "Revoke all"}
		</button>
	);
}

export function SessionsClient({ sessions }: { sessions: SessionRow[] }) {
	const router = useRouter();
	const refresh = () => router.refresh();

	const columns = [
		{
			key: "user",
			label: "User",
			render: (row: SessionRow) => (
				<div className="flex flex-col">
					<span>{row.userName || row.userEmail}</span>
					{row.userName && (
						<span className="text-[11px] text-black-400">
							{row.userEmail}
						</span>
					)}
				</div>
			),
		},
		{
			key: "ip",
			label: "IP",
			render: (row: SessionRow) => (
				<span className="font-mono text-[12px]">{row.ipAddress}</span>
			),
		},
		{
			key: "browser",
			label: "Browser",
			render: (row: SessionRow) => parseBrowser(row.userAgent),
		},
		{
			key: "created",
			label: "Created",
			render: (row: SessionRow) =>
				new Date(row.createdAt).toLocaleString(),
		},
		{
			key: "expires",
			label: "Expires",
			render: (row: SessionRow) =>
				new Date(row.expiresAt).toLocaleString(),
		},
		{
			key: "actions",
			label: "",
			render: (row: SessionRow) => (
				<div className="flex gap-3">
					<RevokeButton sessionId={row.id} onDone={refresh} />
					<RevokeAllButton userId={row.userId} onDone={refresh} />
				</div>
			),
		},
	];

	return (
		<div className="flex flex-col gap-6">
			<PageHeading>Active Sessions ({sessions.length})</PageHeading>
			<AdminDataTable
				data={sessions}
				columns={columns}
				searchPlaceholder="Search by user or IP..."
				searchKeys={["userEmail", "userName", "ipAddress"]}
				pageSize={25}
			/>
		</div>
	);
}
