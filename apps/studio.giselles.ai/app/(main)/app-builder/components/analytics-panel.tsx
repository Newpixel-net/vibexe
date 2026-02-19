"use client";

/**
 * AnalyticsPanel Component
 *
 * Usage metrics and analytics dashboard.
 * Shows file statistics from current data, with placeholders for traffic analytics.
 */

import { BarChart3, Eye, MousePointerClick, TrendingUp, Users } from "lucide-react";
import { useMemo } from "react";
import type { AppFile } from "../adapters/file-adapter";

interface AnalyticsPanelProps {
	appId: string;
	files: AppFile[];
}

function MetricCard({
	icon: Icon,
	label,
	value,
	change,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string | number;
	change?: string;
}) {
	return (
		<div className="p-4 rounded-lg border border-border bg-card">
			<div className="flex items-center justify-between mb-3">
				<Icon className="h-4 w-4 text-muted-foreground" />
				{change && (
					<span className="text-xs text-green-500 font-medium">{change}</span>
				)}
			</div>
			<div className="text-2xl font-bold text-foreground">{value}</div>
			<div className="text-xs text-muted-foreground mt-1">{label}</div>
		</div>
	);
}

function PlaceholderChart({ label }: { label: string }) {
	// Simple bar chart placeholder with random-ish heights
	const bars = [40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95];

	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<h3 className="text-sm font-medium text-foreground mb-4">{label}</h3>
			<div className="flex items-end gap-1.5 h-32">
				{bars.map((height, i) => (
					<div
						key={`bar-${label}-${i}`}
						className="flex-1 rounded-t bg-muted-foreground/15"
						style={{ height: `${height}%` }}
					/>
				))}
			</div>
			<div className="flex justify-between mt-2 text-xs text-muted-foreground">
				<span>Jan</span>
				<span>Jun</span>
				<span>Dec</span>
			</div>
			<div className="mt-3 text-center">
				<p className="text-xs text-muted-foreground">
					Analytics data will appear once your app is deployed
				</p>
			</div>
		</div>
	);
}

export function AnalyticsPanel({ appId, files }: AnalyticsPanelProps) {
	const stats = useMemo(() => {
		const sourceFiles = files.filter((f) => f.path !== "Blueprint.md");
		const totalLines = sourceFiles.reduce(
			(sum, f) => sum + (f.content?.split("\n").length || 0),
			0,
		);
		const totalSize = sourceFiles.reduce(
			(sum, f) => sum + (f.content?.length || 0),
			0,
		);

		return {
			fileCount: sourceFiles.length,
			totalLines,
			totalSizeKB: Math.round(totalSize / 1024),
			avgFileSize: sourceFiles.length
				? Math.round(totalSize / sourceFiles.length / 1024)
				: 0,
		};
	}, [files]);

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-4xl mx-auto space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-foreground">Analytics</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Track usage metrics and performance
					</p>
				</div>

				{/* Project Stats (real data) */}
				<div>
					<h2 className="text-sm font-medium text-muted-foreground mb-3">
						Project Statistics
					</h2>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<MetricCard
							icon={BarChart3}
							label="Source Files"
							value={stats.fileCount}
						/>
						<MetricCard
							icon={TrendingUp}
							label="Lines of Code"
							value={stats.totalLines.toLocaleString()}
						/>
						<MetricCard
							icon={Eye}
							label="Total Size"
							value={`${stats.totalSizeKB} KB`}
						/>
						<MetricCard
							icon={MousePointerClick}
							label="Avg File Size"
							value={`${stats.avgFileSize} KB`}
						/>
					</div>
				</div>

				{/* Traffic Charts (placeholder) */}
				<div>
					<h2 className="text-sm font-medium text-muted-foreground mb-3">
						Traffic &amp; Usage
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<PlaceholderChart label="Page Views" />
						<PlaceholderChart label="Unique Visitors" />
					</div>
				</div>

				{/* API Usage (placeholder) */}
				<div>
					<h2 className="text-sm font-medium text-muted-foreground mb-3">
						API Usage
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<PlaceholderChart label="API Requests" />
						<PlaceholderChart label="Response Times" />
					</div>
				</div>
			</div>
		</div>
	);
}
