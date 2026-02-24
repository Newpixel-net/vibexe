"use client";

import {
	Check,
	ChevronDown,
	ChevronUp,
	Download,
	Filter,
	Loader2,
	Plus,
	RefreshCw,
	Search,
	Settings,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EntityForm } from "./entity-form";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SchemaField {
	name: string;
	type: string;
	required?: boolean;
}

interface SchemaEntity {
	name: string;
	tableName: string;
	fields: SchemaField[];
}

interface DataPanelProps {
	appId: string;
	schema: { entities: SchemaEntity[] } | null;
}

type SortOrder = "asc" | "desc";

// ─── Helpers ───────────────────────────────────────────────────────────────

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

function formatCellValue(value: unknown): string {
	if (value === null || value === undefined) return "\u2014";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (value instanceof Date) return value.toLocaleDateString();
	if (typeof value === "object") return JSON.stringify(value);
	const str = String(value);
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
		return relativeTime(value);
	}
	return str;
}

function escapeCsv(val: unknown): string {
	if (val === null || val === undefined) return "";
	const str = typeof val === "object" ? JSON.stringify(val) : String(val);
	if (str.includes(",") || str.includes('"') || str.includes("\n")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
	const lines = text.split(/\r?\n/).filter((l) => l.trim());
	if (lines.length === 0) return { headers: [], rows: [] };

	const parseLine = (line: string): string[] => {
		const result: string[] = [];
		let current = "";
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (inQuotes) {
				if (ch === '"' && line[i + 1] === '"') {
					current += '"';
					i++;
				} else if (ch === '"') {
					inQuotes = false;
				} else {
					current += ch;
				}
			} else {
				if (ch === '"') {
					inQuotes = true;
				} else if (ch === ",") {
					result.push(current.trim());
					current = "";
				} else {
					current += ch;
				}
			}
		}
		result.push(current.trim());
		return result;
	};

	const headers = parseLine(lines[0]);
	const rows = lines.slice(1).map(parseLine);
	return { headers, rows };
}

function coerceValue(raw: string, fieldType: string): unknown {
	if (raw === "" || raw === "null" || raw === "NULL") return null;
	switch (fieldType) {
		case "number":
		case "integer":
		case "float": {
			const n = Number(raw);
			return Number.isNaN(n) ? raw : n;
		}
		case "boolean":
			return raw === "true" || raw === "1" || raw === "yes" || raw === "Yes";
		case "json":
			try {
				return JSON.parse(raw);
			} catch {
				return raw;
			}
		default:
			return raw;
	}
}

// ─── Component ─────────────────────────────────────────────────────────────

export function DataPanel({ appId, schema }: DataPanelProps) {
	// Entity selection
	const [selectedEntity, setSelectedEntity] = useState<string | null>(
		schema?.entities?.[0]?.tableName ?? null,
	);

	// Data state
	const [rows, setRows] = useState<Record<string, unknown>[]>([]);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [total, setTotal] = useState(0);
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	// Sort state (server-side)
	const [sortField, setSortField] = useState("created_at");
	const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

	// Search state (server-side debounced)
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Filter state (server-side)
	const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

	// Search config state
	const [searchConfigOpen, setSearchConfigOpen] = useState(false);
	const [searchConfig, setSearchConfig] = useState<Array<{ field: string; weight: string }> | null>(null);
	const [searchTextFields, setSearchTextFields] = useState<string[]>([]);
	const [searchConfigLoading, setSearchConfigLoading] = useState(false);
	const [searchConfigSaving, setSearchConfigSaving] = useState(false);

	// Entity counts for tab badges
	const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});

	// Inline editing state
	const [editingCell, setEditingCell] = useState<{
		rowId: number;
		fieldName: string;
	} | null>(null);
	const [editValue, setEditValue] = useState<string>("");
	const [savingCell, setSavingCell] = useState(false);
	const editInputRef = useRef<HTMLInputElement>(null);

	// Modal form state (add/edit row)
	const [formOpen, setFormOpen] = useState(false);
	const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);

	// Import state
	const [importOpen, setImportOpen] = useState(false);
	const [importData, setImportData] = useState<{
		headers: string[];
		rows: string[][];
		mapping: Record<string, string>;
	} | null>(null);
	const [importProgress, setImportProgress] = useState<{
		current: number;
		total: number;
		errors: number;
	} | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const fetchAbortRef = useRef<AbortController | null>(null);

	const currentEntity = useMemo(
		() => schema?.entities.find((e) => e.tableName === selectedEntity) ?? null,
		[schema, selectedEntity],
	);

	const allColumns = useMemo(() => {
		if (!currentEntity) return [];
		return ["id", ...currentEntity.fields.map((f) => f.name), "created_at"];
	}, [currentEntity]);

	// Non-editable columns
	const readonlyColumns = new Set(["id", "created_at", "updated_at"]);

	// ─── Debounced Search ───────────────────────────────────────────────────

	useEffect(() => {
		if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		searchTimerRef.current = setTimeout(() => {
			setDebouncedSearch(search);
			setPage(1);
		}, 300);
		return () => {
			if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		};
	}, [search]);

	// ─── Fetch Data ─────────────────────────────────────────────────────────

	const fetchData = useCallback(async () => {
		if (!selectedEntity) return;
		// Cancel previous in-flight request to prevent stale data overwriting fresh results
		if (fetchAbortRef.current) fetchAbortRef.current.abort();
		const controller = new AbortController();
		fetchAbortRef.current = controller;
		setLoading(true);
		try {
			const params = new URLSearchParams({
				page: String(page),
				limit: "20",
				sort: sortField,
				order: sortOrder,
			});
			for (const [key, val] of Object.entries(activeFilters)) {
				if (val) params.set(`filter[${key}]`, val);
			}
			if (debouncedSearch.trim()) {
				params.set("search", debouncedSearch.trim());
			}
			const res = await fetch(
				`/api/apps/${appId}/data/${selectedEntity}?${params}`,
				{ signal: controller.signal },
			);
			if (res.ok) {
				const json = await res.json();
				setRows(json.data || []);
				setTotalPages(json.pagination?.totalPages || 1);
				setTotal(json.pagination?.total || 0);
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") return;
			console.error("Failed to fetch data:", err);
		} finally {
			if (!controller.signal.aborted) setLoading(false);
		}
	}, [appId, selectedEntity, page, sortField, sortOrder, activeFilters, debouncedSearch]);

	useEffect(() => {
		fetchData();
	}, [fetchData, refreshTrigger]);

	// ─── Fetch Entity Counts ────────────────────────────────────────────────

	const fetchEntityCounts = useCallback(async () => {
		if (!schema?.entities?.length) return;
		const counts: Record<string, number> = {};
		await Promise.all(
			schema.entities.map(async (entity) => {
				try {
					const res = await fetch(
						`/api/apps/${appId}/data/${entity.tableName}?limit=1`,
					);
					if (res.ok) {
						const json = await res.json();
						counts[entity.tableName] = json.pagination?.total ?? 0;
					}
				} catch {
					counts[entity.tableName] = 0;
				}
			}),
		);
		setEntityCounts(counts);
	}, [appId, schema]);

	useEffect(() => {
		fetchEntityCounts();
	}, [fetchEntityCounts, refreshTrigger]);

	// ─── Search Config Fetch ────────────────────────────────────────────────

	const fetchSearchConfig = useCallback(async () => {
		if (!selectedEntity) return;
		setSearchConfigLoading(true);
		try {
			const res = await fetch(
				`/api/apps/${appId}/data/${selectedEntity}/search-config`,
			);
			if (res.ok) {
				const json = await res.json();
				setSearchConfig(json.searchConfig);
				setSearchTextFields(json.textFields || []);
			}
		} catch {
			// Silently fail — search config is optional
		} finally {
			setSearchConfigLoading(false);
		}
	}, [appId, selectedEntity]);

	useEffect(() => {
		if (searchConfigOpen) fetchSearchConfig();
	}, [searchConfigOpen, fetchSearchConfig]);

	const saveSearchConfig = async (newConfig: Array<{ field: string; weight: string }> | null) => {
		if (!selectedEntity) return;
		setSearchConfigSaving(true);
		try {
			const res = await fetch(
				`/api/apps/${appId}/data/${selectedEntity}/search-config`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ searchConfig: newConfig }),
				},
			);
			if (res.ok) {
				setSearchConfig(newConfig);
			}
		} catch (err) {
			console.error("Failed to save search config:", err);
		} finally {
			setSearchConfigSaving(false);
		}
	};

	// ─── Auto-detect Filterable Fields ──────────────────────────────────────

	const filterableFields = useMemo(() => {
		if (!currentEntity) return [];
		const candidates: {
			fieldName: string;
			values: string[];
		}[] = [];
		for (const field of currentEntity.fields) {
			if (
				field.type === "boolean" ||
				field.type === "json" ||
				field.type === "text"
			)
				continue;
			const distinctValues = new Set<string>();
			for (const row of rows) {
				const v = row[field.name];
				if (v !== null && v !== undefined) {
					distinctValues.add(String(v));
				}
			}
			if (distinctValues.size > 0 && distinctValues.size <= 10) {
				candidates.push({
					fieldName: field.name,
					values: Array.from(distinctValues).sort(),
				});
			}
		}
		return candidates;
	}, [currentEntity, rows]);

	// ─── Sort Handler ───────────────────────────────────────────────────────

	const handleSort = (field: string) => {
		if (sortField === field) {
			setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
		} else {
			setSortField(field);
			setSortOrder("asc");
		}
		setPage(1);
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

	// ─── Entity Tab Switch ──────────────────────────────────────────────────

	const handleTabSwitch = (tableName: string) => {
		setSelectedEntity(tableName);
		setFormOpen(false);
		setEditRow(null);
		setSearch("");
		setDebouncedSearch("");
		setActiveFilters({});
		setSortField("created_at");
		setSortOrder("desc");
		setPage(1);
		setEditingCell(null);
		setSearchConfigOpen(false);
	};

	// ─── Delete Row ─────────────────────────────────────────────────────────

	const handleDelete = async (id: number) => {
		if (!window.confirm("Delete this row?")) return;
		try {
			await fetch(`/api/apps/${appId}/data/${selectedEntity}/${id}`, {
				method: "DELETE",
			});
			setRefreshTrigger((p) => p + 1);
		} catch (err) {
			console.error("Delete failed:", err);
		}
	};

	// ─── Inline Edit ────────────────────────────────────────────────────────

	const startInlineEdit = (
		rowId: number,
		fieldName: string,
		currentValue: unknown,
	) => {
		if (readonlyColumns.has(fieldName)) return;
		setEditingCell({ rowId, fieldName });
		setEditValue(
			currentValue === null || currentValue === undefined
				? ""
				: String(currentValue),
		);
		setTimeout(() => editInputRef.current?.focus(), 0);
	};

	const cancelInlineEdit = () => {
		setEditingCell(null);
		setEditValue("");
	};

	const saveInlineEdit = async () => {
		if (!editingCell || !selectedEntity) return;
		setSavingCell(true);

		const field = currentEntity?.fields.find(
			(f) => f.name === editingCell.fieldName,
		);
		const coerced = field
			? coerceValue(editValue, field.type)
			: editValue;

		try {
			const res = await fetch(
				`/api/apps/${appId}/data/${selectedEntity}/${editingCell.rowId}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ [editingCell.fieldName]: coerced }),
				},
			);
			if (res.ok) {
				// Optimistic local update
				setRows((prev) =>
					prev.map((r) =>
						r.id === editingCell.rowId
							? { ...r, [editingCell.fieldName]: coerced }
							: r,
					),
				);
			}
		} catch (err) {
			console.error("Inline edit failed:", err);
		} finally {
			setSavingCell(false);
			setEditingCell(null);
			setEditValue("");
		}
	};

	const handleInlineKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			saveInlineEdit();
		} else if (e.key === "Escape") {
			cancelInlineEdit();
		}
	};

	// ─── Export CSV ─────────────────────────────────────────────────────────

	const handleExport = () => {
		if (!currentEntity) return;
		const csvHeader = allColumns.map(escapeCsv).join(",");
		const csvRows = rows
			.map((row) => allColumns.map((col) => escapeCsv(row[col])).join(","))
			.join("\n");
		const blob = new Blob([`${csvHeader}\n${csvRows}`], {
			type: "text/csv",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${currentEntity.name}-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	// ─── Import CSV ─────────────────────────────────────────────────────────

	const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !currentEntity) return;

		const reader = new FileReader();
		reader.onload = (ev) => {
			const text = ev.target?.result as string;
			const { headers, rows: csvRows } = parseCsv(text);

			// Auto-map CSV columns to entity fields
			const mapping: Record<string, string> = {};
			const fieldNames = currentEntity.fields.map((f) => f.name);
			for (const header of headers) {
				const lower = header.toLowerCase();
				const match = fieldNames.find(
					(fn) =>
						fn.toLowerCase() === lower ||
						fn.toLowerCase().replace(/_/g, "") ===
							lower.replace(/[\s_]/g, ""),
				);
				if (match) mapping[header] = match;
			}

			setImportData({ headers, rows: csvRows, mapping });
			setImportOpen(true);
			setImportProgress(null);
		};
		reader.readAsText(file);
		// Reset file input so same file can be re-selected
		e.target.value = "";
	};

	const handleImportExecute = async () => {
		if (!importData || !currentEntity || !selectedEntity) return;

		const mapped = importData.rows.map((csvRow) => {
			const record: Record<string, unknown> = {};
			for (const [csvHeader, fieldName] of Object.entries(
				importData.mapping,
			)) {
				const idx = importData.headers.indexOf(csvHeader);
				if (idx === -1) continue;
				const field = currentEntity.fields.find(
					(f) => f.name === fieldName,
				);
				record[fieldName] = field
					? coerceValue(csvRow[idx] ?? "", field.type)
					: csvRow[idx];
			}
			return record;
		});

		setImportProgress({ current: 0, total: mapped.length, errors: 0 });
		let errors = 0;
		const BATCH_SIZE = 100;

		// Send records in batches of 100 via the batch endpoint
		for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
			const chunk = mapped.slice(i, i + BATCH_SIZE);
			try {
				const res = await fetch(
					`/api/apps/${appId}/data/${selectedEntity}/batch`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ records: chunk }),
					},
				);
				if (!res.ok) {
					errors += chunk.length;
				}
			} catch {
				errors += chunk.length;
			}
			setImportProgress({
				current: Math.min(i + BATCH_SIZE, mapped.length),
				total: mapped.length,
				errors,
			});
		}

		// Done — refresh data
		setRefreshTrigger((p) => p + 1);
	};

	const closeImport = () => {
		setImportOpen(false);
		setImportData(null);
		setImportProgress(null);
	};

	// ─── Modal Form Handlers ────────────────────────────────────────────────

	const handleAddRow = () => {
		setEditRow(null);
		setFormOpen(true);
	};

	const handleEditRow = (row: Record<string, unknown>) => {
		setEditRow(row);
		setFormOpen(true);
	};

	const handleFormClose = () => {
		setFormOpen(false);
		setEditRow(null);
	};

	const handleFormSaved = () => {
		setFormOpen(false);
		setEditRow(null);
		setRefreshTrigger((p) => p + 1);
	};

	// ─── Render ─────────────────────────────────────────────────────────────

	if (!schema || schema.entities.length === 0) {
		return (
			<div className="text-center py-16 text-white/40">
				<p className="text-lg mb-2">No entities defined</p>
				<p className="text-sm">
					Add entities to your app schema to manage data here.
				</p>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col overflow-hidden">
			{/* Entity Tab Bar with Counts */}
			<div className="flex items-center gap-1 border-b border-white/[0.06] overflow-x-auto shrink-0">
				{schema.entities.map((entity) => (
					<button
						key={entity.tableName}
						type="button"
						onClick={() => handleTabSwitch(entity.tableName)}
						className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px flex items-center gap-2 ${
							selectedEntity === entity.tableName
								? "border-violet-400 text-violet-300"
								: "border-transparent text-white/40 hover:text-white/70 hover:border-white/40"
						}`}
					>
						{entity.name}
						{entityCounts[entity.tableName] !== undefined && (
							<span
								className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
									selectedEntity === entity.tableName
										? "bg-violet-500/20 text-violet-300"
										: "bg-white/[0.06] text-white/40"
								}`}
							>
								{entityCounts[entity.tableName]}
							</span>
						)}
					</button>
				))}
			</div>

			{/* Toolbar: Search + Filters + Actions */}
			{currentEntity && (
				<div className="shrink-0 px-1 pt-4 pb-3 space-y-3">
					{/* Row 1: Search + Refresh + Export + Import + Add */}
					<div className="flex flex-col sm:flex-row gap-2">
						<div className="relative flex-1 flex items-center gap-1.5">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
								<input
									type="text"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Search..."
									className="w-full pl-9 pr-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
								/>
							</div>
							<button
								type="button"
								onClick={() => setSearchConfigOpen((o) => !o)}
								className={`p-2 rounded-md border transition-colors ${
									searchConfigOpen
										? "border-violet-500/30 bg-violet-500/10 text-violet-300"
										: "border-white/[0.08] hover:bg-white/[0.06] text-white/40 hover:text-white/90"
								}`}
								title="Search settings"
							>
								<Settings className="h-4 w-4" />
							</button>
						</div>
						<div className="flex items-center gap-2">
							{/* Refresh */}
							<button
								type="button"
								onClick={() => setRefreshTrigger((p) => p + 1)}
								className="p-2 rounded-md border border-white/[0.08] hover:bg-white/[0.06] text-white/40 hover:text-white/90 transition-colors"
								title="Refresh"
							>
								<RefreshCw
									className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
								/>
							</button>
							{/* Export */}
							<button
								type="button"
								onClick={handleExport}
								disabled={rows.length === 0}
								className="px-3 py-1.5 rounded-md border border-white/[0.08] text-sm font-medium text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors flex items-center gap-1.5 disabled:opacity-30"
							>
								<Download className="h-3.5 w-3.5" />
								Export
							</button>
							{/* Import */}
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="px-3 py-1.5 rounded-md border border-white/[0.08] text-sm font-medium text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors flex items-center gap-1.5"
							>
								<Upload className="h-3.5 w-3.5" />
								Import
							</button>
							<input
								ref={fileInputRef}
								type="file"
								accept=".csv"
								onChange={handleImportFileSelect}
								className="hidden"
							/>
							{/* Add Row */}
							<button
								type="button"
								onClick={handleAddRow}
								className="px-3 py-1.5 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white hover:from-violet-500 hover:to-cyan-500 text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
							>
								<Plus className="h-3.5 w-3.5" />
								Add Row
							</button>
						</div>
					</div>

					{/* Row 2: Filter dropdowns (only when filterable fields exist) */}
					{filterableFields.length > 0 && (
						<div className="flex items-center gap-2 flex-wrap">
							<Filter className="h-3.5 w-3.5 text-white/30" />
							{filterableFields.map((ff) => (
								<select
									key={ff.fieldName}
									value={activeFilters[ff.fieldName] || ""}
									onChange={(e) => {
										setActiveFilters((prev) => {
											const next = { ...prev };
											if (e.target.value) {
												next[ff.fieldName] = e.target.value;
											} else {
												delete next[ff.fieldName];
											}
											return next;
										});
										setPage(1);
									}}
									className="px-2.5 py-1.5 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/30"
								>
									<option value="">
										All {ff.fieldName}
									</option>
									{ff.values.map((v) => (
										<option key={v} value={v}>
											{v}
										</option>
									))}
								</select>
							))}
							{Object.keys(activeFilters).length > 0 && (
								<button
									type="button"
									onClick={() => {
										setActiveFilters({});
										setPage(1);
									}}
									className="text-xs text-white/40 hover:text-white/90 transition-colors flex items-center gap-1"
								>
									<X className="h-3 w-3" />
									Clear filters
								</button>
							)}
						</div>
					)}
				</div>
			)}

			{/* Info bar */}
			{currentEntity && !loading && (
				<div className="shrink-0 px-1 pb-2 flex items-center justify-between">
					<p className="text-xs text-white/40">
						{total} row{total !== 1 ? "s" : ""}
						{debouncedSearch.trim() && (
							<span className="ml-2 text-violet-400/60">
								matching &ldquo;{debouncedSearch}&rdquo;
							</span>
						)}
					</p>
				</div>
			)}

			{/* Search Config Panel */}
			{searchConfigOpen && currentEntity && (
				<div className="shrink-0 mx-1 mb-2 p-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.04] space-y-3">
					<div className="flex items-center justify-between">
						<h4 className="text-xs font-medium text-white/70">Search Settings</h4>
						<button
							type="button"
							onClick={() => setSearchConfigOpen(false)}
							className="text-white/30 hover:text-white/70"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</div>
					{searchConfigLoading ? (
						<div className="flex items-center gap-2 text-xs text-white/40">
							<Loader2 className="h-3 w-3 animate-spin" /> Loading...
						</div>
					) : searchTextFields.length === 0 ? (
						<p className="text-xs text-white/40">No text fields to configure.</p>
					) : (
						<>
							<p className="text-[11px] text-white/40">
								{searchConfig
									? `Full-text search: Enabled (${searchConfig.length} field${searchConfig.length !== 1 ? "s" : ""} indexed)`
									: "Not configured \u2014 searching all text fields with ILIKE fallback"}
							</p>
							<div className="space-y-1.5">
								{searchTextFields.map((field) => {
									const existing = searchConfig?.find((sc) => sc.field === field);
									const isEnabled = !!existing;
									const weight = existing?.weight || "D";
									return (
										<div key={field} className="flex items-center gap-2">
											<button
												type="button"
												onClick={() => {
													if (isEnabled) {
														const next = (searchConfig || []).filter((sc) => sc.field !== field);
														setSearchConfig(next.length > 0 ? next : null);
													} else {
														setSearchConfig([...(searchConfig || []), { field, weight: "D" }]);
													}
												}}
												className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
													isEnabled
														? "bg-violet-500 border-violet-500 text-white"
														: "border-white/20 hover:border-white/40"
												}`}
											>
												{isEnabled && <Check className="h-3 w-3" />}
											</button>
											<span className="text-xs text-white/70 flex-1">{field}</span>
											{isEnabled && (
												<select
													value={weight}
													onChange={(e) => {
														setSearchConfig((prev) =>
															(prev || []).map((sc) =>
																sc.field === field ? { ...sc, weight: e.target.value } : sc,
															),
														);
													}}
													className="px-1.5 py-0.5 rounded border border-white/[0.1] bg-white/[0.06] text-white/80 text-[10px] focus:outline-none"
												>
													<option value="A">High (A)</option>
													<option value="B">Medium (B)</option>
													<option value="C">Normal (C)</option>
													<option value="D">Low (D)</option>
												</select>
											)}
										</div>
									);
								})}
							</div>
							<div className="flex items-center justify-end gap-2 pt-1">
								<button
									type="button"
									onClick={() => saveSearchConfig(searchConfig)}
									disabled={searchConfigSaving}
									className="px-3 py-1 rounded-md bg-violet-500/80 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
								>
									{searchConfigSaving && <Loader2 className="h-3 w-3 animate-spin" />}
									Save
								</button>
							</div>
						</>
					)}
				</div>
			)}

			{/* Loading state */}
			{loading && rows.length === 0 && (
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="h-6 w-6 animate-spin text-white/40" />
				</div>
			)}

			{/* Empty state */}
			{!loading && rows.length === 0 && currentEntity && (
				<div className="flex-1 flex flex-col items-center justify-center text-center py-12">
					<div className="h-12 w-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
						<svg className="h-6 w-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
						</svg>
					</div>
					<h3 className="text-sm font-medium text-white/90 mb-1">
						No data yet
					</h3>
					<p className="text-xs text-white/40 max-w-sm">
						Click &quot;Add Row&quot; to create your first entry, or import data from a CSV file.
					</p>
				</div>
			)}

			{/* Data Table */}
			{!loading && rows.length > 0 && currentEntity && (
				<div className="flex-1 min-h-0 overflow-auto px-1">
					<div className="overflow-x-auto rounded-xl border border-white/[0.08]">
						<table className="w-full text-sm">
							<thead>
								<tr className="bg-white/[0.03]">
									{allColumns.map((col) => (
										<th
											key={col}
											className="px-4 py-2.5 text-left text-xs font-medium text-white/40 uppercase tracking-wider cursor-pointer group select-none"
											onClick={() => handleSort(col)}
										>
											<span className="flex items-center gap-1">
												{col.replace(/_/g, " ")}
												<SortIcon field={col} />
											</span>
										</th>
									))}
									<th className="px-4 py-2.5 text-right text-xs font-medium text-white/40 uppercase tracking-wider">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/[0.04]">
								{rows.map((row) => (
									<tr
										key={String(row.id)}
										className="hover:bg-white/[0.03] transition-colors"
									>
										{allColumns.map((col) => {
											const isEditing =
												editingCell?.rowId ===
													(row.id as number) &&
												editingCell?.fieldName === col;
											const isEditable =
												!readonlyColumns.has(col);

											if (isEditing) {
												const field =
													currentEntity.fields.find(
														(f) => f.name === col,
													);
												const fieldType =
													field?.type || "string";

												if (fieldType === "boolean") {
													return (
														<td
															key={col}
															className="px-4 py-1"
														>
															<select
																ref={editInputRef as unknown as React.RefObject<HTMLSelectElement>}
																value={editValue}
																onChange={(e) =>
																	setEditValue(
																		e.target
																			.value,
																	)
																}
																onBlur={
																	saveInlineEdit
																}
																onKeyDown={
																	handleInlineKeyDown
																}
																className="w-full px-2 py-1 rounded border border-violet-500/50 bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
															>
																<option value="true">
																	Yes
																</option>
																<option value="false">
																	No
																</option>
															</select>
														</td>
													);
												}

												return (
													<td
														key={col}
														className="px-4 py-1"
													>
														<input
															ref={
																editInputRef as React.RefObject<HTMLInputElement>
															}
															type={
																fieldType ===
																	"number" ||
																fieldType ===
																	"integer" ||
																fieldType ===
																	"float"
																	? "number"
																	: fieldType ===
																			"date" ||
																		fieldType ===
																			"datetime"
																		? "date"
																		: "text"
															}
															value={editValue}
															onChange={(e) =>
																setEditValue(
																	e.target
																		.value,
																)
															}
															onBlur={
																saveInlineEdit
															}
															onKeyDown={
																handleInlineKeyDown
															}
															className="w-full px-2 py-1 rounded border border-violet-500/50 bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
														/>
														{savingCell && (
															<Loader2 className="h-3 w-3 animate-spin text-violet-400 absolute right-2 top-1/2 -translate-y-1/2" />
														)}
													</td>
												);
											}

											return (
												<td
													key={col}
													className={`px-4 py-2.5 text-zinc-300 max-w-[200px] truncate ${
														isEditable
															? "cursor-pointer hover:bg-white/[0.04] rounded"
															: ""
													}`}
													onClick={() => {
														if (isEditable) {
															startInlineEdit(
																row.id as number,
																col,
																row[col],
															);
														}
													}}
													title={
														isEditable
															? "Click to edit"
															: undefined
													}
												>
													{formatCellValue(row[col])}
												</td>
											);
										})}
										<td className="px-4 py-2.5 text-right space-x-2 whitespace-nowrap">
											<button
												type="button"
												onClick={() =>
													handleEditRow(row)
												}
												className="text-blue-400 hover:text-blue-300 text-xs"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() =>
													handleDelete(
														row.id as number,
													)
												}
												className="text-red-400 hover:text-red-300 text-xs"
											>
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="shrink-0 flex items-center justify-center gap-2 py-3">
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
						onClick={() =>
							setPage((p) => Math.min(totalPages, p + 1))
						}
						disabled={page >= totalPages}
						className="px-3 py-1 text-sm rounded bg-zinc-700 text-zinc-300 disabled:opacity-40 hover:bg-zinc-600"
					>
						Next
					</button>
				</div>
			)}

			{/* Modal: Entity Form (Add/Edit) */}
			{formOpen && currentEntity && (
				<EntityForm
					appId={appId}
					entity={currentEntity.tableName}
					fields={currentEntity.fields}
					editRow={editRow}
					onClose={handleFormClose}
					onSaved={handleFormSaved}
				/>
			)}

			{/* Modal: Import CSV Preview */}
			{importOpen && importData && currentEntity && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="bg-[#0a0a0f] border border-white/[0.08] rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
						{/* Header */}
						<div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
							<h2 className="text-lg font-semibold text-zinc-100">
								Import CSV to {currentEntity.name}
							</h2>
							<button
								type="button"
								onClick={closeImport}
								className="text-zinc-400 hover:text-zinc-200 text-xl leading-none"
							>
								&times;
							</button>
						</div>

						{/* Column mapping */}
						{!importProgress && (
							<div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
								<div>
									<h3 className="text-sm font-medium text-white/70 mb-2">
										Column Mapping
									</h3>
									<div className="space-y-2">
										{importData.headers.map((h) => (
											<div
												key={h}
												className="flex items-center gap-3"
											>
												<span className="text-xs text-white/50 w-32 truncate">
													{h}
												</span>
												<span className="text-white/30">
													&rarr;
												</span>
												<select
													value={
														importData.mapping[h] ||
														""
													}
													onChange={(e) => {
														setImportData(
															(prev) => {
																if (!prev)
																	return prev;
																const next = {
																	...prev,
																	mapping: {
																		...prev.mapping,
																	},
																};
																if (
																	e.target
																		.value
																) {
																	next.mapping[
																		h
																	] =
																		e.target.value;
																} else {
																	delete next
																		.mapping[
																		h
																	];
																}
																return next;
															},
														);
													}}
													className="flex-1 px-2 py-1.5 rounded border border-white/[0.1] bg-white/[0.06] text-white/90 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/30"
												>
													<option value="">
														Skip
													</option>
													{currentEntity.fields.map(
														(f) => (
															<option
																key={f.name}
																value={f.name}
															>
																{f.name} (
																{f.type})
															</option>
														),
													)}
												</select>
											</div>
										))}
									</div>
								</div>

								{/* Preview */}
								<div>
									<h3 className="text-sm font-medium text-white/70 mb-2">
										Preview (first 5 rows)
									</h3>
									<div className="overflow-x-auto rounded-lg border border-white/[0.06]">
										<table className="w-full text-xs">
											<thead>
												<tr className="bg-white/[0.03]">
													{importData.headers.map(
														(h) => (
															<th
																key={h}
																className="px-3 py-2 text-left text-white/40 font-medium"
															>
																{h}
															</th>
														),
													)}
												</tr>
											</thead>
											<tbody className="divide-y divide-white/[0.04]">
												{importData.rows
													.slice(0, 5)
													.map((csvRow, i) => (
														<tr
															key={`preview-${i}`}
														>
															{csvRow.map(
																(cell, j) => (
																	<td
																		key={`cell-${i}-${j}`}
																		className="px-3 py-1.5 text-white/60 max-w-[150px] truncate"
																	>
																		{cell ||
																			"\u2014"}
																	</td>
																),
															)}
														</tr>
													))}
											</tbody>
										</table>
									</div>
									<p className="text-[10px] text-white/30 mt-1">
										{importData.rows.length} row
										{importData.rows.length !== 1
											? "s"
											: ""}{" "}
										total
									</p>
								</div>

								{/* Actions */}
								<div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
									<button
										type="button"
										onClick={closeImport}
										className="px-4 py-2 text-sm text-zinc-300 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={handleImportExecute}
										disabled={
											Object.keys(importData.mapping)
												.length === 0
										}
										className="px-4 py-2 text-sm text-white bg-gradient-to-r from-violet-500/80 to-cyan-500/80 rounded-md hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
									>
										<Upload className="h-3.5 w-3.5" />
										Import {importData.rows.length} Row
										{importData.rows.length !== 1
											? "s"
											: ""}
									</button>
								</div>
							</div>
						)}

						{/* Progress */}
						{importProgress && (
							<div className="px-6 py-8 space-y-4">
								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span className="text-white/70">
											{importProgress.current ===
											importProgress.total
												? "Import complete"
												: "Importing..."}
										</span>
										<span className="text-white/50">
											{importProgress.current} /{" "}
											{importProgress.total}
										</span>
									</div>
									<div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
										<div
											className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all duration-300"
											style={{
												width: `${(importProgress.current / importProgress.total) * 100}%`,
											}}
										/>
									</div>
									{importProgress.errors > 0 && (
										<p className="text-xs text-red-400">
											{importProgress.errors} error
											{importProgress.errors !== 1
												? "s"
												: ""}
										</p>
									)}
								</div>

								{importProgress.current ===
									importProgress.total && (
									<div className="flex justify-end">
										<button
											type="button"
											onClick={closeImport}
											className="px-4 py-2 text-sm text-white bg-gradient-to-r from-violet-500/80 to-cyan-500/80 rounded-md hover:from-violet-500 hover:to-cyan-500 transition-colors"
										>
											Done
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
