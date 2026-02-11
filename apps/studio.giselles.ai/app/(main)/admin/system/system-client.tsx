"use client";

import { PageHeading } from "@giselle-internal/ui/page-heading";
import {
	Database,
	Server,
	KeyRound,
	Flag,
	BrainCircuit,
	Table,
} from "lucide-react";

type Props = {
	envStatus: { name: string; isSet: boolean }[];
	flagStatus: { name: string; value: string }[];
	dbHealthy: boolean;
	tableSizes: { name: string; rows: number }[];
	providers: {
		provider: string;
		isActive: boolean;
		errorReason: string | null;
	}[];
	runtime: {
		nodeVersion: string;
		uptimeSeconds: number;
		heapUsedMB: number;
		heapTotalMB: number;
		rssMB: number;
	};
};

function StatusDot({ ok }: { ok: boolean }) {
	return (
		<span
			className={`inline-block size-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
		/>
	);
}

function Section({
	title,
	icon,
	children,
}: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
	return (
		<div className="rounded-[8px] border border-black-400 bg-black-850 p-5">
			<div className="flex items-center gap-2 text-black-400 text-[13px] font-medium mb-4">
				{icon}
				{title}
			</div>
			{children}
		</div>
	);
}

function formatUptime(seconds: number) {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (d > 0) return `${d}d ${h}h ${m}m`;
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

export function SystemClient({
	envStatus,
	flagStatus,
	dbHealthy,
	tableSizes,
	providers,
	runtime,
}: Props) {
	return (
		<div className="flex flex-col gap-8">
			<PageHeading>System</PageHeading>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Section
					title="Database"
					icon={<Database className="size-4" />}
				>
					<div className="flex items-center gap-2 text-[13px] text-white-900 mb-3">
						<StatusDot ok={dbHealthy} />
						{dbHealthy ? "Connected" : "Unreachable"}
					</div>
					{tableSizes.length > 0 && (
						<div className="max-h-[240px] overflow-y-auto">
							<table className="w-full text-[12px]">
								<thead>
									<tr className="text-black-400">
										<th className="text-left pb-1">Table</th>
										<th className="text-right pb-1">Rows</th>
									</tr>
								</thead>
								<tbody>
									{tableSizes.map((t) => (
										<tr
											key={t.name}
											className="border-t border-black-400/30"
										>
											<td className="py-1 text-white-900 font-mono">
												{t.name}
											</td>
											<td className="py-1 text-right text-black-400">
												{t.rows.toLocaleString()}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</Section>

				<Section
					title="Runtime"
					icon={<Server className="size-4" />}
				>
					<div className="flex flex-col gap-2 text-[13px]">
						<Row label="Node" value={runtime.nodeVersion} />
						<Row
							label="Uptime"
							value={formatUptime(runtime.uptimeSeconds)}
						/>
						<Row
							label="Heap"
							value={`${runtime.heapUsedMB} / ${runtime.heapTotalMB} MB`}
						/>
						<Row label="RSS" value={`${runtime.rssMB} MB`} />
					</div>
				</Section>

				<Section
					title="Environment Variables"
					icon={<KeyRound className="size-4" />}
				>
					<div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
						{envStatus.map((v) => (
							<div
								key={v.name}
								className="flex items-center gap-2 text-[12px] font-mono"
							>
								<StatusDot ok={v.isSet} />
								<span className={v.isSet ? "text-white-900" : "text-black-400"}>
									{v.name}
								</span>
							</div>
						))}
					</div>
				</Section>

				<Section
					title="Feature Flags"
					icon={<Flag className="size-4" />}
				>
					<div className="flex flex-col gap-2">
						{flagStatus.map((f) => (
							<div
								key={f.name}
								className="flex items-center justify-between text-[12px] font-mono"
							>
								<span className="text-white-900">{f.name}</span>
								<span
									className={`px-2 py-0.5 rounded text-[11px] ${
										f.value === "true"
											? "bg-green-500/20 text-green-400"
											: f.value === "false"
												? "bg-red-500/20 text-red-400"
												: "bg-black-400/20 text-black-400"
									}`}
								>
									{f.value}
								</span>
							</div>
						))}
					</div>
				</Section>

				<Section
					title="AI Providers"
					icon={<BrainCircuit className="size-4" />}
				>
					<div className="flex flex-col gap-2">
						{providers.map((p) => (
							<div
								key={p.provider}
								className="flex items-center gap-2 text-[13px]"
							>
								<StatusDot ok={p.isActive} />
								<span className="text-white-900 capitalize">
									{p.provider}
								</span>
								{p.errorReason && (
									<span className="text-[11px] text-red-400 ml-auto">
										{p.errorReason}
									</span>
								)}
							</div>
						))}
					</div>
				</Section>
			</div>
		</div>
	);
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-black-400">{label}</span>
			<span className="text-white-900 font-mono">{value}</span>
		</div>
	);
}
