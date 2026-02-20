"use client";

/**
 * SecurityPanel Component
 *
 * API key management and security settings.
 * Creates, lists, and revokes API keys for the app.
 */

import {
	AlertTriangle,
	Check,
	Copy,
	Eye,
	EyeOff,
	Key,
	Loader2,
	Lock,
	Plus,
	Shield,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface ApiKeyInfo {
	id: number;
	keyPrefix: string;
	label: string;
	createdAt: string;
	lastUsedAt: string | null;
}

interface EntityPolicy {
	entityName: string;
	readAccess: string;
	writeAccess: string;
	deleteAccess: string;
}

interface SecurityPanelProps {
	appId: string;
}

const ACCESS_OPTIONS = [
	{ value: "public", label: "Public" },
	{ value: "authenticated", label: "Authenticated" },
	{ value: "owner", label: "Owner Only" },
];

export function SecurityPanel({ appId }: SecurityPanelProps) {
	const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [policies, setPolicies] = useState<EntityPolicy[]>([]);
	const [policiesLoading, setPoliciesLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [newKeyLabel, setNewKeyLabel] = useState("");
	const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [copied, setCopied] = useState(false);

	const fetchKeys = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/api-keys`);
			if (res.ok) {
				const data = await res.json();
				setKeys(data.keys || []);
			}
		} catch {
			// Ignore
		}
		setLoading(false);
	}, [appId]);

	useEffect(() => {
		fetchKeys();
	}, [fetchKeys]);

	// Fetch entity access policies
	useEffect(() => {
		async function fetchPolicies() {
			try {
				const res = await fetch(`/api/apps/${appId}/security/policies`);
				if (res.ok) {
					const data = await res.json();
					setPolicies(data.policies || []);
				}
			} catch {
				// Ignore
			}
			setPoliciesLoading(false);
		}
		fetchPolicies();
	}, [appId]);

	const updatePolicy = useCallback(
		async (entityName: string, field: "readAccess" | "writeAccess" | "deleteAccess", value: string) => {
			setPolicies((prev) =>
				prev.map((p) =>
					p.entityName === entityName ? { ...p, [field]: value } : p,
				),
			);
			try {
				const policy = policies.find((p) => p.entityName === entityName);
				await fetch(`/api/apps/${appId}/security/policies`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						entityName,
						readAccess: field === "readAccess" ? value : policy?.readAccess ?? "public",
						writeAccess: field === "writeAccess" ? value : policy?.writeAccess ?? "authenticated",
						deleteAccess: field === "deleteAccess" ? value : policy?.deleteAccess ?? "authenticated",
					}),
				});
			} catch {
				// Revert on error - refetch
			}
		},
		[appId, policies],
	);

	const handleCreate = useCallback(async () => {
		if (!newKeyLabel.trim()) return;
		setCreating(true);
		try {
			const res = await fetch(`/api/apps/${appId}/api-keys`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ label: newKeyLabel.trim() }),
			});
			if (res.ok) {
				const data = await res.json();
				setNewKeyValue(data.key);
				fetchKeys();
			}
		} catch {
			// Error handling
		}
		setCreating(false);
	}, [appId, newKeyLabel, fetchKeys]);

	const handleRevoke = useCallback(
		async (keyId: number) => {
			if (!window.confirm("Revoke this API key? This cannot be undone."))
				return;
			try {
				await fetch(`/api/apps/${appId}/api-keys/${keyId}`, {
					method: "DELETE",
				});
				fetchKeys();
			} catch {
				// Ignore
			}
		},
		[appId, fetchKeys],
	);

	const handleCopyKey = useCallback(async () => {
		if (!newKeyValue) return;
		try {
			await navigator.clipboard.writeText(newKeyValue);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard may fail
		}
	}, [newKeyValue]);

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-white/40" />
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-white/90">App Security</h1>
						<p className="text-sm text-white/40 mt-1">
							Manage entity access policies and API keys
						</p>
					</div>
					{!showCreateForm && (
						<button
							type="button"
							onClick={() => {
								setShowCreateForm(true);
								setNewKeyValue(null);
								setNewKeyLabel("");
							}}
							className="px-3 py-2 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white hover:from-violet-500 hover:to-cyan-500 text-sm font-medium transition-colors flex items-center gap-2"
						>
							<Plus className="h-3.5 w-3.5" />
							New API Key
						</button>
					)}
				</div>

				{/* Entity Access Policies */}
				<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden">
					<div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
						<Lock className="h-4 w-4 text-white/40" />
						<h3 className="text-sm font-medium text-white/90">
							Entity Access Policies
						</h3>
					</div>
					{policiesLoading ? (
						<div className="p-8 flex justify-center">
							<Loader2 className="h-5 w-5 animate-spin text-white/40" />
						</div>
					) : policies.length === 0 ? (
						<div className="p-8 text-center">
							<Shield className="h-8 w-8 text-white/20 mx-auto mb-3" />
							<p className="text-sm text-white/40">
								No entities defined yet
							</p>
							<p className="text-xs text-white/40 mt-1">
								Define entities in your app to configure access policies
							</p>
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-white/[0.06] text-left">
										<th className="px-4 py-2.5 font-medium text-white/40">Entity</th>
										<th className="px-4 py-2.5 font-medium text-white/40">Read</th>
										<th className="px-4 py-2.5 font-medium text-white/40">Write</th>
										<th className="px-4 py-2.5 font-medium text-white/40">Delete</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/[0.06]">
									{policies.map((policy) => (
										<tr key={policy.entityName}>
											<td className="px-4 py-2.5 font-mono text-white/90">
												{policy.entityName}
											</td>
											{(["readAccess", "writeAccess", "deleteAccess"] as const).map((field) => (
												<td key={field} className="px-4 py-2.5">
													<select
														value={policy[field]}
														onChange={(e) => updatePolicy(policy.entityName, field, e.target.value)}
														className="px-2 py-1 rounded border border-white/[0.1] bg-white/[0.06] text-white/90 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/30"
													>
														{ACCESS_OPTIONS.map((opt) => (
															<option key={opt.value} value={opt.value}>
																{opt.label}
															</option>
														))}
													</select>
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>

				{/* New Key Created Banner */}
				{newKeyValue && (
					<div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
						<div className="flex items-start gap-3">
							<AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
							<div className="flex-1">
								<h3 className="text-sm font-medium text-white/90">
									Save your API key
								</h3>
								<p className="text-xs text-white/40 mt-1">
									This key will only be shown once. Copy it now and store it
									securely.
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 p-3 rounded-md bg-white/[0.06]">
							<code className="text-sm font-mono text-white/90 flex-1 break-all">
								{newKeyValue}
							</code>
							<button
								type="button"
								onClick={handleCopyKey}
								className="p-1.5 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/90 transition-colors flex-shrink-0"
							>
								{copied ? (
									<Check className="h-4 w-4 text-green-500" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</button>
						</div>
						<button
							type="button"
							onClick={() => {
								setNewKeyValue(null);
								setShowCreateForm(false);
							}}
							className="text-xs text-white/40 hover:text-white/90"
						>
							I&apos;ve saved it, dismiss
						</button>
					</div>
				)}

				{/* Create Form */}
				{showCreateForm && !newKeyValue && (
					<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-3">
						<h3 className="text-sm font-medium text-white/90">
							Create API Key
						</h3>
						<div className="flex gap-2">
							<input
								type="text"
								value={newKeyLabel}
								onChange={(e) => setNewKeyLabel(e.target.value)}
								placeholder="Key label (e.g., Production, Testing)"
								className="flex-1 px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
								onKeyDown={(e) => {
									if (e.key === "Enter") handleCreate();
								}}
							/>
							<button
								type="button"
								onClick={handleCreate}
								disabled={creating || !newKeyLabel.trim()}
								className="px-4 py-2 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white hover:from-violet-500 hover:to-cyan-500 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
							>
								{creating && (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								)}
								Create
							</button>
							<button
								type="button"
								onClick={() => setShowCreateForm(false)}
								className="px-3 py-2 rounded-md border border-white/[0.08] text-sm text-white/40 hover:text-white/90 transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>
				)}

				{/* Keys List */}
				<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden">
					<div className="p-4 border-b border-white/[0.06]">
						<h3 className="text-sm font-medium text-white/90">
							API Keys ({keys.length})
						</h3>
					</div>
					{keys.length === 0 ? (
						<div className="p-8 text-center">
							<Key className="h-8 w-8 text-white/20 mx-auto mb-3" />
							<p className="text-sm text-white/40">
								No API keys yet
							</p>
							<p className="text-xs text-white/40 mt-1">
								Create an API key to access your app's data from external
								services
							</p>
						</div>
					) : (
						<div className="divide-y divide-white/[0.06]">
							{keys.map((key) => (
								<div
									key={key.id}
									className="flex items-center justify-between px-4 py-3"
								>
									<div className="flex items-center gap-3">
										<Key className="h-4 w-4 text-white/40" />
										<div>
											<div className="text-sm text-white/90">
												{key.label || "Unnamed key"}
											</div>
											<div className="text-xs text-white/40 font-mono">
												{key.keyPrefix}...
											</div>
										</div>
									</div>
									<div className="flex items-center gap-3">
										<span className="text-xs text-white/40">
											{key.lastUsedAt
												? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
												: "Never used"}
										</span>
										<button
											type="button"
											onClick={() => handleRevoke(key.id)}
											className="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-500 transition-colors"
											title="Revoke key"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Security Info */}
				<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
					<div className="flex items-start gap-3">
						<Shield className="h-5 w-5 text-white/40 flex-shrink-0 mt-0.5" />
						<div>
							<h3 className="text-sm font-medium text-white/90">
								Security Notes
							</h3>
							<ul className="text-xs text-white/40 mt-2 space-y-1 list-disc list-inside">
								<li>API keys are hashed and stored securely</li>
								<li>Keys are shown only once at creation time</li>
								<li>Revoked keys are immediately invalidated</li>
								<li>All API requests are rate-limited</li>
								<li>
									Use separate keys for development and production
								</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
