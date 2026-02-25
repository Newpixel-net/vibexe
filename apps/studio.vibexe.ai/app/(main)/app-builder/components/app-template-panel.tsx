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
	Camera,
	FileCode2,
	ImageIcon,
	Loader2,
	RefreshCw,
	Rocket,
	Sparkles,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	TEMPLATE_CATEGORY_TREE,
	MAIN_CATEGORIES,
	parseCategory,
} from "../lib/template-constants";

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
	thumbnailUrl: string | null;
}

type PanelState = "loading" | "not-published" | "published";

export function AppTemplatePanel({ appId }: AppTemplatePanelProps) {
	const [state, setState] = useState<PanelState>("loading");
	const [template, setTemplate] = useState<TemplateData | null>(null);
	const [saving, setSaving] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [confirmUnpublish, setConfirmUnpublish] = useState(false);
	const [autoFilling, setAutoFilling] = useState(false);
	const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
	const [capturing, setCapturing] = useState(false);

	// Form fields (used for both publish and edit)
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [mainCategory, setMainCategory] = useState("Other");
	const [subCategory, setSubCategory] = useState("");
	const [tagsInput, setTagsInput] = useState("");
	const [visibility, setVisibility] = useState("public");

	// Derived: subcategories for selected main category
	const subcategories = useMemo(() => {
		return TEMPLATE_CATEGORY_TREE[mainCategory]?.subcategories ?? [];
	}, [mainCategory]);

	// Composed category string for DB storage
	const category = useMemo(() => {
		if (!subCategory) return mainCategory;
		return `${mainCategory} > ${subCategory}`;
	}, [mainCategory, subCategory]);

	// Set category from a stored "Main > Sub" string
	const setCategoryFromStored = useCallback((stored: string) => {
		const [main, sub] = parseCategory(stored);
		if (TEMPLATE_CATEGORY_TREE[main]) {
			setMainCategory(main);
			setSubCategory(sub);
		} else {
			setMainCategory("Other");
			setSubCategory(sub || main);
		}
	}, []);

	const fetchTemplate = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/template`);
			const data = await res.json();
			if (data.published && data.template) {
				const t = data.template;
				setTemplate(t);
				setName(t.name);
				setDescription(t.description ?? "");
				setCategoryFromStored(t.category);
				setTagsInput((t.tags ?? []).join(", "));
				setVisibility(t.visibility);
				setThumbnailUrl(t.thumbnailUrl ?? null);
				setState("published");
			} else {
				setState("not-published");
			}
		} catch {
			setState("not-published");
		}
	}, [appId, setCategoryFromStored]);

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
				if (data.category) {
					setCategoryFromStored(data.category);
				}
				setTagsInput((data.tags ?? []).join(", "));
			}
		} catch {
			// Silently fail — user can fill manually
		} finally {
			setAutoFilling(false);
		}
	}, [appId, setCategoryFromStored]);

	const resizeToThumbnail = useCallback(
		(dataUrl: string): Promise<Blob> => {
			return new Promise((resolve, reject) => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement("canvas");
					canvas.width = 800;
					canvas.height = 450;
					const ctx = canvas.getContext("2d");
					if (!ctx) return reject(new Error("No canvas context"));
					ctx.drawImage(img, 0, 0, 800, 450);
					canvas.toBlob(
						(blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
						"image/png",
					);
				};
				img.onerror = () => reject(new Error("Failed to load image"));
				img.src = dataUrl;
			});
		},
		[],
	);

	const uploadThumbnail = useCallback(
		async (blob: Blob) => {
			const formData = new FormData();
			formData.append("file", new File([blob], "_template-thumbnail.png", { type: "image/png" }));
			formData.append("path", "_template-thumbnail.png");
			const uploadRes = await fetch(`/api/apps/${appId}/storage`, {
				method: "POST",
				body: formData,
			});
			if (!uploadRes.ok) throw new Error("Upload failed");
			const uploadData = await uploadRes.json();
			const url = uploadData.url || `/api/apps/${appId}/storage/_template-thumbnail.png`;
			// Update template metadata with thumbnailUrl
			await fetch(`/api/apps/${appId}/template`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ thumbnailUrl: url }),
			});
			setThumbnailUrl(url);
		},
		[appId],
	);

	const handleCapture = useCallback(async () => {
		const iframe = document.querySelector("iframe.sp-preview-iframe") as HTMLIFrameElement | null;
		if (!iframe?.contentWindow) {
			alert("Preview not loaded yet. Please visit the Preview tab first, then try again.");
			return;
		}
		setCapturing(true);
		const cleanup = () => setCapturing(false);

		const handler = async (e: MessageEvent) => {
			if (e.data?.type === "vibexe-capture-result") {
				window.removeEventListener("message", handler);
				try {
					const blob = await resizeToThumbnail(e.data.dataUrl);
					await uploadThumbnail(blob);
				} catch {
					// silently fail
				} finally {
					cleanup();
				}
			} else if (e.data?.type === "vibexe-capture-error") {
				window.removeEventListener("message", handler);
				cleanup();
			}
		};
		window.addEventListener("message", handler);
		iframe.contentWindow.postMessage({ type: "vibexe-capture" }, "*");
		// Safety timeout
		setTimeout(() => {
			window.removeEventListener("message", handler);
			cleanup();
		}, 15000);
	}, [resizeToThumbnail, uploadThumbnail]);

	const handleUploadThumbnail = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			setCapturing(true);
			try {
				// Read as dataURL, resize, then upload
				const dataUrl = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => resolve(reader.result as string);
					reader.onerror = reject;
					reader.readAsDataURL(file);
				});
				const blob = await resizeToThumbnail(dataUrl);
				await uploadThumbnail(blob);
			} catch {
				// silently fail
			} finally {
				setCapturing(false);
				e.target.value = "";
			}
		},
		[resizeToThumbnail, uploadThumbnail],
	);

	const handleRemoveThumbnail = useCallback(async () => {
		try {
			await fetch(`/api/apps/${appId}/template`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ thumbnailUrl: null }),
			});
			setThumbnailUrl(null);
		} catch {
			// silently fail
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
				setMainCategory("Other");
				setSubCategory("");
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

	// Shared category selector JSX
	const categorySelector = (
		<div className="grid grid-cols-2 gap-3">
			<div>
				<label className="block text-sm font-medium text-white/60 mb-1.5">
					Category
				</label>
				<select
					value={mainCategory}
					onChange={(e) => {
						setMainCategory(e.target.value);
						const subs =
							TEMPLATE_CATEGORY_TREE[e.target.value]?.subcategories ?? [];
						setSubCategory(subs[0] ?? "");
					}}
					className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm focus:outline-none focus:border-white/20"
				>
					{MAIN_CATEGORIES.map((cat) => (
						<option key={cat} value={cat} className="bg-[#1a1a2e]">
							{cat}
						</option>
					))}
				</select>
			</div>
			<div>
				<label className="block text-sm font-medium text-white/60 mb-1.5">
					Subcategory
				</label>
				<select
					value={subCategory}
					onChange={(e) => setSubCategory(e.target.value)}
					className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm focus:outline-none focus:border-white/20"
				>
					{subcategories.map((sub) => (
						<option key={sub} value={sub} className="bg-[#1a1a2e]">
							{sub}
						</option>
					))}
				</select>
			</div>
		</div>
	);

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

						{/* Category (cascading) */}
						{categorySelector}

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

						{/* Thumbnail */}
						<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 space-y-4">
							<h2 className="text-sm font-semibold text-white/70">
								Thumbnail
							</h2>
							{thumbnailUrl ? (
								<div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
									<img
										src={thumbnailUrl}
										alt="Template thumbnail"
										className="w-full aspect-video object-cover"
									/>
									<button
										type="button"
										onClick={handleRemoveThumbnail}
										className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 transition-colors"
										title="Remove thumbnail"
									>
										<X className="h-3.5 w-3.5" />
									</button>
								</div>
							) : (
								<div className="w-full aspect-video rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] flex flex-col items-center justify-center gap-2">
									<ImageIcon className="h-8 w-8 text-white/15" />
									<span className="text-xs text-white/25">
										No thumbnail yet
									</span>
								</div>
							)}
							<div className="flex gap-2">
								<button
									type="button"
									onClick={handleCapture}
									disabled={capturing}
									className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-xs font-medium hover:bg-white/[0.1] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
								>
									{capturing ? (
										<>
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
											Capturing...
										</>
									) : (
										<>
											<Camera className="h-3.5 w-3.5" />
											Capture from Preview
										</>
									)}
								</button>
								<label className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-xs font-medium hover:bg-white/[0.1] transition-colors cursor-pointer flex items-center gap-1.5">
									<Upload className="h-3.5 w-3.5" />
									Upload
									<input
										type="file"
										accept="image/*"
										onChange={handleUploadThumbnail}
										className="hidden"
									/>
								</label>
							</div>
						</div>

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

							{/* Category (cascading) */}
							{categorySelector}

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
