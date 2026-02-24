"use client";

/**
 * EnvironmentsPanel Component
 *
 * Multi-environment management: Dev/Staging/Production cards with promote flow,
 * schema diff preview, and deploy per environment.
 */

import { useCallback, useEffect, useState } from "react";
import {
	ArrowRight,
	Check,
	Globe,
	Loader2,
	Plus,
	RefreshCw,
	Rocket,
	Trash2,
} from "lucide-react";

interface Environment {
	environment: string;
	databaseName: string;
	status: string;
	schemaVersion: number;
	promotedAt: string | null;
	promotedFrom: string | null;
	deploymentSubdomain: string | null;
	createdAt: string;
}

interface SchemaDiff {
	from: string;
	to: string;
	hasChanges: boolean;
	newTables: Array<{ name: string; tableName: string }>;
	newColumns: Array<{ table: string; field: { name: string; type: string } }>;
	removedTables: string[];
	removedColumns: Array<{ table: string; field: string }>;
}

interface EnvironmentsPanelProps {
	appId: string;
}

export function EnvironmentsPanel({ appId }: EnvironmentsPanelProps) {
	const [environments, setEnvironments] = useState<Environment[]>([]);
	const [loading, setLoading] = useState(true);
	const [promoting, setPromoting] = useState<string | null>(null);
	const [creating, setCreating] = useState<string | null>(null);
	const [diff, setDiff] = useState<SchemaDiff | null>(null);
	const [showDiffModal, setShowDiffModal] = useState<{ from: string; to: string } | null>(null);

	const fetchEnvironments = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/environments`);
			if (res.ok) {
				const data = await res.json();
				setEnvironments(data.environments);
			}
		} catch {}
		setLoading(false);
	}, [appId]);

	useEffect(() => {
		fetchEnvironments();
	}, [fetchEnvironments]);

	const createEnvironment = async (env: "staging" | "production") => {
		setCreating(env);
		try {
			const res = await fetch(`/api/apps/${appId}/environments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ environment: env }),
			});
			if (res.ok) {
				await fetchEnvironments();
			}
		} catch {}
		setCreating(null);
	};

	const fetchDiff = async (from: string, to: string) => {
		setShowDiffModal({ from, to });
		setDiff(null);
		try {
			const res = await fetch(
				`/api/apps/${appId}/environments/diff?from=${from}&to=${to}`,
			);
			if (res.ok) {
				setDiff(await res.json());
			}
		} catch {}
	};

	const promote = async (from: string, to: string) => {
		setPromoting(`${from}-${to}`);
		try {
			const res = await fetch(`/api/apps/${appId}/environments/promote`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ from, to }),
			});
			if (res.ok) {
				setShowDiffModal(null);
				setDiff(null);
				await fetchEnvironments();
			}
		} catch {}
		setPromoting(null);
	};

	const deleteEnv = async (env: string) => {
		if (!confirm(`Delete ${env} environment? This will drop the database permanently.`)) return;
		try {
			await fetch(`/api/apps/${appId}/environments/${env}`, { method: "DELETE" });
			await fetchEnvironments();
		} catch {}
	};

	const getEnv = (name: string) =>
		environments.find((e) => e.environment === name);

	const statusColor = (status: string) => {
		if (status === "active") return "bg-emerald-500/20 text-emerald-400";
		if (status === "provisioning") return "bg-yellow-500/20 text-yellow-400";
		if (status === "error") return "bg-red-500/20 text-red-400";
		return "bg-white/10 text-white/40";
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Loader2 className="h-6 w-6 animate-spin text-white/30" />
			</div>
		);
	}

	const devEnv = getEnv("development");
	const stagingEnv = getEnv("staging");
	const prodEnv = getEnv("production");

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-white/90">Environments</h2>
					<p className="text-sm text-white/40 mt-1">
						Manage dev, staging, and production databases independently
					</p>
				</div>
				<button
					type="button"
					onClick={fetchEnvironments}
					className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition"
				>
					<RefreshCw className="h-4 w-4" />
				</button>
			</div>

			{/* Environment Cards */}
			<div className="grid grid-cols-3 gap-4">
				{/* Development */}
				<EnvironmentCard
					name="Development"
					env={devEnv}
					color="blue"
					isDefault
				/>

				{/* Promote Arrow: Dev → Staging */}
				{stagingEnv && (
					<div className="col-span-3 flex items-center justify-center gap-3 -my-2">
						<button
							type="button"
							onClick={() => fetchDiff("development", "staging")}
							className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition text-sm"
						>
							<span>Dev</span>
							<ArrowRight className="h-4 w-4" />
							<span>Staging</span>
						</button>
						{prodEnv && (
							<button
								type="button"
								onClick={() => fetchDiff("staging", "production")}
								className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition text-sm"
							>
								<span>Staging</span>
								<ArrowRight className="h-4 w-4" />
								<span>Prod</span>
							</button>
						)}
					</div>
				)}

				{/* Staging */}
				{stagingEnv ? (
					<EnvironmentCard
						name="Staging"
						env={stagingEnv}
						color="violet"
						onDelete={() => deleteEnv("staging")}
					/>
				) : (
					<CreateEnvCard
						name="Staging"
						creating={creating === "staging"}
						onCreate={() => createEnvironment("staging")}
					/>
				)}

				{/* Production */}
				{prodEnv ? (
					<EnvironmentCard
						name="Production"
						env={prodEnv}
						color="amber"
						onDelete={() => deleteEnv("production")}
					/>
				) : (
					<CreateEnvCard
						name="Production"
						creating={creating === "production"}
						onCreate={() => createEnvironment("production")}
					/>
				)}
			</div>

			{/* Diff Modal */}
			{showDiffModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="bg-[#1a1a2e] border border-white/[0.08] rounded-xl p-6 w-[500px] max-h-[80vh] overflow-y-auto">
						<h3 className="text-base font-semibold text-white/90 mb-4">
							Schema Diff: {showDiffModal.from} → {showDiffModal.to}
						</h3>

						{!diff ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-5 w-5 animate-spin text-white/30" />
							</div>
						) : !diff.hasChanges ? (
							<div className="flex items-center gap-2 py-4 text-emerald-400">
								<Check className="h-5 w-5" />
								<span>Schemas are identical — nothing to promote</span>
							</div>
						) : (
							<div className="space-y-3">
								{diff.newTables.length > 0 && (
									<div>
										<h4 className="text-xs font-medium text-emerald-400 uppercase mb-1">
											New Tables ({diff.newTables.length})
										</h4>
										{diff.newTables.map((t) => (
											<div
												key={t.tableName}
												className="px-3 py-1.5 bg-emerald-500/10 rounded text-sm text-white/70"
											>
												+ {t.name} ({t.tableName})
											</div>
										))}
									</div>
								)}
								{diff.newColumns.length > 0 && (
									<div>
										<h4 className="text-xs font-medium text-blue-400 uppercase mb-1">
											New Columns ({diff.newColumns.length})
										</h4>
										{diff.newColumns.map((c, i) => (
											<div
												key={`${c.table}-${c.field.name}-${i}`}
												className="px-3 py-1.5 bg-blue-500/10 rounded text-sm text-white/70"
											>
												+ {c.table}.{c.field.name} ({c.field.type})
											</div>
										))}
									</div>
								)}
								{diff.removedTables.length > 0 && (
									<div>
										<h4 className="text-xs font-medium text-red-400 uppercase mb-1">
											Tables in target only ({diff.removedTables.length})
										</h4>
										{diff.removedTables.map((t) => (
											<div
												key={t}
												className="px-3 py-1.5 bg-red-500/10 rounded text-sm text-white/70"
											>
												{t}
											</div>
										))}
									</div>
								)}
								{diff.removedColumns.length > 0 && (
									<div>
										<h4 className="text-xs font-medium text-orange-400 uppercase mb-1">
											Columns in target only ({diff.removedColumns.length})
										</h4>
										{diff.removedColumns.map((c, i) => (
											<div
												key={`${c.table}-${c.field}-${i}`}
												className="px-3 py-1.5 bg-orange-500/10 rounded text-sm text-white/70"
											>
												{c.table}.{c.field}
											</div>
										))}
									</div>
								)}
							</div>
						)}

						<div className="flex justify-end gap-3 mt-6">
							<button
								type="button"
								onClick={() => {
									setShowDiffModal(null);
									setDiff(null);
								}}
								className="px-4 py-2 rounded-lg border border-white/[0.08] text-white/60 hover:bg-white/[0.06] transition text-sm"
							>
								Cancel
							</button>
							{diff?.hasChanges && (
								<button
									type="button"
									onClick={() =>
										promote(showDiffModal.from, showDiffModal.to)
									}
									disabled={!!promoting}
									className="px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 transition text-sm disabled:opacity-50 flex items-center gap-2"
								>
									{promoting ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Rocket className="h-4 w-4" />
									)}
									Promote
								</button>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function EnvironmentCard({
	name,
	env,
	color,
	isDefault,
	onDelete,
}: {
	name: string;
	env?: Environment;
	color: string;
	isDefault?: boolean;
	onDelete?: () => void;
}) {
	const colorMap: Record<string, string> = {
		blue: "border-blue-500/20 bg-blue-500/5",
		violet: "border-violet-500/20 bg-violet-500/5",
		amber: "border-amber-500/20 bg-amber-500/5",
	};
	const statusColor = (s: string) => {
		if (s === "active") return "text-emerald-400 bg-emerald-500/20";
		if (s === "provisioning") return "text-yellow-400 bg-yellow-500/20";
		return "text-red-400 bg-red-500/20";
	};

	return (
		<div className={`rounded-xl border p-4 space-y-3 ${colorMap[color] ?? colorMap.blue}`}>
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-white/90">{name}</h3>
				<div className="flex items-center gap-2">
					{env?.status && (
						<span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(env.status)}`}>
							{env.status}
						</span>
					)}
					{!isDefault && onDelete && (
						<button
							type="button"
							onClick={onDelete}
							className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</button>
					)}
				</div>
			</div>
			{env && (
				<div className="space-y-1 text-xs text-white/40">
					<div>DB: <span className="text-white/60 font-mono">{env.databaseName}</span></div>
					{env.schemaVersion > 0 && (
						<div>Schema v{env.schemaVersion}</div>
					)}
					{env.promotedAt && (
						<div>
							Promoted from {env.promotedFrom}:{" "}
							{new Date(env.promotedAt).toLocaleDateString()}
						</div>
					)}
					{env.deploymentSubdomain && (
						<div className="flex items-center gap-1">
							<Globe className="h-3 w-3" />
							<span className="text-white/60">{env.deploymentSubdomain}</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function CreateEnvCard({
	name,
	creating,
	onCreate,
}: {
	name: string;
	creating: boolean;
	onCreate: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onCreate}
			disabled={creating}
			className="rounded-xl border border-dashed border-white/[0.08] p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/[0.04] hover:border-white/[0.12] transition min-h-[120px] disabled:opacity-50"
		>
			{creating ? (
				<Loader2 className="h-5 w-5 animate-spin text-white/30" />
			) : (
				<Plus className="h-5 w-5 text-white/30" />
			)}
			<span className="text-sm text-white/40">
				{creating ? `Creating ${name}...` : `Create ${name}`}
			</span>
		</button>
	);
}
