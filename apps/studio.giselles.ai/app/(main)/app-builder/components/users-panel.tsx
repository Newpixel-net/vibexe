"use client";

/**
 * UsersPanel Component
 *
 * Manages end-users of a deployed app (from _app_users table).
 * Shows user list with pagination, and allows viewing details.
 */

import { useCallback, useEffect, useState } from "react";

interface AppUser {
	id: number;
	email: string;
	display_name: string | null;
	role: string;
	email_verified: boolean;
	created_at: string;
}

interface UsersPanelProps {
	appId: string;
}

export function UsersPanel({ appId }: UsersPanelProps) {
	const [users, setUsers] = useState<AppUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [hasDatabase, setHasDatabase] = useState(false);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [total, setTotal] = useState(0);

	const fetchUsers = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch(
				`/api/apps/${appId}/data/_app_users?page=${page}&limit=20&sort=created_at&order=desc`,
			);
			if (res.ok) {
				const json = await res.json();
				setUsers(json.data || []);
				setTotalPages(json.pagination?.totalPages || 1);
				setTotal(json.pagination?.total || 0);
				setHasDatabase(true);
			} else if (res.status === 503) {
				// No database provisioned yet
				setHasDatabase(false);
			}
		} catch {
			// Fetch failed
		} finally {
			setLoading(false);
		}
	}, [appId, page]);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-16">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
			</div>
		);
	}

	if (!hasDatabase) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
				<h2 className="text-xl font-semibold text-zinc-200 mb-2">
					Users
				</h2>
				<p className="text-zinc-400 max-w-md">
					No backend database has been provisioned for this app yet.
					Define data entities in the builder to create one.
				</p>
			</div>
		);
	}

	return (
		<div className="p-6">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="text-xl font-semibold text-zinc-200">Users</h2>
					<p className="text-sm text-zinc-400 mt-1">
						{total} registered user{total !== 1 ? "s" : ""}
					</p>
				</div>
			</div>

			{users.length === 0 ? (
				<div className="text-center py-12 text-zinc-500">
					<p className="text-lg mb-2">No users yet</p>
					<p className="text-sm">
						Users will appear here when they sign up through your app.
					</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-lg border border-zinc-700">
					<table className="w-full text-sm">
						<thead>
							<tr className="bg-zinc-800/50">
								<th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase">
									ID
								</th>
								<th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase">
									Email
								</th>
								<th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase">
									Name
								</th>
								<th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase">
									Role
								</th>
								<th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase">
									Verified
								</th>
								<th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase">
									Joined
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-zinc-700/50">
							{users.map((user) => (
								<tr
									key={user.id}
									className="hover:bg-zinc-800/30 transition-colors"
								>
									<td className="px-4 py-2.5 text-zinc-300">
										{user.id}
									</td>
									<td className="px-4 py-2.5 text-zinc-300">
										{user.email}
									</td>
									<td className="px-4 py-2.5 text-zinc-300">
										{user.display_name || "—"}
									</td>
									<td className="px-4 py-2.5">
										<span className="px-2 py-0.5 text-xs rounded-full bg-zinc-700 text-zinc-300">
											{user.role}
										</span>
									</td>
									<td className="px-4 py-2.5">
										{user.email_verified ? (
											<span className="text-green-400 text-xs">Verified</span>
										) : (
											<span className="text-zinc-500 text-xs">Pending</span>
										)}
									</td>
									<td className="px-4 py-2.5 text-zinc-400 text-xs">
										{new Date(user.created_at).toLocaleDateString()}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-2 mt-4">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page <= 1}
						className="px-3 py-1 text-sm rounded bg-zinc-700 text-zinc-300 disabled:opacity-40 hover:bg-zinc-600"
					>
						Prev
					</button>
					<span className="text-sm text-zinc-400">
						Page {page} of {totalPages}
					</span>
					<button
						type="button"
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page >= totalPages}
						className="px-3 py-1 text-sm rounded bg-zinc-700 text-zinc-300 disabled:opacity-40 hover:bg-zinc-600"
					>
						Next
					</button>
				</div>
			)}
		</div>
	);
}
