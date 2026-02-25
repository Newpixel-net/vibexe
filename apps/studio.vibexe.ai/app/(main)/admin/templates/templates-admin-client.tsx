"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
	ArchiveIcon,
	CopyIcon,
	EditIcon,
	ExternalLinkIcon,
	FileIcon,
	PackageIcon,
	RefreshCwIcon,
	SearchIcon,
	StarIcon,
	Trash2Icon,
	DatabaseIcon,
	UsersIcon,
} from "lucide-react";
import type { CategoryGroup } from "@/app/(main)/app-builder/lib/template-constants";
import {
	getMainCategory,
	getCategoryDisplayLabel,
	normalizeCategory,
} from "@/app/(main)/app-builder/lib/template-constants";

interface AdminTemplate {
	dbId: number;
	id: string;
	name: string;
	description: string | null;
	category: string;
	tags: string[];
	visibility: string;
	featured: boolean;
	status: string;
	useCount: number;
	fileCount: number;
	entityCount: number;
	sourceAppDbId: number | null;
	sourceAppExists: boolean;
	sourceAppId: string | null;
	authorUserDbId: number | null;
	authorName: string | null;
	createdAt: Date;
	updatedAt: Date;
	thumbnailUrl: string | null;
}

interface TemplatesAdminClientProps {
	templates: AdminTemplate[];
	categories: string[];
	mainCategories: string[];
	categoryTree: Record<string, CategoryGroup>;
}

type EditModalData = {
	templateId: string;
	name: string;
	description: string;
	category: string;
	tags: string;
	visibility: string;
	featured: boolean;
	thumbnailUrl: string;
} | null;

export function TemplatesAdminClient({
	templates: initialTemplates,
	categories,
	mainCategories,
	categoryTree,
}: TemplatesAdminClientProps) {
	const router = useRouter();
	const [templates, setTemplates] = useState(initialTemplates);
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("");
	const [visibilityFilter, setVisibilityFilter] = useState("");
	const [loading, setLoading] = useState<string | null>(null);
	const [editModal, setEditModal] = useState<EditModalData>(null);

	const filtered = useMemo(() => {
		return templates.filter((t) => {
			if (search) {
				const q = search.toLowerCase();
				const nameMatch = t.name.toLowerCase().includes(q);
				const descMatch = t.description?.toLowerCase().includes(q);
				if (!nameMatch && !descMatch) return false;
			}
			if (categoryFilter) {
				// Support filtering by main category or full "Main > Sub" path
				const normalized = normalizeCategory(t.category);
				const tMain = getMainCategory(normalized);
				if (categoryFilter.includes(" > ")) {
					if (normalized !== categoryFilter) return false;
				} else {
					if (tMain !== categoryFilter) return false;
				}
			}
			if (visibilityFilter && t.visibility !== visibilityFilter) return false;
			return true;
		});
	}, [templates, search, categoryFilter, visibilityFilter]);

	const handleEditInBuilder = useCallback(
		async (t: AdminTemplate) => {
			if (t.sourceAppExists && t.sourceAppId) {
				router.push(`/app-builder/${t.sourceAppId}`);
			} else {
				setLoading(t.id);
				try {
					const res = await fetch(
						`/api/app-templates/${t.id}/rematerialize`,
						{ method: "POST" },
					);
					const data = await res.json();
					if (res.ok) {
						router.push(data.redirectPath);
					} else {
						alert(data.error || "Failed to re-materialize template");
					}
				} catch {
					alert("Network error");
				} finally {
					setLoading(null);
				}
			}
		},
		[router],
	);

	const handleRefresh = useCallback(async (t: AdminTemplate) => {
		if (!t.sourceAppExists || !t.sourceAppId) {
			alert("Source app no longer exists. Re-materialize first.");
			return;
		}
		setLoading(t.id);
		try {
			const res = await fetch(`/api/apps/${t.sourceAppId}/template`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refresh: true }),
			});
			const data = await res.json();
			if (res.ok && data.template) {
				setTemplates((prev) =>
					prev.map((x) =>
						x.id === t.id
							? {
									...x,
									fileCount: data.template.fileCount,
									entityCount: data.template.entityCount,
									updatedAt: new Date(),
								}
							: x,
					),
				);
			} else {
				alert(data.error || "Failed to refresh");
			}
		} catch {
			alert("Network error");
		} finally {
			setLoading(null);
		}
	}, []);

	const handleClone = useCallback(
		async (t: AdminTemplate) => {
			const name = prompt("Name for the cloned app:", `${t.name} (Copy)`);
			if (!name) return;
			setLoading(t.id);
			try {
				const res = await fetch(`/api/app-templates/${t.id}/clone`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name }),
				});
				const data = await res.json();
				if (res.ok) {
					router.push(data.redirectPath);
				} else {
					alert(data.error || "Failed to clone");
				}
			} catch {
				alert("Network error");
			} finally {
				setLoading(null);
			}
		},
		[router],
	);

	const handleArchive = useCallback(async (t: AdminTemplate) => {
		const newStatus = t.status === "archived" ? "active" : "archived";
		setLoading(t.id);
		try {
			const res = await fetch(`/api/app-templates/${t.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: newStatus }),
			});
			if (res.ok) {
				setTemplates((prev) =>
					prev.map((x) =>
						x.id === t.id ? { ...x, status: newStatus } : x,
					),
				);
			}
		} catch {
			alert("Network error");
		} finally {
			setLoading(null);
		}
	}, []);

	const handleDelete = useCallback(async (t: AdminTemplate) => {
		if (!confirm(`Delete template "${t.name}"? This cannot be undone.`))
			return;
		setLoading(t.id);
		try {
			const res = await fetch(`/api/app-templates/${t.id}`, {
				method: "DELETE",
			});
			if (res.ok) {
				setTemplates((prev) => prev.filter((x) => x.id !== t.id));
			} else {
				const data = await res.json();
				alert(data.error || "Failed to delete");
			}
		} catch {
			alert("Network error");
		} finally {
			setLoading(null);
		}
	}, []);

	const handleToggleFeatured = useCallback(async (t: AdminTemplate) => {
		setLoading(t.id);
		try {
			const res = await fetch(`/api/app-templates/${t.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ featured: !t.featured }),
			});
			if (res.ok) {
				setTemplates((prev) =>
					prev.map((x) =>
						x.id === t.id ? { ...x, featured: !x.featured } : x,
					),
				);
			}
		} catch {
			alert("Network error");
		} finally {
			setLoading(null);
		}
	}, []);

	const openEditModal = useCallback((t: AdminTemplate) => {
		setEditModal({
			templateId: t.id,
			name: t.name,
			description: t.description ?? "",
			category: t.category,
			tags: t.tags.join(", "),
			visibility: t.visibility,
			featured: t.featured,
			thumbnailUrl: t.thumbnailUrl ?? "",
		});
	}, []);

	const handleSaveMetadata = useCallback(async () => {
		if (!editModal) return;
		setLoading(editModal.templateId);
		try {
			const res = await fetch(`/api/app-templates/${editModal.templateId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: editModal.name,
					description: editModal.description || null,
					category: editModal.category,
					tags: editModal.tags
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean),
					visibility: editModal.visibility,
					featured: editModal.featured,
					thumbnailUrl: editModal.thumbnailUrl || null,
				}),
			});
			if (res.ok) {
				setTemplates((prev) =>
					prev.map((x) =>
						x.id === editModal.templateId
							? {
									...x,
									name: editModal.name,
									description: editModal.description || null,
									category: editModal.category,
									tags: editModal.tags
										.split(",")
										.map((s) => s.trim())
										.filter(Boolean),
									visibility: editModal.visibility,
									featured: editModal.featured,
									thumbnailUrl: editModal.thumbnailUrl || null,
									updatedAt: new Date(),
								}
							: x,
					),
				);
				setEditModal(null);
			} else {
				const data = await res.json();
				alert(data.error || "Failed to save");
			}
		} catch {
			alert("Network error");
		} finally {
			setLoading(null);
		}
	}, [editModal]);

	return (
		<div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
			{/* Header */}
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-white">Templates</h1>
				<p className="text-sm text-white/50 mt-1">
					Manage and improve your team's app templates
				</p>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-3 mb-6">
				<div className="relative flex-1 max-w-xs">
					<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
					<input
						type="text"
						placeholder="Search templates..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
					/>
				</div>
				<select
					value={categoryFilter}
					onChange={(e) => setCategoryFilter(e.target.value)}
					className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
				>
					<option value="">All Categories</option>
					{mainCategories.map((main) => (
						<optgroup key={main} label={main}>
							<option value={main}>All {main}</option>
							{(categoryTree[main]?.subcategories ?? []).map((sub) => (
								<option key={`${main}>${sub}`} value={`${main} > ${sub}`}>
									{sub}
								</option>
							))}
						</optgroup>
					))}
				</select>
				<select
					value={visibilityFilter}
					onChange={(e) => setVisibilityFilter(e.target.value)}
					className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
				>
					<option value="">All Visibility</option>
					<option value="public">Public</option>
					<option value="team">Team</option>
					<option value="private">Private</option>
				</select>
			</div>

			{/* Template List */}
			{filtered.length === 0 ? (
				<div className="text-center py-16 text-white/40">
					{templates.length === 0 ? (
						<>
							<PackageIcon className="size-12 mx-auto mb-4 opacity-40" />
							<p className="text-lg font-medium mb-2">No templates yet</p>
							<p className="text-sm">
								Publish your first app as a template from its Dashboard &gt;
								Settings &gt; App Template panel.
							</p>
						</>
					) : (
						<>
							<SearchIcon className="size-12 mx-auto mb-4 opacity-40" />
							<p>No templates match your filters</p>
						</>
					)}
				</div>
			) : (
				<div className="space-y-4">
					{filtered.map((t) => (
						<TemplateCard
							key={t.id}
							template={t}
							isLoading={loading === t.id}
							onEditInBuilder={() => handleEditInBuilder(t)}
							onEditMetadata={() => openEditModal(t)}
							onRefresh={() => handleRefresh(t)}
							onClone={() => handleClone(t)}
							onArchive={() => handleArchive(t)}
							onDelete={() => handleDelete(t)}
							onToggleFeatured={() => handleToggleFeatured(t)}
						/>
					))}
				</div>
			)}

			{/* Edit Metadata Modal */}
			{editModal && (
				<EditMetadataModal
					data={editModal}
					categories={categories}
					mainCategories={mainCategories}
					categoryTree={categoryTree}
					onChange={setEditModal}
					onSave={handleSaveMetadata}
					onClose={() => setEditModal(null)}
					isLoading={loading === editModal.templateId}
				/>
			)}
		</div>
	);
}

// ============================================================================
// Template Card
// ============================================================================

function TemplateCard({
	template: t,
	isLoading,
	onEditInBuilder,
	onEditMetadata,
	onRefresh,
	onClone,
	onArchive,
	onDelete,
	onToggleFeatured,
}: {
	template: AdminTemplate;
	isLoading: boolean;
	onEditInBuilder: () => void;
	onEditMetadata: () => void;
	onRefresh: () => void;
	onClone: () => void;
	onArchive: () => void;
	onDelete: () => void;
	onToggleFeatured: () => void;
}) {
	const updatedStr = new Date(t.updatedAt).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

	return (
		<div
			className={`bg-white/[0.03] border border-white/10 rounded-xl p-5 transition-colors hover:border-white/20 ${
				t.status === "archived" ? "opacity-60" : ""
			}`}
		>
			{/* Top row: name + badges */}
			<div className="flex items-start justify-between gap-4 mb-2">
				<div className="flex items-center gap-2 min-w-0">
					<h3 className="text-base font-semibold text-white truncate">
						{t.name}
					</h3>
					{t.featured && (
						<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium whitespace-nowrap">
							<StarIcon className="size-3" />
							Featured
						</span>
					)}
					{t.status === "archived" && (
						<span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-xs font-medium">
							Archived
						</span>
					)}
				</div>
				<div className="flex items-center gap-1.5 shrink-0">
					<span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs capitalize">
						{t.visibility}
					</span>
					<span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs">
						{getCategoryDisplayLabel(t.category)}
					</span>
				</div>
			</div>

			{/* Description */}
			{t.description && (
				<p className="text-sm text-white/50 mb-3 line-clamp-2">
					{t.description}
				</p>
			)}

			{/* Stats row */}
			<div className="flex items-center gap-4 text-xs text-white/40 mb-4">
				<span className="inline-flex items-center gap-1">
					<FileIcon className="size-3" />
					{t.fileCount} files
				</span>
				{t.entityCount > 0 && (
					<span className="inline-flex items-center gap-1">
						<DatabaseIcon className="size-3" />
						{t.entityCount} entities
					</span>
				)}
				<span className="inline-flex items-center gap-1">
					<UsersIcon className="size-3" />
					{t.useCount} clones
				</span>
				{t.authorName && <span>By: {t.authorName}</span>}
				<span>Updated {updatedStr}</span>
			</div>

			{/* Actions */}
			<div className="flex items-center gap-2 flex-wrap">
				<ActionButton
					icon={<ExternalLinkIcon className="size-3.5" />}
					label={
						t.sourceAppExists
							? "Edit in Builder"
							: "Re-materialize & Edit"
					}
					onClick={onEditInBuilder}
					disabled={isLoading}
				/>
				<ActionButton
					icon={<EditIcon className="size-3.5" />}
					label="Edit Metadata"
					onClick={onEditMetadata}
					disabled={isLoading}
				/>
				<ActionButton
					icon={<RefreshCwIcon className="size-3.5" />}
					label="Refresh Snapshot"
					onClick={onRefresh}
					disabled={isLoading || !t.sourceAppExists}
				/>
				<ActionButton
					icon={<CopyIcon className="size-3.5" />}
					label="Clone"
					onClick={onClone}
					disabled={isLoading}
				/>
				<ActionButton
					icon={
						<StarIcon
							className={`size-3.5 ${t.featured ? "fill-amber-400 text-amber-400" : ""}`}
						/>
					}
					label={t.featured ? "Unfeature" : "Feature"}
					onClick={onToggleFeatured}
					disabled={isLoading}
				/>
				<ActionButton
					icon={<ArchiveIcon className="size-3.5" />}
					label={t.status === "archived" ? "Unarchive" : "Archive"}
					onClick={onArchive}
					disabled={isLoading}
				/>
				<ActionButton
					icon={<Trash2Icon className="size-3.5" />}
					label="Delete"
					onClick={onDelete}
					disabled={isLoading}
					variant="danger"
				/>
			</div>
		</div>
	);
}

// ============================================================================
// Action Button
// ============================================================================

function ActionButton({
	icon,
	label,
	onClick,
	disabled,
	variant = "default",
}: {
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
	disabled?: boolean;
	variant?: "default" | "danger";
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
				variant === "danger"
					? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
					: "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
			}`}
		>
			{icon}
			{label}
		</button>
	);
}

// ============================================================================
// Edit Metadata Modal
// ============================================================================

function EditMetadataModal({
	data,
	categories,
	mainCategories,
	categoryTree,
	onChange,
	onSave,
	onClose,
	isLoading,
}: {
	data: NonNullable<EditModalData>;
	categories: string[];
	mainCategories: string[];
	categoryTree: Record<string, CategoryGroup>;
	onChange: (data: NonNullable<EditModalData>) => void;
	onSave: () => void;
	onClose: () => void;
	isLoading: boolean;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="bg-[#1a1a2e] border border-white/10 rounded-xl w-full max-w-lg mx-4 p-6 shadow-2xl">
				<h2 className="text-lg font-semibold text-white mb-4">
					Edit Template Metadata
				</h2>

				<div className="space-y-4">
					{/* Name */}
					<div>
						<label className="block text-xs text-white/50 mb-1">Name</label>
						<input
							type="text"
							value={data.name}
							onChange={(e) => onChange({ ...data, name: e.target.value })}
							className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
						/>
					</div>

					{/* Description */}
					<div>
						<label className="block text-xs text-white/50 mb-1">
							Description
						</label>
						<textarea
							value={data.description}
							onChange={(e) =>
								onChange({ ...data, description: e.target.value })
							}
							rows={3}
							className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 resize-none"
						/>
					</div>

					{/* Category */}
					<div>
						<label className="block text-xs text-white/50 mb-1">
							Category
						</label>
						<select
							value={data.category}
							onChange={(e) => onChange({ ...data, category: e.target.value })}
							className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
						>
							{mainCategories.map((main) => (
								<optgroup key={main} label={main}>
									{(categoryTree[main]?.subcategories ?? []).map((sub) => (
										<option
											key={`${main}>${sub}`}
											value={`${main} > ${sub}`}
										>
											{sub}
										</option>
									))}
								</optgroup>
							))}
						</select>
					</div>

					{/* Tags */}
					<div>
						<label className="block text-xs text-white/50 mb-1">
							Tags (comma-separated)
						</label>
						<input
							type="text"
							value={data.tags}
							onChange={(e) => onChange({ ...data, tags: e.target.value })}
							placeholder="kanban, project-management, team"
							className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
						/>
					</div>

					{/* Visibility */}
					<div>
						<label className="block text-xs text-white/50 mb-2">
							Visibility
						</label>
						<div className="flex items-center gap-4">
							{(["public", "team", "private"] as const).map((v) => (
								<label
									key={v}
									className="inline-flex items-center gap-1.5 text-sm text-white/70 cursor-pointer"
								>
									<input
										type="radio"
										name="visibility"
										value={v}
										checked={data.visibility === v}
										onChange={() => onChange({ ...data, visibility: v })}
										className="accent-blue-500"
									/>
									<span className="capitalize">{v}</span>
								</label>
							))}
						</div>
					</div>

					{/* Featured */}
					<div>
						<label className="inline-flex items-center gap-2 text-sm text-white/70 cursor-pointer">
							<input
								type="checkbox"
								checked={data.featured}
								onChange={(e) =>
									onChange({ ...data, featured: e.target.checked })
								}
								className="accent-amber-500 rounded"
							/>
							Featured template (appears first in gallery)
						</label>
					</div>

					{/* Thumbnail URL */}
					<div>
						<label className="block text-xs text-white/50 mb-1">
							Thumbnail URL (optional)
						</label>
						<input
							type="text"
							value={data.thumbnailUrl}
							onChange={(e) =>
								onChange({ ...data, thumbnailUrl: e.target.value })
							}
							placeholder="https://..."
							className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
						/>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center justify-end gap-3 mt-6">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onSave}
						disabled={isLoading || !data.name.trim()}
						className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{isLoading ? "Saving..." : "Save Changes"}
					</button>
				</div>
			</div>
		</div>
	);
}
