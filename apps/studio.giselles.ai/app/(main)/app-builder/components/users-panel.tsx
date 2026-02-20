"use client";

/**
 * UsersPanel Component
 *
 * Manages end-users of a deployed app (from _app_users table).
 * Features: search, role filter, bulk actions, add user, inline edit, delete.
 */

import {
	AlertCircle,
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	Download,
	Loader2,
	Mail,
	MoreHorizontal,
	Plus,
	RefreshCw,
	Search,
	Shield,
	Trash2,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface AppUser {
	id: number;
	email: string;
	display_name: string | null;
	role: string;
	email_verified: boolean;
	created_at: string;
	updated_at?: string;
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
	const [search, setSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");
	const [sortField, setSortField] = useState("created_at");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [expandedId, setExpandedId] = useState<number | null>(null);
	const [showAddUser, setShowAddUser] = useState(false);
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [editingRole, setEditingRole] = useState<number | null>(null);
	const [editRoleValue, setEditRoleValue] = useState("");
	const [copied, setCopied] = useState(false);

	// Add user form state
	const [newEmail, setNewEmail] = useState("");
	const [newName, setNewName] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [newRole, setNewRole] = useState("user");

	const fetchUsers = useCallback(async () => {
		setLoading(true);
		try {
			let url = `/api/apps/${appId}/data/_app_users?page=${page}&limit=20&sort=${sortField}&order=${sortOrder}`;
			if (roleFilter !== "all") {
				url += `&filter[role]=${encodeURIComponent(roleFilter)}`;
			}
			const res = await fetch(url);
			if (res.ok) {
				const json = await res.json();
				setUsers(json.data || []);
				setTotalPages(json.pagination?.totalPages || 1);
				setTotal(json.pagination?.total || 0);
				setHasDatabase(true);
			} else if (res.status === 503) {
				setHasDatabase(false);
			}
		} catch {
			// Fetch failed
		} finally {
			setLoading(false);
		}
	}, [appId, page, sortField, sortOrder, roleFilter]);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	// Reset page when filter changes
	useEffect(() => {
		setPage(1);
	}, [roleFilter]);

	// Client-side search filter (search within fetched page)
	const filteredUsers = useMemo(() => {
		if (!search.trim()) return users;
		const q = search.toLowerCase().trim();
		return users.filter(
			(u) =>
				u.email.toLowerCase().includes(q) ||
				(u.display_name && u.display_name.toLowerCase().includes(q)) ||
				u.role.toLowerCase().includes(q),
		);
	}, [users, search]);

	// Unique roles for filter
	const roles = useMemo(() => {
		const roleSet = new Set(users.map((u) => u.role));
		return Array.from(roleSet).sort();
	}, [users]);

	// Selection handlers
	const toggleSelect = (id: number) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleSelectAll = () => {
		if (selectedIds.size === filteredUsers.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(filteredUsers.map((u) => u.id)));
		}
	};

	// Sort handler
	const handleSort = (field: string) => {
		if (sortField === field) {
			setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
		} else {
			setSortField(field);
			setSortOrder("asc");
		}
	};

	const SortIcon = ({ field }: { field: string }) => {
		if (sortField !== field)
			return <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-30" />;
		return sortOrder === "asc" ? (
			<ChevronUp className="h-3 w-3" />
		) : (
			<ChevronDown className="h-3 w-3" />
		);
	};

	// Delete user
	const handleDelete = async (userId: number) => {
		if (!window.confirm("Delete this user? This action cannot be undone.")) return;
		setActionLoading(`delete-${userId}`);
		try {
			await fetch(`/api/apps/${appId}/data/_app_users/${userId}`, { method: "DELETE" });
			await fetchUsers();
			setSelectedIds((prev) => {
				const next = new Set(prev);
				next.delete(userId);
				return next;
			});
		} catch {
			// Error
		}
		setActionLoading(null);
	};

	// Bulk delete
	const handleBulkDelete = async () => {
		if (selectedIds.size === 0) return;
		if (!window.confirm(`Delete ${selectedIds.size} user(s)? This cannot be undone.`)) return;
		setActionLoading("bulk-delete");
		try {
			await Promise.all(
				Array.from(selectedIds).map((id) =>
					fetch(`/api/apps/${appId}/data/_app_users/${id}`, { method: "DELETE" }),
				),
			);
			setSelectedIds(new Set());
			await fetchUsers();
		} catch {
			// Error
		}
		setActionLoading(null);
	};

	// Update role
	const handleSaveRole = async (userId: number) => {
		setActionLoading(`role-${userId}`);
		try {
			await fetch(`/api/apps/${appId}/data/_app_users/${userId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ role: editRoleValue }),
			});
			setEditingRole(null);
			await fetchUsers();
		} catch {
			// Error
		}
		setActionLoading(null);
	};

	// Add user
	const handleAddUser = async () => {
		if (!newEmail.trim()) return;
		setActionLoading("add-user");
		try {
			const res = await fetch(`/api/apps/${appId}/auth/signup`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: newEmail.trim(),
					password: newPassword || "TempPass123!",
					displayName: newName.trim() || undefined,
				}),
			});
			if (res.ok) {
				// If the auth endpoint also sets the role, update it
				if (newRole !== "user") {
					const data = await res.json();
					if (data.user?.id) {
						await fetch(`/api/apps/${appId}/data/_app_users/${data.user.id}`, {
							method: "PUT",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ role: newRole }),
						});
					}
				}
				setShowAddUser(false);
				setNewEmail("");
				setNewName("");
				setNewPassword("");
				setNewRole("user");
				await fetchUsers();
			}
		} catch {
			// Error
		}
		setActionLoading(null);
	};

	// Export users
	const handleExport = () => {
		const csvHeader = "ID,Email,Name,Role,Verified,Joined\n";
		const csvRows = filteredUsers
			.map(
				(u) =>
					`${u.id},"${u.email}","${u.display_name || ""}",${u.role},${u.email_verified},${u.created_at}`,
			)
			.join("\n");
		const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `app-users-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	if (loading && users.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-white/40" />
			</div>
		);
	}

	if (!hasDatabase) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
				<Users className="h-12 w-12 text-white/20 mb-4" />
				<h2 className="text-xl font-semibold text-white/90 mb-2">Users</h2>
				<p className="text-white/40 max-w-md text-sm">
					No backend database has been provisioned for this app yet. Define data
					entities in the builder to create one.
				</p>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-5xl mx-auto space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-white/90">Users</h1>
						<p className="text-sm text-white/40 mt-1">
							{total} registered user{total !== 1 ? "s" : ""}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleExport}
							className="px-3 py-1.5 rounded-md border border-white/[0.08] text-sm font-medium text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors flex items-center gap-1.5"
						>
							<Download className="h-3.5 w-3.5" />
							Export
						</button>
						<button
							type="button"
							onClick={() => setShowAddUser(!showAddUser)}
							className="px-3 py-1.5 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white hover:from-violet-500 hover:to-cyan-500 text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
						>
							<UserPlus className="h-3.5 w-3.5" />
							Add User
						</button>
					</div>
				</div>

				{/* Add User Form */}
				{showAddUser && (
					<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-3">
						<h3 className="text-sm font-medium text-white/90">
							Create New User
						</h3>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<input
								type="email"
								value={newEmail}
								onChange={(e) => setNewEmail(e.target.value)}
								placeholder="Email address *"
								className="px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
							/>
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="Display name"
								className="px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
							/>
							<input
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								placeholder="Password (auto-generated if empty)"
								className="px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
							/>
							<select
								value={newRole}
								onChange={(e) => setNewRole(e.target.value)}
								className="px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
							>
								<option value="user">User</option>
								<option value="admin">Admin</option>
								<option value="editor">Editor</option>
								<option value="viewer">Viewer</option>
							</select>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={handleAddUser}
								disabled={!newEmail.trim() || actionLoading === "add-user"}
								className="px-4 py-2 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white hover:from-violet-500 hover:to-cyan-500 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
							>
								{actionLoading === "add-user" && (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								)}
								Create User
							</button>
							<button
								type="button"
								onClick={() => setShowAddUser(false)}
								className="px-4 py-2 rounded-md border border-white/[0.08] text-sm font-medium text-white/40 hover:text-white/90 transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>
				)}

				{/* Search + Filters */}
				<div className="flex flex-col sm:flex-row gap-3">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search by email or name..."
							className="w-full pl-9 pr-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
						/>
					</div>
					<select
						value={roleFilter}
						onChange={(e) => setRoleFilter(e.target.value)}
						className="px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
					>
						<option value="all">All Roles</option>
						{roles.map((r) => (
							<option key={r} value={r}>
								{r.charAt(0).toUpperCase() + r.slice(1)}
							</option>
						))}
					</select>
					<button
						type="button"
						onClick={() => fetchUsers()}
						className="p-2 rounded-md border border-white/[0.08] hover:bg-white/[0.06] text-white/40 hover:text-white/90 transition-colors"
						title="Refresh"
					>
						<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
					</button>
				</div>

				{/* Bulk Actions Bar */}
				{selectedIds.size > 0 && (
					<div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/[0.04] backdrop-blur-sm border border-white/[0.08]">
						<span className="text-sm text-white/90 font-medium">
							{selectedIds.size} selected
						</span>
						<button
							type="button"
							onClick={handleBulkDelete}
							disabled={actionLoading === "bulk-delete"}
							className="px-3 py-1 rounded-md border border-red-500/50 text-red-500 text-xs font-medium hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
						>
							{actionLoading === "bulk-delete" ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<Trash2 className="h-3 w-3" />
							)}
							Delete
						</button>
						<button
							type="button"
							onClick={() => setSelectedIds(new Set())}
							className="text-xs text-white/40 hover:text-white/90 transition-colors"
						>
							Clear selection
						</button>
					</div>
				)}

				{/* User Table */}
				{filteredUsers.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm">
						<Users className="h-10 w-10 text-white/20 mb-3" />
						<h3 className="text-sm font-medium text-white/90 mb-1">
							{users.length === 0 ? "No users yet" : "No matching users"}
						</h3>
						<p className="text-xs text-white/40 max-w-sm">
							{users.length === 0
								? "Users will appear here when they sign up through your app."
								: "Try adjusting your search or filter criteria."}
						</p>
					</div>
				) : (
					<div className="overflow-x-auto rounded-xl border border-white/[0.08]">
						<table className="w-full text-sm">
							<thead>
								<tr className="bg-white/[0.03]">
									<th className="px-3 py-2.5 text-left w-8">
										<input
											type="checkbox"
											checked={
												selectedIds.size === filteredUsers.length &&
												filteredUsers.length > 0
											}
											onChange={toggleSelectAll}
											className="rounded border-white/[0.08]"
										/>
									</th>
									<th
										className="px-3 py-2.5 text-left text-xs font-medium text-white/40 uppercase cursor-pointer group"
										onClick={() => handleSort("email")}
									>
										<span className="flex items-center gap-1">
											Email <SortIcon field="email" />
										</span>
									</th>
									<th className="px-3 py-2.5 text-left text-xs font-medium text-white/40 uppercase">
										Name
									</th>
									<th
										className="px-3 py-2.5 text-left text-xs font-medium text-white/40 uppercase cursor-pointer group"
										onClick={() => handleSort("role")}
									>
										<span className="flex items-center gap-1">
											Role <SortIcon field="role" />
										</span>
									</th>
									<th className="px-3 py-2.5 text-left text-xs font-medium text-white/40 uppercase">
										Status
									</th>
									<th
										className="px-3 py-2.5 text-left text-xs font-medium text-white/40 uppercase cursor-pointer group"
										onClick={() => handleSort("created_at")}
									>
										<span className="flex items-center gap-1">
											Joined <SortIcon field="created_at" />
										</span>
									</th>
									<th className="px-3 py-2.5 text-right text-xs font-medium text-white/40 uppercase w-20">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/[0.06]">
								{filteredUsers.map((user) => (
									<>
										<tr
											key={user.id}
											className={`hover:bg-white/[0.04] transition-colors ${expandedId === user.id ? "bg-white/[0.04]" : ""}`}
										>
											<td className="px-3 py-2.5">
												<input
													type="checkbox"
													checked={selectedIds.has(user.id)}
													onChange={() => toggleSelect(user.id)}
													className="rounded border-white/[0.08]"
												/>
											</td>
											<td className="px-3 py-2.5">
												<button
													type="button"
													onClick={() =>
														setExpandedId(
															expandedId === user.id ? null : user.id,
														)
													}
													className="text-white/90 hover:underline text-left"
												>
													{user.email}
												</button>
											</td>
											<td className="px-3 py-2.5 text-white/90">
												{user.display_name || (
													<span className="text-white/40">--</span>
												)}
											</td>
											<td className="px-3 py-2.5">
												{editingRole === user.id ? (
													<div className="flex items-center gap-1">
														<select
															value={editRoleValue}
															onChange={(e) =>
																setEditRoleValue(e.target.value)
															}
															className="px-1.5 py-0.5 rounded border border-white/[0.1] bg-white/[0.06] text-white/90 text-xs"
														>
															<option value="user">user</option>
															<option value="admin">admin</option>
															<option value="editor">editor</option>
															<option value="viewer">viewer</option>
														</select>
														<button
															type="button"
															onClick={() => handleSaveRole(user.id)}
															className="p-0.5 text-green-500 hover:text-green-400"
														>
															<Check className="h-3 w-3" />
														</button>
														<button
															type="button"
															onClick={() => setEditingRole(null)}
															className="p-0.5 text-white/40 hover:text-white/90"
														>
															<X className="h-3 w-3" />
														</button>
													</div>
												) : (
													<button
														type="button"
														onClick={() => {
															setEditingRole(user.id);
															setEditRoleValue(user.role);
														}}
														className="px-2 py-0.5 text-xs rounded-full bg-white/[0.06] text-white/90 hover:bg-white/[0.08] transition-colors"
														title="Click to edit role"
													>
														{user.role}
													</button>
												)}
											</td>
											<td className="px-3 py-2.5">
												{user.email_verified ? (
													<span className="inline-flex items-center gap-1 text-xs text-green-500">
														<Check className="h-3 w-3" />
														Verified
													</span>
												) : (
													<span className="inline-flex items-center gap-1 text-xs text-white/40">
														<AlertCircle className="h-3 w-3" />
														Pending
													</span>
												)}
											</td>
											<td className="px-3 py-2.5 text-white/40 text-xs">
												{new Date(user.created_at).toLocaleDateString()}
											</td>
											<td className="px-3 py-2.5 text-right">
												<button
													type="button"
													onClick={() => handleDelete(user.id)}
													disabled={
														actionLoading === `delete-${user.id}`
													}
													className="p-1 rounded text-white/40 hover:text-red-500 hover:bg-red-500/10 transition-colors"
													title="Delete user"
												>
													{actionLoading === `delete-${user.id}` ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													) : (
														<Trash2 className="h-3.5 w-3.5" />
													)}
												</button>
											</td>
										</tr>
										{/* Expanded detail row */}
										{expandedId === user.id && (
											<tr key={`${user.id}-detail`}>
												<td colSpan={7} className="px-6 py-4 bg-white/[0.01]">
													<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
														<div>
															<span className="text-white/40 block mb-1">
																User ID
															</span>
															<span className="text-white/90 font-mono">
																{user.id}
															</span>
														</div>
														<div>
															<span className="text-white/40 block mb-1">
																Email
															</span>
															<span className="text-white/90">
																{user.email}
															</span>
														</div>
														<div>
															<span className="text-white/40 block mb-1">
																Created
															</span>
															<span className="text-white/90">
																{new Date(
																	user.created_at,
																).toLocaleString()}
															</span>
														</div>
														<div>
															<span className="text-white/40 block mb-1">
																Updated
															</span>
															<span className="text-white/90">
																{user.updated_at
																	? new Date(
																			user.updated_at,
																		).toLocaleString()
																	: "--"}
															</span>
														</div>
													</div>
												</td>
											</tr>
										)}
									</>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Pagination */}
				{totalPages > 1 && (
					<div className="flex items-center justify-between">
						<p className="text-xs text-white/40">
							Page {page} of {totalPages} ({total} total)
						</p>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page <= 1}
								className="px-3 py-1.5 rounded-md border border-white/[0.08] text-sm text-white/40 hover:text-white/90 disabled:opacity-40 transition-colors"
							>
								Previous
							</button>
							<button
								type="button"
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								disabled={page >= totalPages}
								className="px-3 py-1.5 rounded-md border border-white/[0.08] text-sm text-white/40 hover:text-white/90 disabled:opacity-40 transition-colors"
							>
								Next
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
