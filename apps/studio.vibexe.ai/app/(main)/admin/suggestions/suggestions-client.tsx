"use client";

import {
	Loader2Icon,
	PlusIcon,
	SearchIcon,
	Trash2Icon,
	PencilIcon,
	XIcon,
	Sparkles,
	Wrench,
	Compass,
	Rocket,
	Globe,
	LayoutGrid,
	Shield,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface SuggestionTemplate {
	dbId: number;
	label: string;
	prompt: string;
	icon: string;
	category: string;
	conditions: Record<string, unknown>;
	priority: number;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

const ICON_OPTIONS = [
	{ value: "sparkles", label: "Sparkles" },
	{ value: "wrench", label: "Wrench" },
	{ value: "compass", label: "Compass" },
	{ value: "rocket", label: "Rocket" },
	{ value: "globe", label: "Globe" },
	{ value: "layout", label: "Layout" },
	{ value: "shield", label: "Shield" },
	{ value: "zap", label: "Zap" },
];

const CATEGORY_OPTIONS = [
	"general",
	"backend",
	"frontend",
	"seo",
	"design",
	"performance",
	"security",
	"content",
];

function IconDisplay({ icon }: { icon: string }) {
	const cls = "size-4";
	switch (icon) {
		case "wrench": return <Wrench className={cls} />;
		case "compass": return <Compass className={cls} />;
		case "rocket": return <Rocket className={cls} />;
		case "globe": return <Globe className={cls} />;
		case "layout": return <LayoutGrid className={cls} />;
		case "shield": return <Shield className={cls} />;
		case "zap": return <Zap className={cls} />;
		default: return <Sparkles className={cls} />;
	}
}

export function SuggestionsClient() {
	const [templates, setTemplates] = useState<SuggestionTemplate[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);

	// Form state
	const [formLabel, setFormLabel] = useState("");
	const [formPrompt, setFormPrompt] = useState("");
	const [formIcon, setFormIcon] = useState("sparkles");
	const [formCategory, setFormCategory] = useState("general");
	const [formPriority, setFormPriority] = useState(50);
	const [formConditions, setFormConditions] = useState("{}");
	const [formEnabled, setFormEnabled] = useState(true);
	const [saving, setSaving] = useState(false);

	const fetchTemplates = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/admin/suggestions");
			if (res.ok) {
				const data = await res.json();
				setTemplates(data.templates || []);
			}
		} catch (e) {
			console.error("Failed to fetch suggestions:", e);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchTemplates();
	}, [fetchTemplates]);

	const resetForm = () => {
		setFormLabel("");
		setFormPrompt("");
		setFormIcon("sparkles");
		setFormCategory("general");
		setFormPriority(50);
		setFormConditions("{}");
		setFormEnabled(true);
		setEditingId(null);
	};

	const openCreateForm = () => {
		resetForm();
		setShowForm(true);
	};

	const openEditForm = (t: SuggestionTemplate) => {
		setFormLabel(t.label);
		setFormPrompt(t.prompt);
		setFormIcon(t.icon || "sparkles");
		setFormCategory(t.category || "general");
		setFormPriority(t.priority ?? 50);
		setFormConditions(JSON.stringify(t.conditions || {}, null, 2));
		setFormEnabled(t.enabled);
		setEditingId(t.dbId);
		setShowForm(true);
	};

	const handleSave = async () => {
		if (!formLabel.trim() || !formPrompt.trim()) return;

		let conditions: Record<string, unknown> = {};
		try {
			conditions = JSON.parse(formConditions);
		} catch {
			alert("Invalid JSON in conditions field");
			return;
		}

		setSaving(true);
		try {
			const body = {
				...(editingId ? { dbId: editingId } : {}),
				label: formLabel.trim(),
				prompt: formPrompt.trim(),
				icon: formIcon,
				category: formCategory,
				conditions,
				priority: formPriority,
				enabled: formEnabled,
			};

			const res = await fetch("/api/admin/suggestions", {
				method: editingId ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (res.ok) {
				setShowForm(false);
				resetForm();
				fetchTemplates();
			}
		} catch (e) {
			console.error("Save error:", e);
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (dbId: number) => {
		if (!confirm("Delete this suggestion template?")) return;
		try {
			const res = await fetch(`/api/admin/suggestions?id=${dbId}`, { method: "DELETE" });
			if (res.ok) fetchTemplates();
		} catch (e) {
			console.error("Delete error:", e);
		}
	};

	const handleToggleEnabled = async (t: SuggestionTemplate) => {
		try {
			await fetch("/api/admin/suggestions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ dbId: t.dbId, enabled: !t.enabled }),
			});
			fetchTemplates();
		} catch (e) {
			console.error("Toggle error:", e);
		}
	};

	const filtered = templates.filter(
		(t) =>
			t.label.toLowerCase().includes(search.toLowerCase()) ||
			t.category.toLowerCase().includes(search.toLowerCase()),
	);

	return (
		<div className="flex flex-col gap-4">
			{/* Search + Add */}
			<div className="flex items-center gap-3">
				<div className="flex-1 relative">
					<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/30" />
					<input
						type="text"
						placeholder="Search templates..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full pl-10 pr-4 py-2 rounded-lg bg-black-850 border border-black-400 text-[13px] text-white-900 placeholder:text-white/30 focus:outline-none focus:border-white/30"
					/>
				</div>
				<button
					type="button"
					onClick={openCreateForm}
					className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-medium transition-colors"
				>
					<PlusIcon className="size-4" />
					Add Suggestion
				</button>
			</div>

			{/* Form dialog */}
			{showForm && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
					<div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-medium text-white">
								{editingId ? "Edit" : "Add"} Suggestion Template
							</h3>
							<button type="button" onClick={() => { setShowForm(false); resetForm(); }}>
								<XIcon className="size-5 text-white/40 hover:text-white/70" />
							</button>
						</div>

						<div className="flex flex-col gap-3">
							<div>
								<label className="text-xs text-white/50 mb-1 block">Label</label>
								<input
									type="text"
									value={formLabel}
									onChange={(e) => setFormLabel(e.target.value)}
									placeholder="Creating a professional backend"
									className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
								/>
							</div>

							<div>
								<label className="text-xs text-white/50 mb-1 block">Prompt</label>
								<textarea
									value={formPrompt}
									onChange={(e) => setFormPrompt(e.target.value)}
									placeholder="Read the existing files and create a professional backend..."
									rows={4}
									className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-y"
								/>
							</div>

							<div className="grid grid-cols-3 gap-3">
								<div>
									<label className="text-xs text-white/50 mb-1 block">Icon</label>
									<select
										value={formIcon}
										onChange={(e) => setFormIcon(e.target.value)}
										className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
									>
										{ICON_OPTIONS.map((o) => (
											<option key={o.value} value={o.value}>{o.label}</option>
										))}
									</select>
								</div>
								<div>
									<label className="text-xs text-white/50 mb-1 block">Category</label>
									<select
										value={formCategory}
										onChange={(e) => setFormCategory(e.target.value)}
										className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
									>
										{CATEGORY_OPTIONS.map((c) => (
											<option key={c} value={c}>{c}</option>
										))}
									</select>
								</div>
								<div>
									<label className="text-xs text-white/50 mb-1 block">Priority (0-100)</label>
									<input
										type="number"
										min={0}
										max={100}
										value={formPriority}
										onChange={(e) => setFormPriority(Number(e.target.value))}
										className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
									/>
								</div>
							</div>

							<div>
								<label className="text-xs text-white/50 mb-1 block">Conditions (JSON)</label>
								<textarea
									value={formConditions}
									onChange={(e) => setFormConditions(e.target.value)}
									rows={3}
									className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-y"
								/>
								<p className="text-[10px] text-white/30 mt-1">
									Keys: minFiles, maxFiles, hasBlueprint, hasEntities, minComponents, hasTodos, filePatterns, missingPatterns, keywords
								</p>
							</div>

							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="form-enabled"
									checked={formEnabled}
									onChange={(e) => setFormEnabled(e.target.checked)}
									className="rounded"
								/>
								<label htmlFor="form-enabled" className="text-sm text-white/70">Enabled</label>
							</div>

							<div className="flex justify-end gap-2 mt-2">
								<button
									type="button"
									onClick={() => { setShowForm(false); resetForm(); }}
									className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={handleSave}
									disabled={saving || !formLabel.trim() || !formPrompt.trim()}
									className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center gap-2"
								>
									{saving && <Loader2Icon className="size-4 animate-spin" />}
									{editingId ? "Update" : "Create"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Table */}
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2Icon className="size-6 animate-spin text-white/30" />
				</div>
			) : filtered.length === 0 ? (
				<div className="text-center py-12 text-white/30 text-sm">
					{search ? "No templates match your search" : "No suggestion templates yet. Click \"Add Suggestion\" to create one."}
				</div>
			) : (
				<div className="border border-black-400 rounded-lg overflow-hidden">
					<table className="w-full text-[13px]">
						<thead>
							<tr className="bg-black-850 text-white/50 text-left">
								<th className="px-4 py-2.5 font-medium">Label</th>
								<th className="px-4 py-2.5 font-medium w-20">Icon</th>
								<th className="px-4 py-2.5 font-medium w-24">Category</th>
								<th className="px-4 py-2.5 font-medium w-20 text-center">Priority</th>
								<th className="px-4 py-2.5 font-medium w-24 text-center">Enabled</th>
								<th className="px-4 py-2.5 font-medium w-32 text-center">Actions</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((t) => (
								<tr key={t.dbId} className="border-t border-black-400 hover:bg-white/[0.02]">
									<td className="px-4 py-2.5 text-white-900">
										<div>{t.label}</div>
										{Object.keys(t.conditions || {}).length > 0 && (
											<div className="text-[10px] text-white/30 mt-0.5">
												{Object.entries(t.conditions || {}).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}
											</div>
										)}
									</td>
									<td className="px-4 py-2.5 text-white/50">
										<IconDisplay icon={t.icon} />
									</td>
									<td className="px-4 py-2.5 text-white/50">{t.category}</td>
									<td className="px-4 py-2.5 text-center text-white/50">{t.priority}</td>
									<td className="px-4 py-2.5 text-center">
										<button
											type="button"
											onClick={() => handleToggleEnabled(t)}
											className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
												t.enabled
													? "bg-emerald-500/20 text-emerald-400"
													: "bg-red-500/20 text-red-400"
											}`}
										>
											{t.enabled ? "On" : "Off"}
										</button>
									</td>
									<td className="px-4 py-2.5 text-center">
										<div className="flex items-center justify-center gap-1">
											<button
												type="button"
												onClick={() => openEditForm(t)}
												className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
												title="Edit"
											>
												<PencilIcon className="size-3.5" />
											</button>
											<button
												type="button"
												onClick={() => handleDelete(t.dbId)}
												className="p-1.5 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
												title="Delete"
											>
												<Trash2Icon className="size-3.5" />
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<div className="text-xs text-white/20 text-right">
				{templates.length} template{templates.length !== 1 ? "s" : ""} total
			</div>
		</div>
	);
}
