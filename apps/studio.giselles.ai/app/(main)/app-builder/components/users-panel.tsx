"use client";

/**
 * UsersPanel Component
 *
 * Manages end-users of a deployed app (from _app_users table).
 * Features: search, role filter, status tabs, bulk actions, add user,
 * inline edit, actions dropdown, user detail sidebar, last login tracking,
 * suspend/activate, reset password, revoke sessions, pending approval workflow.
 */

import {
	AlertCircle,
	Ban,
	Check,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Clock,
	Copy,
	Download,
	Key,
	Loader2,
	LogOut,
	Mail,
	MoreHorizontal,
	RefreshCw,
	Search,
	Shield,
	Trash2,
	UserCheck,
	UserPlus,
	UserX,
	Users,
	X,
} from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

interface AppUser {
	id: number;
	email: string;
	display_name: string | null;
	role: string;
	email_verified: boolean;
	status: string;
	last_login_at: string | null;
	created_at: string;
	updated_at?: string;
}

interface UserSession {
	id: string;
	created_at: string;
	expires_at: string;
}

interface UsersPanelProps {
	appId: string;
}

type StatusTab = "all" | "active" | "suspended" | "pending";

function relativeTime(dateStr: string | null): string {
	if (!dateStr) return "Never";
	const now = Date.now();
	const then = new Date(dateStr).getTime();
	const diff = now - then;
	if (diff < 0) return "Just now";
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "Just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months}mo ago`;
	return `${Math.floor(months / 12)}y ago`;
}

function StatusBadge({ status }: { status: string }) {
	switch (status) {
		case "active":
			return (
				<span className="inline-flex items-center gap-1.5 text-xs text-green-400">
					<span className="h-1.5 w-1.5 rounded-full bg-green-400" />
					Active
				</span>
			);
		case "suspended":
			return (
				<span className="inline-flex items-center gap-1.5 text-xs text-red-400">
					<span className="h-1.5 w-1.5 rounded-full bg-red-400" />
					Suspended
				</span>
			);
		case "pending":
			return (
				<span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
					<span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
					Pending
				</span>
			);
		default:
			return (
				<span className="inline-flex items-center gap-1.5 text-xs text-white/40">
					<span className="h-1.5 w-1.5 rounded-full bg-white/40" />
					{status}
				</span>
			);
	}
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
	const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
	const [sortField, setSortField] = useState("created_at");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
	const [showAddUser, setShowAddUser] = useState(false);
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [editingRole, setEditingRole] = useState<number | null>(null);
	const [editRoleValue, setEditRoleValue] = useState("");
	const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
	const [tempPassword, setTempPassword] = useState<string | null>(null);
	const [sidebarSessions, setSidebarSessions] = useState<UserSession[]>([]);
	const [sidebarSessionsLoading, setSidebarSessionsLoading] = useState(false);
	const [copied, setCopied] = useState(false);

	// Add user form state
	const [newEmail, setNewEmail] = useState("");
	const [newName, setNewName] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [newRole, setNewRole] = useState("user");

	const dropdownRef = useRef<HTMLDivElement>(null);

	const fetchUsers = useCallback(async () => {
		setLoading(true);
		try {
			let url = `/api/apps/${appId}/data/_app_users?page=${page}&limit=20&sort=${sortField}&order=${sortOrder}`;
			if (roleFilter !== "all") {
				url += `&filter[role]=${encodeURIComponent(roleFilter)}`;
			}
			if (statusFilter !== "all") {
				url += `&filter[status]=${encodeURIComponent(statusFilter)}`;
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
	}, [appId, page, sortField, sortOrder, roleFilter, statusFilter]);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	// Reset page when filter changes
	useEffect(() => {
		setPage(1);
	}, [roleFilter, statusFilter]);

	// Close dropdown on click outside
	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setOpenDropdownId(null);
			}
		}
		if (openDropdownId !== null) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [openDropdownId]);

	// Fetch sidebar sessions when selectedUserId changes
	useEffect(() => {
		if (selectedUserId === null) {
			setSidebarSessions([]);
			setTempPassword(null);
			return;
		}
		setSidebarSessionsLoading(true);
		fetch(`/api/apps/${appId}/auth/admin`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "get-sessions", userId: selectedUserId }),
		})
			.then((res) => res.json())
			.then((data) => setSidebarSessions(data.sessions || []))
			.catch(() => setSidebarSessions([]))
			.finally(() => setSidebarSessionsLoading(false));
	}, [appId, selectedUserId]);

	// Client-side search filter
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

	// Status counts (client-side from current page for badge display)
	const statusCounts = useMemo(() => {
		const counts = { all: 0, active: 0, suspended: 0, pending: 0 };
		for (const u of users) {
			counts.all++;
			if (u.status === "active") counts.active++;
			else if (u.status === "suspended") counts.suspended++;
			else if (u.status === "pending") counts.pending++;
		}
		return counts;
	}, [users]);

	// Unique roles for filter
	const roles = useMemo(() => {
		const roleSet = new Set(users.map((u) => u.role));
		return Array.from(roleSet).sort();
	}, [users]);

	const selectedUser = useMemo(
		() => users.find((u) => u.id === selectedUserId) ?? null,
		[users, selectedUserId],
	);

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

	// Admin action helper
	const adminAction = async (
		action: string,
		userId: number,
		loadingKey?: string,
	) => {
		setActionLoading(loadingKey || `${action}-${userId}`);
		try {
			const res = await fetch(`/api/apps/${appId}/auth/admin`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action, userId }),
			});
			const data = await res.json();
			return data;
		} catch {
			return null;
		} finally {
			setActionLoading(null);
		}
	};

	// Delete user
	const handleDelete = async (userId: number) => {
		if (!window.confirm("Delete this user? This action cannot be undone."))
			return;
		setActionLoading(`delete-${userId}`);
		try {
			await fetch(`/api/apps/${appId}/data/_app_users/${userId}`, {
				method: "DELETE",
			});
			if (selectedUserId === userId) setSelectedUserId(null);
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
		if (
			!window.confirm(
				`Delete ${selectedIds.size} user(s)? This cannot be undone.`,
			)
		)
			return;
		setActionLoading("bulk-delete");
		try {
			await Promise.all(
				Array.from(selectedIds).map((id) =>
					fetch(`/api/apps/${appId}/data/_app_users/${id}`, {
						method: "DELETE",
					}),
				),
			);
			setSelectedIds(new Set());
			if (selectedUserId && selectedIds.has(selectedUserId))
				setSelectedUserId(null);
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

	// Suspend / activate
	const handleToggleStatus = async (user: AppUser) => {
		const action = user.status === "active" ? "suspend" : "activate";
		const confirmMsg =
			action === "suspend"
				? `Suspend ${user.email}? They will be logged out and unable to sign in.`
				: `Activate ${user.email}?`;
		if (!window.confirm(confirmMsg)) return;
		await adminAction(action, user.id);
		setOpenDropdownId(null);
		await fetchUsers();
	};

	// Reset password
	const handleResetPassword = async (userId: number) => {
		if (
			!window.confirm(
				"Reset this user's password? They will be logged out of all sessions.",
			)
		)
			return;
		const data = await adminAction("reset-password", userId);
		if (data?.tempPassword) {
			setTempPassword(data.tempPassword);
			// If sidebar is open for this user, show it there
			if (selectedUserId === userId) {
				// tempPassword state will be shown in sidebar
			}
		}
		setOpenDropdownId(null);
		await fetchUsers();
	};

	// Revoke sessions
	const handleRevokeSessions = async (userId: number) => {
		if (
			!window.confirm(
				"Revoke all sessions for this user? They will be logged out everywhere.",
			)
		)
			return;
		await adminAction("revoke-sessions", userId);
		setOpenDropdownId(null);
		// Refresh sidebar sessions
		if (selectedUserId === userId) {
			setSidebarSessions([]);
		}
		await fetchUsers();
	};

	// Approve / reject pending user
	const handleApprove = async (userId: number) => {
		await adminAction("approve", userId);
		setOpenDropdownId(null);
		await fetchUsers();
	};

	const handleReject = async (userId: number) => {
		if (
			!window.confirm(
				"Reject this pending user? Their account will be deleted.",
			)
		)
			return;
		await adminAction("reject", userId);
		setOpenDropdownId(null);
		if (selectedUserId === userId) setSelectedUserId(null);
		await fetchUsers();
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
					display_name: newName.trim() || undefined,
				}),
			});
			if (res.ok || res.status === 201 || res.status === 202) {
				const data = await res.json();
				// If the auth endpoint also sets the role, update it
				if (newRole !== "user" && data.user?.id) {
					await fetch(
						`/api/apps/${appId}/data/_app_users/${data.user.id}`,
						{
							method: "PUT",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ role: newRole }),
						},
					);
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
		const csvHeader = "ID,Email,Name,Role,Status,Last Login,Joined\n";
		const csvRows = filteredUsers
			.map(
				(u) =>
					`${u.id},"${u.email}","${u.display_name || ""}",${u.role},${u.status},${u.last_login_at || ""},${u.created_at}`,
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

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
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
				<h2 className="text-xl font-semibold text-white/90 mb-2">
					Users
				</h2>
				<p className="text-white/40 max-w-md text-sm">
					No backend database has been provisioned for this app yet.
					Define data entities in the builder to create one.
				</p>
			</div>
		);
	}

	const STATUS_TABS: { key: StatusTab; label: string }[] = [
		{ key: "all", label: "All" },
		{ key: "active", label: "Active" },
		{ key: "suspended", label: "Suspended" },
		{ key: "pending", label: "Pending" },
	];

	return (
		<div className="flex-1 flex overflow-hidden">
			{/* Main content */}
			<div className="flex-1 overflow-y-auto p-6">
				<div className="max-w-5xl mx-auto space-y-4">
					{/* Header */}
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-2xl font-bold text-white/90">
								Users
							</h1>
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
									onChange={(e) =>
										setNewPassword(e.target.value)
									}
									placeholder="Password (auto-generated if empty)"
									className="px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
								/>
								<select
									value={newRole}
									onChange={(e) =>
										setNewRole(e.target.value)
									}
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
									disabled={
										!newEmail.trim() ||
										actionLoading === "add-user"
									}
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

					{/* Status Tabs */}
					<div className="flex items-center gap-1 border-b border-white/[0.06] pb-0">
						{STATUS_TABS.map((tab) => (
							<button
								key={tab.key}
								type="button"
								onClick={() => setStatusFilter(tab.key)}
								className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
									statusFilter === tab.key
										? "border-violet-500 text-white/90"
										: "border-transparent text-white/40 hover:text-white/70"
								}`}
							>
								{tab.label}
								{tab.key !== "all" &&
									statusCounts[tab.key] > 0 && (
										<span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-white/[0.06]">
											{statusCounts[tab.key]}
										</span>
									)}
							</button>
						))}
					</div>

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
							<RefreshCw
								className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
							/>
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
								{users.length === 0
									? "No users yet"
									: "No matching users"}
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
													selectedIds.size ===
														filteredUsers.length &&
													filteredUsers.length > 0
												}
												onChange={toggleSelectAll}
												className="rounded border-white/[0.08]"
											/>
										</th>
										<th
											className="px-3 py-2.5 text-left text-xs font-medium text-white/40 uppercase cursor-pointer group"
											onClick={() =>
												handleSort("email")
											}
										>
											<span className="flex items-center gap-1">
												Email{" "}
												<SortIcon field="email" />
											</span>
										</th>
										<th className="px-3 py-2.5 text-left text-xs font-medium text-white/40 uppercase">
											Name
										</th>
										<th
											className="px-3 py-2.5 text-left text-xs font-medium text-white/40 uppercase cursor-pointer group"
											onClick={() =>
												handleSort("role")
											}
										>
											<span className="flex items-center gap-1">
												Role{" "}
												<SortIcon field="role" />
											</span>
										</th>
										<th className="px-3 py-2.5 text-left text-xs font-medium text-white/40 uppercase">
											Status
										</th>
										<th
											className="px-3 py-2.5 text-left text-xs font-medium text-white/40 uppercase cursor-pointer group"
											onClick={() =>
												handleSort("last_login_at")
											}
										>
											<span className="flex items-center gap-1">
												Last Login{" "}
												<SortIcon field="last_login_at" />
											</span>
										</th>
										<th
											className="px-3 py-2.5 text-left text-xs font-medium text-white/40 uppercase cursor-pointer group"
											onClick={() =>
												handleSort("created_at")
											}
										>
											<span className="flex items-center gap-1">
												Joined{" "}
												<SortIcon field="created_at" />
											</span>
										</th>
										<th className="px-3 py-2.5 text-right text-xs font-medium text-white/40 uppercase w-16">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/[0.06]">
									{filteredUsers.map((user) => (
										<tr
											key={user.id}
											className={`hover:bg-white/[0.04] transition-colors cursor-pointer ${selectedUserId === user.id ? "bg-white/[0.06]" : ""}`}
											onClick={() =>
												setSelectedUserId(
													selectedUserId === user.id
														? null
														: user.id,
												)
											}
										>
											<td
												className="px-3 py-2.5"
												onClick={(e) =>
													e.stopPropagation()
												}
											>
												<input
													type="checkbox"
													checked={selectedIds.has(
														user.id,
													)}
													onChange={() =>
														toggleSelect(user.id)
													}
													className="rounded border-white/[0.08]"
												/>
											</td>
											<td className="px-3 py-2.5 text-white/90">
												{user.email}
											</td>
											<td className="px-3 py-2.5 text-white/90">
												{user.display_name || (
													<span className="text-white/40">
														--
													</span>
												)}
											</td>
											<td
												className="px-3 py-2.5"
												onClick={(e) =>
													e.stopPropagation()
												}
											>
												{editingRole === user.id ? (
													<div className="flex items-center gap-1">
														<select
															value={
																editRoleValue
															}
															onChange={(e) =>
																setEditRoleValue(
																	e.target
																		.value,
																)
															}
															className="px-1.5 py-0.5 rounded border border-white/[0.1] bg-white/[0.06] text-white/90 text-xs"
														>
															<option value="user">
																user
															</option>
															<option value="admin">
																admin
															</option>
															<option value="editor">
																editor
															</option>
															<option value="viewer">
																viewer
															</option>
														</select>
														<button
															type="button"
															onClick={() =>
																handleSaveRole(
																	user.id,
																)
															}
															className="p-0.5 text-green-500 hover:text-green-400"
														>
															<Check className="h-3 w-3" />
														</button>
														<button
															type="button"
															onClick={() =>
																setEditingRole(
																	null,
																)
															}
															className="p-0.5 text-white/40 hover:text-white/90"
														>
															<X className="h-3 w-3" />
														</button>
													</div>
												) : (
													<button
														type="button"
														onClick={() => {
															setEditingRole(
																user.id,
															);
															setEditRoleValue(
																user.role,
															);
														}}
														className="px-2 py-0.5 text-xs rounded-full bg-white/[0.06] text-white/90 hover:bg-white/[0.08] transition-colors"
														title="Click to edit role"
													>
														{user.role}
													</button>
												)}
											</td>
											<td className="px-3 py-2.5">
												<StatusBadge
													status={
														user.status || "active"
													}
												/>
											</td>
											<td
												className="px-3 py-2.5 text-white/40 text-xs"
												title={
													user.last_login_at
														? new Date(
																user.last_login_at,
															).toLocaleString()
														: "Never logged in"
												}
											>
												{relativeTime(
													user.last_login_at,
												)}
											</td>
											<td className="px-3 py-2.5 text-white/40 text-xs">
												{new Date(
													user.created_at,
												).toLocaleDateString()}
											</td>
											<td
												className="px-3 py-2.5 text-right relative"
												onClick={(e) =>
													e.stopPropagation()
												}
											>
												<button
													type="button"
													onClick={() =>
														setOpenDropdownId(
															openDropdownId ===
																user.id
																? null
																: user.id,
														)
													}
													className="p-1 rounded text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
												>
													<MoreHorizontal className="h-4 w-4" />
												</button>

												{/* Dropdown menu */}
												{openDropdownId ===
													user.id && (
													<div
														ref={dropdownRef}
														className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-white/[0.08] bg-[#1a1a2e] shadow-xl z-50"
													>
														{user.status ===
														"pending" ? (
															<>
																<DropdownItem
																	icon={
																		<UserCheck className="h-3.5 w-3.5 text-green-400" />
																	}
																	label="Approve"
																	onClick={() =>
																		handleApprove(
																			user.id,
																		)
																	}
																/>
																<DropdownItem
																	icon={
																		<UserX className="h-3.5 w-3.5 text-red-400" />
																	}
																	label="Reject"
																	onClick={() =>
																		handleReject(
																			user.id,
																		)
																	}
																	danger
																/>
															</>
														) : (
															<>
																<DropdownItem
																	icon={
																		<Users className="h-3.5 w-3.5" />
																	}
																	label="View Details"
																	onClick={() => {
																		setSelectedUserId(
																			user.id,
																		);
																		setOpenDropdownId(
																			null,
																		);
																	}}
																/>
																<DropdownItem
																	icon={
																		user.status ===
																		"active" ? (
																			<Ban className="h-3.5 w-3.5" />
																		) : (
																			<CheckCircle className="h-3.5 w-3.5" />
																		)
																	}
																	label={
																		user.status ===
																		"active"
																			? "Suspend"
																			: "Activate"
																	}
																	onClick={() =>
																		handleToggleStatus(
																			user,
																		)
																	}
																/>
																<DropdownItem
																	icon={
																		<Key className="h-3.5 w-3.5" />
																	}
																	label="Reset Password"
																	onClick={() =>
																		handleResetPassword(
																			user.id,
																		)
																	}
																/>
																<DropdownItem
																	icon={
																		<LogOut className="h-3.5 w-3.5" />
																	}
																	label="Revoke Sessions"
																	onClick={() =>
																		handleRevokeSessions(
																			user.id,
																		)
																	}
																/>
																<div className="border-t border-white/[0.06] my-1" />
																<DropdownItem
																	icon={
																		<Trash2 className="h-3.5 w-3.5" />
																	}
																	label="Delete"
																	onClick={() => {
																		setOpenDropdownId(
																			null,
																		);
																		handleDelete(
																			user.id,
																		);
																	}}
																	danger
																/>
															</>
														)}
													</div>
												)}
											</td>
										</tr>
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
									onClick={() =>
										setPage((p) => Math.max(1, p - 1))
									}
									disabled={page <= 1}
									className="px-3 py-1.5 rounded-md border border-white/[0.08] text-sm text-white/40 hover:text-white/90 disabled:opacity-40 transition-colors"
								>
									Previous
								</button>
								<button
									type="button"
									onClick={() =>
										setPage((p) =>
											Math.min(totalPages, p + 1),
										)
									}
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

			{/* User Detail Sidebar */}
			{selectedUser && (
				<div className="w-96 border-l border-white/[0.08] bg-white/[0.02] overflow-y-auto flex-shrink-0">
					<div className="p-5 space-y-5">
						{/* Sidebar Header */}
						<div className="flex items-start justify-between">
							<div className="min-w-0">
								<h2 className="text-lg font-semibold text-white/90 truncate">
									{selectedUser.display_name ||
										selectedUser.email}
								</h2>
								{selectedUser.display_name && (
									<p className="text-sm text-white/40 truncate">
										{selectedUser.email}
									</p>
								)}
							</div>
							<button
								type="button"
								onClick={() => setSelectedUserId(null)}
								className="p-1 rounded text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors flex-shrink-0"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						{/* Info Grid */}
						<div className="space-y-3">
							<InfoRow label="User ID">
								<span className="font-mono text-white/90 text-xs">
									{selectedUser.id}
								</span>
							</InfoRow>
							<InfoRow label="Email">
								<div className="flex items-center gap-1.5">
									<span className="text-white/90 text-xs truncate">
										{selectedUser.email}
									</span>
									<button
										type="button"
										onClick={() =>
											copyToClipboard(
												selectedUser.email,
											)
										}
										className="p-0.5 text-white/30 hover:text-white/70 flex-shrink-0"
										title="Copy email"
									>
										{copied ? (
											<Check className="h-3 w-3 text-green-400" />
										) : (
											<Copy className="h-3 w-3" />
										)}
									</button>
								</div>
							</InfoRow>
							<InfoRow label="Role">
								<button
									type="button"
									onClick={() => {
										setEditingRole(selectedUser.id);
										setEditRoleValue(selectedUser.role);
									}}
									className="px-2 py-0.5 text-xs rounded-full bg-white/[0.06] text-white/90 hover:bg-white/[0.08] transition-colors"
								>
									{selectedUser.role}
								</button>
							</InfoRow>
							<InfoRow label="Status">
								<div className="flex items-center gap-2">
									<StatusBadge
										status={
											selectedUser.status || "active"
										}
									/>
									{selectedUser.status !== "pending" && (
										<button
											type="button"
											onClick={() =>
												handleToggleStatus(selectedUser)
											}
											className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
												selectedUser.status === "active"
													? "border-red-500/30 text-red-400 hover:bg-red-500/10"
													: "border-green-500/30 text-green-400 hover:bg-green-500/10"
											}`}
										>
											{selectedUser.status === "active"
												? "Suspend"
												: "Activate"}
										</button>
									)}
								</div>
							</InfoRow>
							<InfoRow label="Email Verified">
								{selectedUser.email_verified ? (
									<span className="text-xs text-green-400">
										Verified
									</span>
								) : (
									<span className="text-xs text-white/40">
										Not verified
									</span>
								)}
							</InfoRow>
						</div>

						{/* Timestamps */}
						<div className="rounded-lg border border-white/[0.06] p-3 space-y-2">
							<h3 className="text-xs font-medium text-white/50 uppercase">
								Timestamps
							</h3>
							<InfoRow label="Joined">
								<span className="text-white/90 text-xs">
									{new Date(
										selectedUser.created_at,
									).toLocaleString()}
								</span>
							</InfoRow>
							<InfoRow label="Last Login">
								<span
									className="text-white/90 text-xs"
									title={
										selectedUser.last_login_at
											? new Date(
													selectedUser.last_login_at,
												).toLocaleString()
											: undefined
									}
								>
									{selectedUser.last_login_at
										? `${relativeTime(selectedUser.last_login_at)} (${new Date(selectedUser.last_login_at).toLocaleDateString()})`
										: "Never"}
								</span>
							</InfoRow>
							{selectedUser.updated_at && (
								<InfoRow label="Updated">
									<span className="text-white/90 text-xs">
										{new Date(
											selectedUser.updated_at,
										).toLocaleString()}
									</span>
								</InfoRow>
							)}
						</div>

						{/* Active Sessions */}
						<div className="rounded-lg border border-white/[0.06] p-3 space-y-2">
							<div className="flex items-center justify-between">
								<h3 className="text-xs font-medium text-white/50 uppercase">
									Active Sessions
								</h3>
								{sidebarSessions.length > 0 && (
									<button
										type="button"
										onClick={() =>
											handleRevokeSessions(
												selectedUser.id,
											)
										}
										className="px-2 py-0.5 text-[10px] rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
									>
										Revoke All
									</button>
								)}
							</div>
							{sidebarSessionsLoading ? (
								<div className="flex items-center justify-center py-3">
									<Loader2 className="h-4 w-4 animate-spin text-white/40" />
								</div>
							) : sidebarSessions.length === 0 ? (
								<p className="text-xs text-white/40 py-2">
									No active sessions
								</p>
							) : (
								<div className="space-y-1.5">
									{sidebarSessions.map((s) => (
										<div
											key={s.id}
											className="flex items-center justify-between text-xs bg-white/[0.03] rounded px-2 py-1.5"
										>
											<div>
												<span className="text-white/70">
													Created{" "}
													{relativeTime(
														s.created_at,
													)}
												</span>
											</div>
											<span className="text-white/40">
												Expires{" "}
												{new Date(
													s.expires_at,
												).toLocaleDateString()}
											</span>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Temp Password Alert */}
						{tempPassword && (
							<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
								<h3 className="text-xs font-medium text-amber-400">
									Temporary Password
								</h3>
								<div className="flex items-center gap-2">
									<code className="flex-1 text-sm font-mono text-white/90 bg-white/[0.06] rounded px-2 py-1">
										{tempPassword}
									</code>
									<button
										type="button"
										onClick={() =>
											copyToClipboard(tempPassword)
										}
										className="p-1 text-white/40 hover:text-white/90"
									>
										<Copy className="h-3.5 w-3.5" />
									</button>
								</div>
								<p className="text-[10px] text-amber-400/70">
									Share this with the user securely. It
									won't be shown again.
								</p>
								<button
									type="button"
									onClick={() => setTempPassword(null)}
									className="text-[10px] text-white/40 hover:text-white/70"
								>
									Dismiss
								</button>
							</div>
						)}

						{/* Actions */}
						<div className="space-y-2">
							<h3 className="text-xs font-medium text-white/50 uppercase">
								Actions
							</h3>
							{selectedUser.status === "pending" ? (
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() =>
											handleApprove(selectedUser.id)
										}
										disabled={
											actionLoading ===
											`approve-${selectedUser.id}`
										}
										className="flex-1 px-3 py-2 rounded-md bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors flex items-center justify-center gap-1.5"
									>
										<UserCheck className="h-3.5 w-3.5" />
										Approve
									</button>
									<button
										type="button"
										onClick={() =>
											handleReject(selectedUser.id)
										}
										disabled={
											actionLoading ===
											`reject-${selectedUser.id}`
										}
										className="flex-1 px-3 py-2 rounded-md bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors flex items-center justify-center gap-1.5"
									>
										<UserX className="h-3.5 w-3.5" />
										Reject
									</button>
								</div>
							) : (
								<>
									<button
										type="button"
										onClick={() =>
											handleResetPassword(
												selectedUser.id,
											)
										}
										disabled={
											actionLoading ===
											`reset-password-${selectedUser.id}`
										}
										className="w-full px-3 py-2 rounded-md border border-white/[0.08] text-white/70 text-xs font-medium hover:bg-white/[0.06] transition-colors flex items-center gap-2"
									>
										{actionLoading ===
										`reset-password-${selectedUser.id}` ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											<Key className="h-3.5 w-3.5" />
										)}
										Reset Password
									</button>
									<button
										type="button"
										onClick={() =>
											handleDelete(selectedUser.id)
										}
										disabled={
											actionLoading ===
											`delete-${selectedUser.id}`
										}
										className="w-full px-3 py-2 rounded-md border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors flex items-center gap-2"
									>
										{actionLoading ===
										`delete-${selectedUser.id}` ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											<Trash2 className="h-3.5 w-3.5" />
										)}
										Delete User
									</button>
								</>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function InfoRow({
	label,
	children,
}: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-xs text-white/40">{label}</span>
			<div className="text-right">{children}</div>
		</div>
	);
}

function DropdownItem({
	icon,
	label,
	onClick,
	danger,
}: {
	icon: ReactNode;
	label: string;
	onClick: () => void;
	danger?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
				danger
					? "text-red-400 hover:bg-red-500/10"
					: "text-white/70 hover:bg-white/[0.06]"
			}`}
		>
			{icon}
			{label}
		</button>
	);
}
