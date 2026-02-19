"use client";

/**
 * AnalyticsPanel Component
 *
 * Usage metrics and analytics dashboard.
 * Shows real project statistics computed from files and schema.
 * Fetches entity row counts from the data API for real usage metrics.
 */

import {
	BarChart3,
	Code2,
	Database,
	FileCode2,
	Folder,
	HardDrive,
	Layers,
	Loader2,
	Server,
	TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";

interface AnalyticsPanelProps {
	appId: string;
	files: AppFile[];
}

interface EntityStat {
	name: string;
	tableName: string;
	rowCount: number;
	fieldCount: number;
}

function MetricCard({
	icon: Icon,
	label,
	value,
	sublabel,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string | number;
	sublabel?: string;
}) {
	return (
		<div className="p-4 rounded-lg border border-border bg-card">
			<div className="flex items-center justify-between mb-3">
				<Icon className="h-4 w-4 text-muted-foreground" />
			</div>
			<div className="text-2xl font-bold text-foreground">{value}</div>
			<div className="text-xs text-muted-foreground mt-1">{label}</div>
			{sublabel && (
				<div className="text-[10px] text-muted-foreground/70 mt-0.5">
					{sublabel}
				</div>
			)}
		</div>
	);
}

function BarChart({
	data,
	labelKey,
	valueKey,
	color,
}: {
	data: Array<{ label: string; value: number }>;
	labelKey?: string;
	valueKey?: string;
	color?: string;
}) {
	const maxValue = Math.max(...data.map((d) => d.value), 1);

	return (
		<div className="flex items-end gap-2 h-32">
			{data.map((item) => (
				<div
					key={item.label}
					className="flex-1 flex flex-col items-center gap-1"
				>
					<div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
						<div
							className={`w-full max-w-[32px] rounded-t ${color || "bg-blue-500/30"}`}
							style={{
								height: `${Math.max(2, (item.value / maxValue) * 100)}%`,
							}}
						/>
					</div>
					<span className="text-[9px] text-muted-foreground truncate w-full text-center">
						{item.label}
					</span>
					<span className="text-[10px] font-medium text-foreground">
						{item.value}
					</span>
				</div>
			))}
		</div>
	);
}

export function AnalyticsPanel({ appId, files }: AnalyticsPanelProps) {
	const [entityStats, setEntityStats] = useState<EntityStat[]>([]);
	const [loadingEntities, setLoadingEntities] = useState(true);
	const [schema, setSchema] = useState<{
		entities: Array<{
			name: string;
			tableName: string;
			fields: Array<{ name: string; type: string }>;
		}>;
	} | null>(null);

	// Fetch schema + entity row counts
	useEffect(() => {
		async function fetchStats() {
			try {
				// Fetch schema
				const schemaRes = await fetch(`/api/apps/${appId}/schema`);
				if (!schemaRes.ok) {
					setLoadingEntities(false);
					return;
				}
				const schemaData = await schemaRes.json();
				const s = schemaData.schema;
				setSchema(s);

				if (!s?.entities?.length) {
					setLoadingEntities(false);
					return;
				}

				// Fetch row count for each entity
				const stats: EntityStat[] = await Promise.all(
					s.entities.map(
						async (entity: {
							name: string;
							tableName: string;
							fields: Array<{ name: string }>;
						}) => {
							try {
								const res = await fetch(
									`/api/apps/${appId}/data/${entity.tableName}?page=1&limit=1`,
								);
								if (res.ok) {
									const data = await res.json();
									return {
										name: entity.name,
										tableName: entity.tableName,
										rowCount: data.pagination?.total || 0,
										fieldCount: entity.fields.length,
									};
								}
							} catch {
								// Skip
							}
							return {
								name: entity.name,
								tableName: entity.tableName,
								rowCount: 0,
								fieldCount: entity.fields.length,
							};
						},
					),
				);
				setEntityStats(stats);
			} catch {
				// Schema not available
			}
			setLoadingEntities(false);
		}
		fetchStats();
	}, [appId]);

	// Compute file statistics
	const fileStats = useMemo(() => {
		const sourceFiles = files.filter((f) => f.path !== "Blueprint.md");
		const totalLines = sourceFiles.reduce(
			(sum, f) => sum + (f.content?.split("\n").length || 0),
			0,
		);
		const totalSize = sourceFiles.reduce(
			(sum, f) => sum + (f.content?.length || 0),
			0,
		);

		// File type breakdown
		const typeMap = new Map<string, number>();
		for (const f of sourceFiles) {
			const ext = f.path.split(".").pop()?.toLowerCase() || "other";
			typeMap.set(ext, (typeMap.get(ext) || 0) + 1);
		}
		const fileTypes = Array.from(typeMap.entries())
			.map(([label, value]) => ({ label: `.${label}`, value }))
			.sort((a, b) => b.value - a.value);

		// Size breakdown by file type
		const sizeMap = new Map<string, number>();
		for (const f of sourceFiles) {
			const ext = f.path.split(".").pop()?.toLowerCase() || "other";
			sizeMap.set(ext, (sizeMap.get(ext) || 0) + (f.content?.length || 0));
		}
		const sizeByType = Array.from(sizeMap.entries())
			.map(([label, value]) => ({
				label: `.${label}`,
				value: Math.round(value / 1024),
			}))
			.sort((a, b) => b.value - a.value);

		// Largest files
		const largestFiles = [...sourceFiles]
			.sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0))
			.slice(0, 5)
			.map((f) => ({
				path: f.path,
				size: Math.round((f.content?.length || 0) / 1024),
				lines: f.content?.split("\n").length || 0,
			}));

		// Component count (rough heuristic)
		const componentCount = sourceFiles.filter(
			(f) =>
				f.path.endsWith(".tsx") &&
				f.content?.includes("export") &&
				(f.content?.includes("function") || f.content?.includes("const")),
		).length;

		return {
			fileCount: sourceFiles.length,
			totalLines,
			totalSizeKB: Math.round(totalSize / 1024),
			avgFileSize: sourceFiles.length
				? Math.round(totalSize / sourceFiles.length / 1024)
				: 0,
			fileTypes,
			sizeByType,
			largestFiles,
			componentCount,
		};
	}, [files]);

	// Database stats
	const dbStats = useMemo(() => {
		const totalRows = entityStats.reduce((sum, e) => sum + e.rowCount, 0);
		const totalFields = entityStats.reduce((sum, e) => sum + e.fieldCount, 0);
		const apiEndpoints = entityStats.length * 5; // 5 CRUD endpoints per entity
		return { totalRows, totalFields, apiEndpoints, entityCount: entityStats.length };
	}, [entityStats]);

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-5xl mx-auto space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-foreground">Analytics</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Project metrics and usage statistics
					</p>
				</div>

				{/* Top-level metric cards */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<MetricCard
						icon={FileCode2}
						label="Source Files"
						value={fileStats.fileCount}
						sublabel={`${fileStats.componentCount} components`}
					/>
					<MetricCard
						icon={Code2}
						label="Lines of Code"
						value={fileStats.totalLines.toLocaleString()}
					/>
					<MetricCard
						icon={Database}
						label="Data Entities"
						value={dbStats.entityCount}
						sublabel={`${dbStats.apiEndpoints} API endpoints`}
					/>
					<MetricCard
						icon={Layers}
						label="Total Records"
						value={
							loadingEntities ? "..." : dbStats.totalRows.toLocaleString()
						}
						sublabel={`${dbStats.totalFields} fields`}
					/>
				</div>

				{/* File Type Distribution + Entity Records */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{/* File type chart */}
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="text-sm font-medium text-foreground mb-4">
							Files by Type
						</h3>
						{fileStats.fileTypes.length > 0 ? (
							<BarChart
								data={fileStats.fileTypes.slice(0, 8)}
								color="bg-blue-500/30"
							/>
						) : (
							<p className="text-xs text-muted-foreground text-center py-8">
								No source files
							</p>
						)}
					</div>

					{/* Entity row counts */}
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="text-sm font-medium text-foreground mb-4">
							Records per Entity
						</h3>
						{loadingEntities ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
							</div>
						) : entityStats.length > 0 ? (
							<BarChart
								data={entityStats.map((e) => ({
									label: e.name,
									value: e.rowCount,
								}))}
								color="bg-green-500/30"
							/>
						) : (
							<div className="text-center py-8">
								<Database className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
								<p className="text-xs text-muted-foreground">
									No data entities defined yet
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Size breakdown */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{/* Size by file type */}
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="text-sm font-medium text-foreground mb-4">
							Size by Type (KB)
						</h3>
						{fileStats.sizeByType.length > 0 ? (
							<BarChart
								data={fileStats.sizeByType.slice(0, 8)}
								color="bg-purple-500/30"
							/>
						) : (
							<p className="text-xs text-muted-foreground text-center py-8">
								No files
							</p>
						)}
					</div>

					{/* Largest files table */}
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="text-sm font-medium text-foreground mb-3">
							Largest Files
						</h3>
						{fileStats.largestFiles.length > 0 ? (
							<div className="space-y-2">
								{fileStats.largestFiles.map((f) => (
									<div
										key={f.path}
										className="flex items-center justify-between text-xs"
									>
										<span className="text-foreground font-mono truncate flex-1 mr-2">
											{f.path}
										</span>
										<span className="text-muted-foreground flex-shrink-0">
											{f.size} KB
										</span>
										<span className="text-muted-foreground flex-shrink-0 w-16 text-right">
											{f.lines} lines
										</span>
									</div>
								))}
							</div>
						) : (
							<p className="text-xs text-muted-foreground text-center py-4">
								No files
							</p>
						)}
					</div>
				</div>

				{/* Entity Details Table */}
				{entityStats.length > 0 && (
					<div className="rounded-lg border border-border bg-card overflow-hidden">
						<div className="p-4 border-b border-border">
							<h3 className="text-sm font-medium text-foreground">
								Entity Details
							</h3>
						</div>
						<table className="w-full text-sm">
							<thead>
								<tr className="bg-muted/30">
									<th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
										Entity
									</th>
									<th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
										Table
									</th>
									<th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
										Fields
									</th>
									<th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
										Records
									</th>
									<th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
										API Endpoints
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{entityStats.map((entity) => (
									<tr
										key={entity.tableName}
										className="hover:bg-muted/20"
									>
										<td className="px-4 py-2.5 text-foreground font-medium">
											{entity.name}
										</td>
										<td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
											{entity.tableName}
										</td>
										<td className="px-4 py-2.5 text-right text-foreground">
											{entity.fieldCount}
										</td>
										<td className="px-4 py-2.5 text-right text-foreground">
											{entity.rowCount.toLocaleString()}
										</td>
										<td className="px-4 py-2.5 text-right text-muted-foreground">
											5
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Summary card */}
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-center gap-3">
						<HardDrive className="h-5 w-5 text-muted-foreground flex-shrink-0" />
						<div>
							<h3 className="text-sm font-medium text-foreground">
								Project Summary
							</h3>
							<p className="text-xs text-muted-foreground mt-1">
								{fileStats.fileCount} files, {fileStats.totalSizeKB} KB
								total,{" "}
								{fileStats.totalLines.toLocaleString()} lines of code
								{dbStats.entityCount > 0 &&
									` | ${dbStats.entityCount} entities, ${dbStats.totalRows.toLocaleString()} records, ${dbStats.apiEndpoints} REST endpoints`}
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
