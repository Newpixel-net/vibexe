"use client";

import {
	ChevronDown,
	ChevronRight,
	Copy,
	Database,
	FileImage,
	Folder,
	HardDrive,
	Image,
	Layers,
	Monitor,
	Music,
	Package,
	Swords,
	Users,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CatalogPack {
	name: string;
	path: string;
	files: number;
	formats: string[];
}

interface CatalogCategory {
	packs: CatalogPack[];
}

interface Catalog {
	version: string;
	basePath: string;
	totalFiles: number;
	totalSize: string;
	categories: Record<string, CatalogCategory>;
}

type Tab = "overview" | "characters" | "environments" | "items" | "ui" | "audio";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
	characters: <Users className="h-4 w-4" />,
	environments: <Layers className="h-4 w-4" />,
	items: <Swords className="h-4 w-4" />,
	ui: <Monitor className="h-4 w-4" />,
	audio: <Music className="h-4 w-4" />,
	effects: <FileImage className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
	characters: "text-blue-400",
	environments: "text-green-400",
	items: "text-amber-400",
	ui: "text-purple-400",
	audio: "text-pink-400",
	effects: "text-cyan-400",
};

function StatCard({
	icon,
	label,
	value,
	subtitle,
}: {
	icon: React.ReactNode;
	label: string;
	value: string | number;
	subtitle?: string;
}) {
	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<div className="flex items-center gap-2 text-muted-foreground mb-1">
				{icon}
				<span className="text-xs uppercase tracking-wider">{label}</span>
			</div>
			<div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
			{subtitle && (
				<div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
			)}
		</div>
	);
}

function PackCard({ pack, category }: { pack: CatalogPack; category: string }) {
	const [expanded, setExpanded] = useState(false);
	const [copied, setCopied] = useState(false);
	const assetPath = pack.path;

	function copyPath() {
		navigator.clipboard.writeText(assetPath);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	// Generate sample thumbnail URLs
	const sampleExtensions = pack.formats.filter((f) =>
		["png", "jpg", "jpeg", "svg"].includes(f.toLowerCase()),
	);
	const hasThumbnails = sampleExtensions.length > 0;

	return (
		<div className="rounded-lg border border-border bg-card overflow-hidden">
			<button
				type="button"
				className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
				onClick={() => setExpanded(!expanded)}
			>
				{expanded ? (
					<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
				) : (
					<ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
				)}
				<Folder className={cn("h-4 w-4 shrink-0", CATEGORY_COLORS[category] || "text-muted-foreground")} />
				<div className="flex-1 min-w-0">
					<div className="font-medium text-sm truncate">{pack.name}</div>
					<div className="text-xs text-muted-foreground truncate">
						{assetPath}
					</div>
				</div>
				<div className="text-xs text-muted-foreground shrink-0">
					{pack.files} files
				</div>
				<div className="flex gap-1 shrink-0">
					{pack.formats.slice(0, 4).map((fmt) => (
						<span
							key={fmt}
							className="px-1.5 py-0.5 text-[10px] rounded bg-accent text-accent-foreground uppercase"
						>
							{fmt}
						</span>
					))}
				</div>
			</button>

			{expanded && (
				<div className="border-t border-border p-3 bg-accent/20">
					<div className="flex items-center gap-2 mb-3">
						<code className="flex-1 text-xs bg-background rounded px-2 py-1 font-mono truncate">
							{assetPath}
						</code>
						<button
							type="button"
							onClick={copyPath}
							className="shrink-0 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
						>
							<Copy className="h-3 w-3" />
							{copied ? "Copied!" : "Copy Path"}
						</button>
					</div>

					{hasThumbnails && (
						<div className="flex gap-2 flex-wrap">
							{[0, 1, 2, 3].map((i) => (
								<div
									key={i}
									className="w-16 h-16 rounded border border-border bg-background flex items-center justify-center overflow-hidden"
								>
									<Image className="h-6 w-6 text-muted-foreground/30" />
								</div>
							))}
							<div className="text-xs text-muted-foreground self-center ml-1">
								{pack.files} files ({pack.formats.join(", ")})
							</div>
						</div>
					)}

					<div className="mt-2 text-xs text-muted-foreground">
						<strong>Formats:</strong> {pack.formats.join(", ")} &middot;{" "}
						<strong>API path:</strong>{" "}
						<code className="text-[10px]">/api/app-builder/media-stock/{assetPath}...</code>
					</div>
				</div>
			)}
		</div>
	);
}

function CategoryTab({
	category,
	packs,
}: {
	category: string;
	packs: CatalogPack[];
}) {
	const totalFiles = packs.reduce((sum, p) => sum + p.files, 0);
	const allFormats = [...new Set(packs.flatMap((p) => p.formats))];

	return (
		<div>
			<div className="flex items-center gap-3 mb-4">
				<span className={cn("text-lg", CATEGORY_COLORS[category])}>
					{CATEGORY_ICONS[category]}
				</span>
				<div>
					<h2 className="text-lg font-semibold capitalize">{category}</h2>
					<p className="text-xs text-muted-foreground">
						{packs.length} packs &middot; {totalFiles.toLocaleString()} files
						&middot; Formats: {allFormats.join(", ")}
					</p>
				</div>
			</div>

			<div className="space-y-2">
				{packs.map((pack) => (
					<PackCard key={pack.path} pack={pack} category={category} />
				))}
			</div>
		</div>
	);
}

export function MediaStockClient({ catalog }: { catalog: Catalog | null }) {
	const [activeTab, setActiveTab] = useState<Tab>("overview");

	if (!catalog) {
		return (
			<div className="p-6">
				<h1 className="text-2xl font-bold mb-4">Media Stock</h1>
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<Database className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
					<p className="text-muted-foreground">
						Media stock catalog not found. This is expected in development
						environments.
					</p>
					<p className="text-xs text-muted-foreground mt-2">
						Catalog should be at:{" "}
						<code>/opt/vibexe/media-stock/games/catalog.json</code>
					</p>
				</div>
			</div>
		);
	}

	const categories = Object.keys(catalog.categories).filter(
		(c) => catalog.categories[c].packs.length > 0,
	);
	const totalPacks = categories.reduce(
		(sum, c) => sum + catalog.categories[c].packs.length,
		0,
	);
	const allFormats = [
		...new Set(
			categories.flatMap((c) =>
				catalog.categories[c].packs.flatMap((p) => p.formats),
			),
		),
	];

	const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
		{
			id: "overview",
			label: "Overview",
			icon: <Database className="h-4 w-4" />,
		},
		{
			id: "characters",
			label: "Characters",
			icon: <Users className="h-4 w-4" />,
		},
		{
			id: "environments",
			label: "Environments",
			icon: <Layers className="h-4 w-4" />,
		},
		{
			id: "items",
			label: "Items",
			icon: <Swords className="h-4 w-4" />,
		},
		{ id: "ui", label: "UI", icon: <Monitor className="h-4 w-4" /> },
		{
			id: "audio",
			label: "Audio",
			icon: <Music className="h-4 w-4" />,
		},
	];

	return (
		<div className="p-6">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Media Stock</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Game asset database &middot; {catalog.totalFiles.toLocaleString()} files
					&middot; {catalog.totalSize} &middot; v{catalog.version}
				</p>
			</div>

			{/* Tab navigation */}
			<div className="flex gap-1 mb-6 border-b border-border pb-2">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={cn(
							"flex items-center gap-2 px-3 py-2 text-sm rounded-t-md transition-colors",
							activeTab === tab.id
								? "bg-accent text-accent-foreground border-b-2 border-primary"
								: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
						)}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>

			{/* Overview tab */}
			{activeTab === "overview" && (
				<div>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
						<StatCard
							icon={<FileImage className="h-4 w-4" />}
							label="Total Files"
							value={catalog.totalFiles}
						/>
						<StatCard
							icon={<Folder className="h-4 w-4" />}
							label="Categories"
							value={categories.length}
							subtitle={categories.join(", ")}
						/>
						<StatCard
							icon={<HardDrive className="h-4 w-4" />}
							label="Total Size"
							value={catalog.totalSize}
						/>
						<StatCard
							icon={<Package className="h-4 w-4" />}
							label="Asset Packs"
							value={totalPacks}
							subtitle={`${allFormats.length} formats`}
						/>
					</div>

					{/* Category breakdown */}
					<h2 className="text-lg font-semibold mb-3">Categories</h2>
					<div className="space-y-3">
						{categories.map((cat) => {
							const catData = catalog.categories[cat];
							const catFiles = catData.packs.reduce(
								(sum, p) => sum + p.files,
								0,
							);
							return (
								<div
									key={cat}
									className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-accent/50 transition-colors"
									onClick={() => setActiveTab(cat as Tab)}
									onKeyDown={(e) => {
										if (e.key === "Enter") setActiveTab(cat as Tab);
									}}
								>
									<span className={cn(CATEGORY_COLORS[cat])}>
										{CATEGORY_ICONS[cat] || (
											<FileImage className="h-4 w-4" />
										)}
									</span>
									<div className="flex-1">
										<div className="font-medium capitalize">{cat}</div>
										<div className="text-xs text-muted-foreground">
											{catData.packs.length} packs &middot;{" "}
											{catFiles.toLocaleString()} files
										</div>
									</div>
									<div className="text-sm font-mono text-muted-foreground">
										{catFiles.toLocaleString()}
									</div>
								</div>
							);
						})}
					</div>

					{/* Formats summary */}
					<h2 className="text-lg font-semibold mb-3 mt-6">Formats</h2>
					<div className="flex flex-wrap gap-2">
						{allFormats.sort().map((fmt) => (
							<span
								key={fmt}
								className="px-2 py-1 text-xs rounded bg-accent text-accent-foreground uppercase"
							>
								{fmt}
							</span>
						))}
					</div>

					{/* Base path info */}
					<div className="mt-6 rounded-lg border border-border bg-card p-4">
						<div className="text-xs text-muted-foreground mb-1">
							Server Base Path
						</div>
						<code className="text-sm font-mono">{catalog.basePath}</code>
						<div className="text-xs text-muted-foreground mt-2">
							API endpoint:{" "}
							<code>/api/app-builder/media-stock/{"<path>"}</code>
						</div>
					</div>
				</div>
			)}

			{/* Category tabs */}
			{activeTab !== "overview" && catalog.categories[activeTab] && (
				<CategoryTab
					category={activeTab}
					packs={catalog.categories[activeTab].packs}
				/>
			)}

			{activeTab !== "overview" && !catalog.categories[activeTab] && (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground">
						No assets found in the &ldquo;{activeTab}&rdquo; category.
					</p>
				</div>
			)}
		</div>
	);
}
