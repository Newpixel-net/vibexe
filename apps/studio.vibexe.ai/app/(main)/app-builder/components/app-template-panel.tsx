"use client";

/**
 * AppTemplatePanel Component
 *
 * Allows users to publish their app as a reusable template,
 * update metadata, refresh snapshots, and unpublish.
 */

import {
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@vibexe-internal/ui/dialog";
import {
	FileCode2,
	Loader2,
	RefreshCw,
	Rocket,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { TEMPLATE_CATEGORIES } from "../lib/template-constants";

interface AppTemplatePanelProps {
	appId: string;
}

interface TemplateData {
	id: string;
	name: string;
	description: string | null;
	category: string;
	tags: string[];
	visibility: string;
	useCount: number;
	fileCount: number;
	entityCount: number;
	createdAt: string;
	updatedAt: string;
}

type PanelState = "loading" | "not-published" | "published";

export function AppTemplatePanel({ appId }: AppTemplatePanelProps) {
	const [state, setState] = useState<PanelState>("loading");
	const [template, setTemplate] = useState<TemplateData | null>(null);
	const [saving, setSaving] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [confirmUnpublish, setConfirmUnpublish] = useState(false);
	const [autoFilling, setAutoFilling] = useState(false);

	// Form fields (used for both publish and edit)
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [category, setCategory] = useState("Other");
	const [tagsInput, setTagsInput] = useState("");
	const [visibility, setVisibility] = useState("public");

	const fetchTemplate = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/template`);
			const data = await res.json();
			if (data.published && data.template) {
				const t = data.template;
				setTemplate(t);
				setName(t.name);
				setDescription(t.description ?? "");
				setCategory(t.category);
				setTagsInput((t.tags ?? []).join(", "));
				setVisibility(t.visibility);
				setState("published");
			} else {
				setState("not-published");
			}
		} catch {
			setState("not-published");
		}
	}, [appId]);

	useEffect(() => {
		fetchTemplate();
	}, [fetchTemplate]);

	const handleAutoFill = useCallback(async () => {
		setAutoFilling(true);
		try {
			const res = await fetch(`/api/apps/${appId}/template/auto-fill`, {
				method: "POST",
			});
			const data = await res.json();
			if (data.success) {
				setName(data.name ?? "");
				setDescription(data.description ?? "");
				setCategory(data.category ?? "Other");
				setTagsInput((data.tags ?? []).join(", "));
			}
		} catch {
			// Silently fail — user can fill manually
		} finally {
			setAutoFilling(false);
		}
	}, [appId]);

	const handlePublish = useCallback(async () => {
		if (!name.trim()) return;
		setSaving(true);
		try {
			const res = await fetch(`/api/apps/${appId}/template`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || null,
					category,
					tags: tagsInput
						.split(",")
						.map((t) => t.trim())
						.filter(Boolean),
					visibility,
				}),
			});
			if (res.ok) {
				await fetchTemplate();
			}
		} finally {
			setSaving(false);
		}
	}, [appId, name, description, category, tagsInput, visibility, fetchTemplate]);

	const handleUpdateMetadata = useCallback(async () => {
		if (!name.trim() || !template) return;
		setSaving(true);
		try {
			const res = await fetch(`/api/apps/${appId}/template`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || null,
					category,
					tags: tagsInput
						.split(",")
						.map((t) => t.trim())
						.filter(Boolean),
					visibility,
				}),
			});
			if (res.ok) {
				await fetchTemplate();
			}
		} finally {
			setSaving(false);
		}
	}, [appId, name, description, category, tagsInput, visibility, template, fetchTemplate]);

	const handleRefreshSnapshot = useCallback(async () => {
		setRefreshing(true);
		try {
			const res = await fetch(`/api/apps/${appId}/template`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refresh: true }),
			});
			if (res.ok) {
				await fetchTemplate();
			}
		} finally {
			setRefreshing(false);
		}
	}, [appId, fetchTemplate]);

	const handleUnpublish = useCallback(async () => {
		setSaving(true);
		try {
			const res = await fetch(`/api/apps/${appId}/template`, {
				method: "DELETE",
			});
			if (res.ok) {
				setTemplate(null);
				setName("");
				setDescription("");
				setCategory("Other");
				setTagsInput("");
				setVisibility("public");
				setState("not-published");
				setConfirmUnpublish(false);
			}
		} finally {
			setSaving(false);
		}
	}, [appId]);

	// Loading state
	if (state === "loading") {
		return (
			<div className="flex-1 overflow-y-auto p-6">
				<div className="max-w-3xl mx-auto space-y-6">
					<div>
						<div className="h-7 w-40 bg-white/[0.06] rounded animate-pulse" />
						<div className="h-4 w-72 bg-white/[0.04] rounded animate-pulse mt-2" />
					</div>
					<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8">
						<div className="space-y-4">
							<div className="h-10 bg-white/[0.06] rounded animate-pulse" />
							<div className="h-24 bg-white/[0.06] rounded animate-pulse" />
							<div className="h-10 bg-white/[0.06] rounded animate-pulse" />
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-white/90">App Template</h1>
					<p className="text-sm text-white/40 mt-1">
						{state === "published"
							? "Manage your published template."
							: "Turn your app into a reusable template that others can clone."}
					</p>
				</div>

				{state === "not-published" ? (
					/* ---- PUBLISH FORM ---- */
					<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 space-y-5">
						<div className="flex items-center justify-between mb-2">
							<div className="flex items-center gap-3">
								<div className="h-10 w-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
									<Rocket className="h-5 w-5 text-white/40" />
								</div>
								<div>
									<h2 className="text-lg font-semibold text-white/90">
										Publish as Template
									</h2>
									<p className="text-xs text-white/40">
										Your app's files and schema will be snapshotted.
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={handleAutoFill}
								disabled={autoFilling}
								className="px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300/90 text-xs font-medium hover:from-amber-500/30 hover:to-orange-500/30 transition-all disabled:opacity-50 flex items-center gap-1.5"
								title="Uses xAI Grok 4.1 Fast to analyze your app and suggest template details"
							>
								{autoFilling ? (
									<>
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										Analyzing...
									</>
								) : (
									<>
										<Sparkles className="h-3.5 w-3.5" />
										Auto-Fill with AI
									</>
								)}
							</button>
						</div>

						{/* AI model notice */}
						<p className="text-[10px] text-white/20 -mt-3 text-right">
							Powered by xAI Grok 4.1 Fast
						</p>

						{/* Name */}
						<div>
							<label className="block text-sm font-medium text-white/60 mb-1.5">
								Template Name
							</label>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g., Project Management Dashboard"
								className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20"
							/>
						</div>

						{/* Description */}
						<div>
							<label className="block text-sm font-medium text-white/60 mb-1.5">
								Description
							</label>
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Describe what this template includes..."
								rows={3}
								className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-none"
							/>
						</div>

						{/* Category */}
						<div>
							<label className="block text-sm font-medium text-white/60 mb-1.5">
								Category
							</label>
							<select
								value={category}
								onChange={(e) => setCategory(e.target.value)}
								className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm focus:outline-none focus:border-white/20"
							>
								{TEMPLATE_CATEGORIES.map((cat) => (
									<option key={cat} value={cat} className="bg-[#1a1a2e]">
										{cat}
									</option>
								))}
							</select>
						</div>

						{/* Tags */}
						<div>
							<label className="block text-sm font-medium text-white/60 mb-1.5">
								Tags
							</label>
							<input
								type="text"
								value={tagsInput}
								onChange={(e) => setTagsInput(e.target.value)}
								placeholder="kanban, task, team (comma-separated)"
								className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20"
							/>
						</div>

						{/* Visibility */}
						<div>
							<label className="block text-sm font-medium text-white/60 mb-1.5">
								Visibility
							</label>
							<div className="flex gap-4">
								{(
									[
										["public", "Public", "Anyone can see and clone"],
										["team", "Team Only", "Only your team members"],
										["private", "Private", "Only you can see"],
									] as const
								).map(([value, label, desc]) => (
									<label
										key={value}
										className="flex items-start gap-2 cursor-pointer"
									>
										<input
											type="radio"
											name="visibility"
											value={value}
											checked={visibility === value}
											onChange={(e) => setVisibility(e.target.value)}
											className="mt-0.5 accent-violet-500"
										/>
										<div>
											<span className="text-sm text-white/80">{label}</span>
											<p className="text-xs text-white/30">{desc}</p>
										</div>
									</label>
								))}
							</div>
						</div>

						{/* Publish Button */}
						<button
							type="button"
							onClick={handlePublish}
							disabled={saving || !name.trim()}
							className="w-full mt-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white text-sm font-medium hover:from-violet-500 hover:to-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
						>
							{saving ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Publishing...
								</>
							) : (
								<>
									<Rocket className="h-4 w-4" />
									Publish Template
								</>
							)}
						</button>
					</div>
				) : (
					/* ---- PUBLISHED STATE ---- */
					<>
						{/* Stats Bar */}
						{template && (
							<div className="grid grid-cols-3 gap-4">
								{[
									{
										label: "Files",
										value: template.fileCount,
									},
									{
										label: "Entities",
										value: template.entityCount,
									},
									{
										label: "Clones",
										value: template.useCount,
									},
								].map((stat) => (
									<div
										key={stat.label}
										className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 text-center"
									>
										<div className="text-2xl font-bold text-white/90">
											{stat.value}
										</div>
										<div className="text-xs text-white/40 mt-1">
											{stat.label}
										</div>
									</div>
								))}
							</div>
						)}

						{/* Edit Form */}
						<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 space-y-5">
							<div className="flex items-center justify-between mb-2">
								<h2 className="text-lg font-semibold text-white/90">
									Template Settings
								</h2>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={handleAutoFill}
										disabled={autoFilling}
										className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300/90 text-[11px] font-medium hover:from-amber-500/30 hover:to-orange-500/30 transition-all disabled:opacity-50 flex items-center gap-1.5"
										title="Uses xAI Grok 4.1 Fast to analyze your app and suggest template details"
									>
										{autoFilling ? (
											<Loader2 className="h-3 w-3 animate-spin" />
										) : (
											<Sparkles className="h-3 w-3" />
										)}
										AI Fill
									</button>
									<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
										<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
										Published
									</span>
								</div>
							</div>

							{/* Name */}
							<div>
								<label className="block text-sm font-medium text-white/60 mb-1.5">
									Template Name
								</label>
								<input
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm focus:outline-none focus:border-white/20"
								/>
							</div>

							{/* Description */}
							<div>
								<label className="block text-sm font-medium text-white/60 mb-1.5">
									Description
								</label>
								<textarea
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									rows={3}
									className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm focus:outline-none focus:border-white/20 resize-none"
								/>
							</div>

							{/* Category */}
							<div>
								<label className="block text-sm font-medium text-white/60 mb-1.5">
									Category
								</label>
								<select
									value={category}
									onChange={(e) => setCategory(e.target.value)}
									className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm focus:outline-none focus:border-white/20"
								>
									{TEMPLATE_CATEGORIES.map((cat) => (
										<option key={cat} value={cat} className="bg-[#1a1a2e]">
											{cat}
										</option>
									))}
								</select>
							</div>

							{/* Tags */}
							<div>
								<label className="block text-sm font-medium text-white/60 mb-1.5">
									Tags
								</label>
								<input
									type="text"
									value={tagsInput}
									onChange={(e) => setTagsInput(e.target.value)}
									className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm focus:outline-none focus:border-white/20"
								/>
							</div>

							{/* Visibility */}
							<div>
								<label className="block text-sm font-medium text-white/60 mb-1.5">
									Visibility
								</label>
								<div className="flex gap-4">
									{(
										[
											["public", "Public", "Anyone can see and clone"],
											["team", "Team Only", "Only your team members"],
											["private", "Private", "Only you can see"],
										] as const
									).map(([value, label, desc]) => (
										<label
											key={value}
											className="flex items-start gap-2 cursor-pointer"
										>
											<input
												type="radio"
												name="visibility"
												value={value}
												checked={visibility === value}
												onChange={(e) => setVisibility(e.target.value)}
												className="mt-0.5 accent-violet-500"
											/>
											<div>
												<span className="text-sm text-white/80">{label}</span>
												<p className="text-xs text-white/30">{desc}</p>
											</div>
										</label>
									))}
								</div>
							</div>

							{/* Actions */}
							<div className="flex gap-3 pt-2">
								<button
									type="button"
									onClick={handleUpdateMetadata}
									disabled={saving || !name.trim()}
									className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.08] border border-white/[0.08] text-white/80 text-sm font-medium hover:bg-white/[0.12] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
								>
									{saving ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<FileCode2 className="h-4 w-4" />
									)}
									Update Metadata
								</button>

								<button
									type="button"
									onClick={handleRefreshSnapshot}
									disabled={refreshing}
									className="px-4 py-2.5 rounded-lg bg-white/[0.08] border border-white/[0.08] text-white/80 text-sm font-medium hover:bg-white/[0.12] transition-colors disabled:opacity-50 flex items-center gap-2"
								>
									<RefreshCw
										className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
									/>
									Update Snapshot
								</button>

								<button
									type="button"
									onClick={() => setConfirmUnpublish(true)}
									className="px-4 py-2.5 rounded-lg border border-red-500/20 text-red-400/80 text-sm font-medium hover:bg-red-500/10 transition-colors flex items-center gap-2"
								>
									<Trash2 className="h-4 w-4" />
									Unpublish
								</button>
							</div>
						</div>

						{/* Unpublish Confirmation Dialog */}
						<Dialog open={confirmUnpublish} onOpenChange={setConfirmUnpublish}>
							<DialogContent variant="destructive">
								<DialogHeader>
									<div className="flex items-center justify-between">
										<DialogTitle className="font-sans text-[20px] font-medium tracking-tight text-error-900">
											Unpublish Template
										</DialogTitle>
										<DialogClose className="rounded-sm text-inverse opacity-70 hover:opacity-100 focus:outline-none">
											<X className="h-5 w-5" />
											<span className="sr-only">Close</span>
										</DialogClose>
									</div>
									<DialogDescription className="font-geist mt-2 text-[14px] text-error-900/50">
										This will remove the template from the gallery. Existing
										clones will not be affected.
									</DialogDescription>
								</DialogHeader>
								<DialogBody />
								<DialogFooter>
									<div className="mt-6 flex justify-end gap-x-3">
										<button
											type="button"
											onClick={() => setConfirmUnpublish(false)}
											className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white/80 transition-colors"
										>
											Cancel
										</button>
										<button
											type="button"
											onClick={handleUnpublish}
											disabled={saving}
											className="px-4 py-2 rounded-lg bg-red-500/80 text-white text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
										>
											{saving ? "Unpublishing..." : "Unpublish"}
										</button>
									</div>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</>
				)}
			</div>
		</div>
	);
}
