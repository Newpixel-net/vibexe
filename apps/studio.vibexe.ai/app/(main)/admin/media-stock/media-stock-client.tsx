"use client";

import {
	ArrowLeft,
	ChevronRight,
	Copy,
	Database,
	Eye,
	EyeOff,
	FileImage,
	Folder,
	FolderOpen,
	HardDrive,
	Home,
	Layers,
	Monitor,
	Music,
	Package,
	Search,
	SortAsc,
	SortDesc,
	Swords,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────
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

interface FileEntry {
	name: string;
	isDir: boolean;
	size: number;
	ext: string;
	path: string;
}

interface BrowseResponse {
	files: FileEntry[];
	total: number;
	page: number;
	totalPages: number;
}

interface AdminConfig {
	disabledAssets: string[];
	notes: Record<string, string>;
}

type SortField = "name" | "size";
type SortOrder = "asc" | "desc";
type OrientationFilter = "all" | "landscape" | "portrait" | "square";

// ─── Constants ───────────────────────────────────────────────────
const IMG_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "svg", "gif"]);

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
	characters: <Users className="h-5 w-5" />,
	environments: <Layers className="h-5 w-5" />,
	items: <Swords className="h-5 w-5" />,
	ui: <Monitor className="h-5 w-5" />,
	audio: <Music className="h-5 w-5" />,
	effects: <FileImage className="h-5 w-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
	characters: "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10",
	environments: "border-green-500/30 bg-green-500/5 hover:bg-green-500/10",
	items: "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
	ui: "border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10",
	audio: "border-pink-500/30 bg-pink-500/5 hover:bg-pink-500/10",
	effects: "border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10",
};

const CATEGORY_TEXT: Record<string, string> = {
	characters: "text-blue-400",
	environments: "text-green-400",
	items: "text-amber-400",
	ui: "text-purple-400",
	audio: "text-pink-400",
	effects: "text-cyan-400",
};

// ─── Helpers ─────────────────────────────────────────────────────
function formatSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

function aspectRatio(w: number, h: number): string {
	const d = gcd(w, h);
	return `${w / d}:${h / d}`;
}

function orientationLabel(w: number, h: number): "Landscape" | "Portrait" | "Square" {
	if (w > h) return "Landscape";
	if (h > w) return "Portrait";
	return "Square";
}

// ─── Stat Card ───────────────────────────────────────────────────
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
			<div className="text-2xl font-bold">
				{typeof value === "number" ? value.toLocaleString() : value}
			</div>
			{subtitle && (
				<div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
			)}
		</div>
	);
}

// ─── Lazy Thumbnail ──────────────────────────────────────────────
function LazyThumbnail({
	src,
	alt,
	isDisabled,
	onLoad,
}: {
	src: string;
	alt: string;
	isDisabled: boolean;
	onLoad?: (w: number, h: number) => void;
}) {
	const imgRef = useRef<HTMLImageElement>(null);
	const [visible, setVisible] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const observerRef = useRef<IntersectionObserver | null>(null);

	useEffect(() => {
		const el = imgRef.current;
		if (!el) return;
		observerRef.current = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setVisible(true);
					observerRef.current?.disconnect();
				}
			},
			{ rootMargin: "200px" },
		);
		observerRef.current.observe(el);
		return () => observerRef.current?.disconnect();
	}, []);

	return (
		<div
			ref={imgRef}
			className={cn(
				"w-full aspect-square bg-accent/30 rounded flex items-center justify-center overflow-hidden",
				isDisabled && "opacity-40",
			)}
		>
			{visible ? (
				<img
					src={src}
					alt={alt}
					loading="lazy"
					className={cn(
						"max-w-full max-h-full object-contain transition-opacity duration-200",
						loaded ? "opacity-100" : "opacity-0",
					)}
					onLoad={(e) => {
						setLoaded(true);
						const img = e.currentTarget;
						onLoad?.(img.naturalWidth, img.naturalHeight);
					}}
				/>
			) : (
				<FileImage className="h-8 w-8 text-muted-foreground/20" />
			)}
		</div>
	);
}

// ─── File Card ───────────────────────────────────────────────────
function FileCard({
	file,
	isDisabled,
	onToggleDisable,
	onClick,
}: {
	file: FileEntry;
	isDisabled: boolean;
	onToggleDisable: () => void;
	onClick: () => void;
}) {
	const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
	const isImage = IMG_EXTENSIONS.has(file.ext);

	return (
		<div
			className={cn(
				"group rounded-lg border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors cursor-pointer relative",
				isDisabled && "border-red-500/30",
			)}
			onClick={onClick}
			onKeyDown={(e) => e.key === "Enter" && onClick()}
		>
			{/* Thumbnail */}
			{isImage ? (
				<LazyThumbnail
					src={`/api/app-builder/media-stock/${file.path}`}
					alt={file.name}
					isDisabled={isDisabled}
					onLoad={(w, h) => setDims({ w, h })}
				/>
			) : (
				<div className="w-full aspect-square bg-accent/30 rounded flex items-center justify-center">
					<FileImage className="h-10 w-10 text-muted-foreground/30" />
				</div>
			)}

			{/* Info bar */}
			<div className="p-2">
				<div className={cn("text-xs font-medium truncate", isDisabled && "line-through text-muted-foreground")}>
					{file.name}
				</div>
				<div className="flex items-center justify-between mt-1">
					<span className="text-[10px] text-muted-foreground">
						{formatSize(file.size)}
					</span>
					{dims && (
						<span className="text-[10px] text-muted-foreground bg-accent px-1 rounded">
							{dims.w}x{dims.h} {orientationLabel(dims.w, dims.h)}
						</span>
					)}
				</div>
			</div>

			{/* Disable toggle */}
			<button
				type="button"
				className={cn(
					"absolute top-1.5 right-1.5 p-1 rounded-md transition-opacity",
					"opacity-0 group-hover:opacity-100",
					isDisabled
						? "bg-red-500/80 text-white opacity-100"
						: "bg-black/50 text-white hover:bg-black/70",
				)}
				onClick={(e) => {
					e.stopPropagation();
					onToggleDisable();
				}}
				title={isDisabled ? "Enable asset" : "Disable asset"}
			>
				{isDisabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
			</button>
		</div>
	);
}

// ─── File Detail Modal ───────────────────────────────────────────
function FileDetailModal({
	file,
	isDisabled,
	note,
	onClose,
	onToggleDisable,
	onSetNote,
}: {
	file: FileEntry;
	isDisabled: boolean;
	note: string;
	onClose: () => void;
	onToggleDisable: () => void;
	onSetNote: (note: string) => void;
}) {
	const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
	const [copied, setCopied] = useState<string | null>(null);
	const [noteValue, setNoteValue] = useState(note);
	const isImage = IMG_EXTENSIONS.has(file.ext);
	const url = `/api/app-builder/media-stock/${file.path}`;

	function copyText(text: string, label: string) {
		navigator.clipboard.writeText(text);
		setCopied(label);
		setTimeout(() => setCopied(null), 2000);
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className="relative bg-card border border-border rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Close button */}
				<button
					type="button"
					onClick={onClose}
					className="absolute top-3 right-3 p-1 rounded-md bg-accent hover:bg-accent/80 z-10"
				>
					<X className="h-4 w-4" />
				</button>

				{/* Preview */}
				{isImage && (
					<div className="bg-accent/20 p-4 flex items-center justify-center min-h-[300px]">
						<img
							src={url}
							alt={file.name}
							className="max-w-full max-h-[400px] object-contain"
							onLoad={(e) => {
								const img = e.currentTarget;
								setDims({ w: img.naturalWidth, h: img.naturalHeight });
							}}
						/>
					</div>
				)}

				{/* Info */}
				<div className="p-5 space-y-4">
					<div>
						<h3 className={cn("text-lg font-semibold", isDisabled && "line-through text-muted-foreground")}>
							{file.name}
						</h3>
						<div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
							<span>{formatSize(file.size)}</span>
							<span className="uppercase">{file.ext}</span>
							{dims && (
								<>
									<span>{dims.w} x {dims.h}</span>
									<span>{aspectRatio(dims.w, dims.h)}</span>
									<span>{orientationLabel(dims.w, dims.h)}</span>
								</>
							)}
						</div>
					</div>

					{/* Copy buttons */}
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => copyText(file.path, "path")}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-accent hover:bg-accent/80 transition-colors"
						>
							<Copy className="h-3 w-3" />
							{copied === "path" ? "Copied!" : "Copy Path"}
						</button>
						<button
							type="button"
							onClick={() => copyText(`assetUrl("${file.path}")`, "assetUrl")}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-accent hover:bg-accent/80 transition-colors"
						>
							<Copy className="h-3 w-3" />
							{copied === "assetUrl" ? "Copied!" : "Copy assetUrl()"}
						</button>
						<button
							type="button"
							onClick={() => onToggleDisable()}
							className={cn(
								"flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors",
								isDisabled
									? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
									: "bg-accent hover:bg-accent/80",
							)}
						>
							{isDisabled ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
							{isDisabled ? "Disabled" : "Enabled"}
						</button>
					</div>

					{/* Path */}
					<div>
						<div className="text-xs text-muted-foreground mb-1">Full Path</div>
						<code className="text-xs bg-accent rounded px-2 py-1 font-mono block truncate">
							{file.path}
						</code>
					</div>

					{/* Admin note */}
					<div>
						<div className="text-xs text-muted-foreground mb-1">Admin Note</div>
						<div className="flex gap-2">
							<input
								type="text"
								value={noteValue}
								onChange={(e) => setNoteValue(e.target.value)}
								placeholder="Add a note about this asset..."
								className="flex-1 text-xs bg-accent rounded px-2 py-1.5 border border-border focus:outline-none focus:border-primary"
							/>
							<button
								type="button"
								onClick={() => onSetNote(noteValue)}
								className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
							>
								Save
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// ─── Main Component ──────────────────────────────────────────────
export function MediaStockClient({ catalog }: { catalog: Catalog | null }) {
	// Navigation
	const [currentPath, setCurrentPath] = useState("");
	const [files, setFiles] = useState<FileEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	// Filters / sort
	const [search, setSearch] = useState("");
	const [sortField, setSortField] = useState<SortField>("name");
	const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
	const [orientationFilter, setOrientationFilter] = useState<OrientationFilter>("all");

	// Admin config
	const [config, setConfig] = useState<AdminConfig>({ disabledAssets: [], notes: {} });

	// Detail modal
	const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);

	// Dimension cache (for orientation filtering)
	const [dimCache, setDimCache] = useState<Record<string, { w: number; h: number }>>({});

	// Debounce search
	const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
	const [debouncedSearch, setDebouncedSearch] = useState("");

	useEffect(() => {
		searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
		return () => clearTimeout(searchTimerRef.current);
	}, [search]);

	// Fetch admin config on mount
	useEffect(() => {
		fetch("/api/admin/media-stock/config")
			.then((r) => r.json())
			.then((c: AdminConfig) => setConfig(c))
			.catch(() => {});
	}, []);

	// Fetch directory listing
	const fetchDir = useCallback(async () => {
		if (!currentPath) return; // At root = overview mode
		setLoading(true);
		try {
			const params = new URLSearchParams({
				path: currentPath,
				page: String(page),
				limit: "100",
				sort: sortField,
				order: sortOrder,
				search: debouncedSearch,
			});
			const res = await fetch(`/api/admin/media-stock/browse?${params}`);
			const data = (await res.json()) as BrowseResponse;
			setFiles(data.files);
			setTotal(data.total);
			setTotalPages(data.totalPages);
		} catch {
			setFiles([]);
		} finally {
			setLoading(false);
		}
	}, [currentPath, page, sortField, sortOrder, debouncedSearch]);

	useEffect(() => {
		fetchDir();
	}, [fetchDir]);

	// Navigate into a directory
	function navigateTo(path: string) {
		setCurrentPath(path);
		setPage(1);
		setSearch("");
		setDebouncedSearch("");
		setDimCache({});
		setOrientationFilter("all");
	}

	// Toggle disable
	async function toggleDisable(filePath: string) {
		try {
			const res = await fetch("/api/admin/media-stock/config", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ togglePath: filePath }),
			});
			const newConfig = (await res.json()) as AdminConfig;
			setConfig(newConfig);
		} catch { /* ignore */ }
	}

	// Set note
	async function setNote(filePath: string, note: string) {
		try {
			const res = await fetch("/api/admin/media-stock/config", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ setNote: { path: filePath, note } }),
			});
			const newConfig = (await res.json()) as AdminConfig;
			setConfig(newConfig);
		} catch { /* ignore */ }
	}

	// Handle dimension loaded for orientation filter
	function onDimLoaded(filePath: string, w: number, h: number) {
		setDimCache((prev) => ({ ...prev, [filePath]: { w, h } }));
	}

	// Orientation-filtered files (client-side)
	const filteredFiles =
		orientationFilter === "all"
			? files
			: files.filter((f) => {
					if (f.isDir) return true;
					const d = dimCache[f.path];
					if (!d) return true; // Not loaded yet, show it
					const o = orientationLabel(d.w, d.h).toLowerCase();
					return o === orientationFilter;
				});

	// Breadcrumbs
	const pathSegments = currentPath ? currentPath.split("/").filter(Boolean) : [];
	const breadcrumbs = pathSegments.map((seg, i) => ({
		label: seg,
		path: pathSegments.slice(0, i + 1).join("/"),
	}));

	// No catalog available
	if (!catalog) {
		return (
			<div className="p-6">
				<h1 className="text-2xl font-bold mb-4">Media Stock</h1>
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<Database className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
					<p className="text-muted-foreground">
						Media stock catalog not found. This is expected in development environments.
					</p>
					<p className="text-xs text-muted-foreground mt-2">
						Catalog should be at: <code>/opt/vibexe/media-stock/games/catalog.json</code>
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

	const imageFiles = filteredFiles.filter((f) => !f.isDir && IMG_EXTENSIONS.has(f.ext));
	const dirFiles = filteredFiles.filter((f) => f.isDir);
	const otherFiles = filteredFiles.filter((f) => !f.isDir && !IMG_EXTENSIONS.has(f.ext));

	return (
		<div className="p-6">
			{/* Header */}
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Media Stock</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Game asset database &middot; {catalog.totalFiles.toLocaleString()} files
					&middot; {catalog.totalSize} &middot; v{catalog.version}
				</p>
			</div>

			{/* Breadcrumb navigation */}
			{currentPath && (
				<div className="flex items-center gap-1 mb-4 text-sm flex-wrap">
					<button
						type="button"
						onClick={() => navigateTo("")}
						className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
					>
						<Home className="h-3.5 w-3.5" />
						Root
					</button>
					{breadcrumbs.map((bc) => (
						<span key={bc.path} className="flex items-center gap-1">
							<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
							<button
								type="button"
								onClick={() => navigateTo(bc.path)}
								className={cn(
									"px-2 py-1 rounded hover:bg-accent transition-colors",
									bc.path === currentPath
										? "text-foreground font-medium"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{bc.label}
							</button>
						</span>
					))}
				</div>
			)}

			{/* ═══ OVERVIEW MODE (root) ═══ */}
			{!currentPath && (
				<div>
					{/* Stats */}
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

					{/* Category cards */}
					<h2 className="text-lg font-semibold mb-3">Browse Categories</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
						{categories.map((cat) => {
							const catData = catalog.categories[cat];
							const catFiles = catData.packs.reduce((sum, p) => sum + p.files, 0);
							return (
								<button
									key={cat}
									type="button"
									onClick={() => navigateTo(cat)}
									className={cn(
										"flex items-center gap-4 rounded-xl border p-4 text-left transition-colors",
										CATEGORY_COLORS[cat] || "border-border bg-card hover:bg-accent/50",
									)}
								>
									<span className={cn("text-2xl", CATEGORY_TEXT[cat])}>
										{CATEGORY_ICONS[cat] || <FileImage className="h-5 w-5" />}
									</span>
									<div className="flex-1 min-w-0">
										<div className="font-semibold capitalize">{cat}</div>
										<div className="text-xs text-muted-foreground">
											{catData.packs.length} packs &middot; {catFiles.toLocaleString()} files
										</div>
									</div>
									<ChevronRight className="h-5 w-5 text-muted-foreground" />
								</button>
							);
						})}
					</div>

					{/* Formats */}
					<h2 className="text-lg font-semibold mb-3">File Formats</h2>
					<div className="flex flex-wrap gap-2 mb-6">
						{allFormats.sort().map((fmt) => (
							<span
								key={fmt}
								className="px-2 py-1 text-xs rounded bg-accent text-accent-foreground uppercase"
							>
								{fmt}
							</span>
						))}
					</div>

					{/* Base path */}
					<div className="rounded-lg border border-border bg-card p-4">
						<div className="text-xs text-muted-foreground mb-1">Server Base Path</div>
						<code className="text-sm font-mono">{catalog.basePath}</code>
						<div className="text-xs text-muted-foreground mt-2">
							API endpoint: <code>/api/app-builder/media-stock/{"<path>"}</code>
						</div>
					</div>
				</div>
			)}

			{/* ═══ BROWSE MODE ═══ */}
			{currentPath && (
				<div>
					{/* Toolbar */}
					<div className="flex flex-wrap items-center gap-3 mb-4">
						{/* Back button */}
						<button
							type="button"
							onClick={() => {
								const parent = pathSegments.slice(0, -1).join("/");
								navigateTo(parent);
							}}
							className="flex items-center gap-1 px-2 py-1.5 text-sm rounded-md border border-border hover:bg-accent transition-colors"
						>
							<ArrowLeft className="h-3.5 w-3.5" />
							Back
						</button>

						{/* Search */}
						<div className="relative flex-1 min-w-[200px] max-w-[400px]">
							<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
							<input
								type="text"
								placeholder="Search files..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="w-full pl-8 pr-3 py-1.5 text-sm bg-accent/50 rounded-md border border-border focus:outline-none focus:border-primary"
							/>
						</div>

						{/* Sort */}
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => setSortField(sortField === "name" ? "size" : "name")}
								className="px-2 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors"
							>
								{sortField === "name" ? "Name" : "Size"}
							</button>
							<button
								type="button"
								onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
								className="p-1.5 rounded-md border border-border hover:bg-accent transition-colors"
							>
								{sortOrder === "asc" ? (
									<SortAsc className="h-3.5 w-3.5" />
								) : (
									<SortDesc className="h-3.5 w-3.5" />
								)}
							</button>
						</div>

						{/* Orientation filter */}
						<div className="flex items-center gap-1">
							{(["all", "landscape", "portrait", "square"] as OrientationFilter[]).map((o) => (
								<button
									key={o}
									type="button"
									onClick={() => setOrientationFilter(o)}
									className={cn(
										"px-2 py-1.5 text-xs rounded-md border transition-colors capitalize",
										orientationFilter === o
											? "border-primary bg-primary/10 text-primary"
											: "border-border hover:bg-accent",
									)}
								>
									{o}
								</button>
							))}
						</div>

						{/* File count */}
						<div className="text-xs text-muted-foreground ml-auto">
							{loading ? "Loading..." : `${total} items`}
						</div>
					</div>

					{/* Loading */}
					{loading && (
						<div className="flex items-center justify-center py-12">
							<div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
						</div>
					)}

					{/* Directories */}
					{!loading && dirFiles.length > 0 && (
						<div className="mb-4">
							<div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
								Folders ({dirFiles.length})
							</div>
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
								{dirFiles.map((dir) => (
									<button
										key={dir.path}
										type="button"
										onClick={() => navigateTo(dir.path)}
										className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-primary/50 transition-colors text-left"
									>
										<FolderOpen className="h-5 w-5 text-amber-400 shrink-0" />
										<span className="text-sm font-medium truncate">{dir.name}</span>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Image files grid */}
					{!loading && imageFiles.length > 0 && (
						<div className="mb-4">
							<div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
								Images ({imageFiles.length})
							</div>
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
								{imageFiles.map((file) => (
									<FileCard
										key={file.path}
										file={file}
										isDisabled={config.disabledAssets.includes(file.path)}
										onToggleDisable={() => toggleDisable(file.path)}
										onClick={() => setSelectedFile(file)}
									/>
								))}
							</div>
						</div>
					)}

					{/* Non-image files */}
					{!loading && otherFiles.length > 0 && (
						<div className="mb-4">
							<div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
								Other Files ({otherFiles.length})
							</div>
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
								{otherFiles.map((file) => (
									<div
										key={file.path}
										className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card text-left"
									>
										<FileImage className="h-4 w-4 text-muted-foreground shrink-0" />
										<div className="min-w-0">
											<div className="text-xs font-medium truncate">{file.name}</div>
											<div className="text-[10px] text-muted-foreground">
												{formatSize(file.size)} &middot; {file.ext.toUpperCase()}
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Empty state */}
					{!loading && filteredFiles.length === 0 && (
						<div className="text-center py-12">
							<FileImage className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
							<p className="text-muted-foreground">
								{search ? `No files matching "${search}"` : "No files in this directory"}
							</p>
						</div>
					)}

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="flex items-center justify-center gap-2 mt-6">
							<button
								type="button"
								disabled={page <= 1}
								onClick={() => setPage(page - 1)}
								className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Previous
							</button>
							<span className="text-sm text-muted-foreground">
								Page {page} of {totalPages}
							</span>
							<button
								type="button"
								disabled={page >= totalPages}
								onClick={() => setPage(page + 1)}
								className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Next
							</button>
						</div>
					)}
				</div>
			)}

			{/* Detail modal */}
			{selectedFile && (
				<FileDetailModal
					file={selectedFile}
					isDisabled={config.disabledAssets.includes(selectedFile.path)}
					note={config.notes[selectedFile.path] || ""}
					onClose={() => setSelectedFile(null)}
					onToggleDisable={() => toggleDisable(selectedFile.path)}
					onSetNote={(note) => setNote(selectedFile.path, note)}
				/>
			)}
		</div>
	);
}
