"use client";

/**
 * AppTemplatePanel Component
 *
 * Allows users to publish their app as a reusable template,
 * update metadata, refresh snapshots, and unpublish.
 * Supports full-page capture, crop dialog, and multiple screenshots.
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
	Images,
	Loader2,
	Plus,
	RefreshCw,
	Rocket,
	Sparkles,
	Star,
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
import { ThumbnailCropDialog } from "./thumbnail-crop-dialog";

interface TemplateScreenshot {
	url: string;
	order: number;
	width: number;
	height: number;
	isMain: boolean;
}

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
	fullpageUrl: string | null;
	screenshots: TemplateScreenshot[] | null;
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
	const [fullpageUrl, setFullpageUrl] = useState<string | null>(null);
	const [screenshots, setScreenshots] = useState<TemplateScreenshot[]>([]);
	const [capturing, setCapturing] = useState(false);

	// Crop dialog state
	const [showCropDialog, setShowCropDialog] = useState(false);
	const [pendingCaptureDataUrl, setPendingCaptureDataUrl] = useState<string | null>(null);
	const [pendingCaptureSize, setPendingCaptureSize] = useState({ w: 0, h: 0 });

	// Capture choice dialog state (Main vs Additional)
	const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
	const [pendingThumbnailBlob, setPendingThumbnailBlob] = useState<Blob | null>(null);

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
				setFullpageUrl(t.fullpageUrl ?? null);
				setScreenshots(t.screenshots ?? []);
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

	// Resize full-page image to thumbnail by cropping from top at 16:9
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
					// Crop from top of source at 16:9 aspect ratio
					const srcW = img.naturalWidth;
					const srcH = Math.min(
						Math.round(img.naturalWidth / (800 / 450)),
						img.naturalHeight,
					);
					ctx.drawImage(img, 0, 0, srcW, srcH, 0, 0, 800, 450);
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
			return uploadData.url || `/api/apps/${appId}/storage/_template-thumbnail.png`;
		},
		[appId],
	);

	const uploadFullpage = useCallback(
		async (dataUrl: string) => {
			// Convert data URL to blob
			const res = await fetch(dataUrl);
			const blob = await res.blob();
			const formData = new FormData();
			formData.append("file", new File([blob], "_template-fullpage.png", { type: "image/png" }));
			formData.append("path", "_template-fullpage.png");
			const uploadRes = await fetch(`/api/apps/${appId}/storage`, {
				method: "POST",
				body: formData,
			});
			if (!uploadRes.ok) throw new Error("Fullpage upload failed");
			const uploadData = await uploadRes.json();
			return uploadData.url || `/api/apps/${appId}/storage/_template-fullpage.png`;
		},
		[appId],
	);

	const uploadScreenshot = useCallback(
		async (dataUrl: string, index: number) => {
			const res = await fetch(dataUrl);
			const blob = await res.blob();
			const fileName = `_template-screenshot-${index}.png`;
			const formData = new FormData();
			formData.append("file", new File([blob], fileName, { type: "image/png" }));
			formData.append("path", fileName);
			const uploadRes = await fetch(`/api/apps/${appId}/storage`, {
				method: "POST",
				body: formData,
			});
			if (!uploadRes.ok) throw new Error("Screenshot upload failed");
			const uploadData = await uploadRes.json();
			return uploadData.url || `/api/apps/${appId}/storage/${fileName}`;
		},
		[appId],
	);

	// Save both thumbnailUrl + fullpageUrl + screenshots to template
	const saveImageUrls = useCallback(
		async (thumbUrl: string | null, fpUrl: string | null, shots?: TemplateScreenshot[]) => {
			const body: Record<string, unknown> = {};
			if (thumbUrl !== undefined) body.thumbnailUrl = thumbUrl;
			if (fpUrl !== undefined) body.fullpageUrl = fpUrl;
			if (shots !== undefined) body.screenshots = shots;
			await fetch(`/api/apps/${appId}/template`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
		},
		[appId],
	);

	// After crop/skip completes — upload both images as main thumbnail
	const finishCaptureAsMain = useCallback(
		async (thumbnailBlob: Blob) => {
			if (!pendingCaptureDataUrl) return;
			setCapturing(true);
			try {
				// Upload thumbnail
				const thumbUrl = await uploadThumbnail(thumbnailBlob);
				// Upload fullpage
				const fpUrl = await uploadFullpage(pendingCaptureDataUrl);
				// Save both URLs to template
				await saveImageUrls(thumbUrl, fpUrl);
				setThumbnailUrl(thumbUrl);
				setFullpageUrl(fpUrl);
			} catch {
				// silently fail
			} finally {
				setCapturing(false);
				setPendingCaptureDataUrl(null);
				setPendingThumbnailBlob(null);
			}
		},
		[pendingCaptureDataUrl, uploadThumbnail, uploadFullpage, saveImageUrls],
	);

	// Add capture as additional screenshot
	const finishCaptureAsScreenshot = useCallback(async () => {
		if (!pendingCaptureDataUrl) return;
		setCapturing(true);
		try {
			const nextIndex = screenshots.length;
			const url = await uploadScreenshot(pendingCaptureDataUrl, nextIndex);
			const newShot: TemplateScreenshot = {
				url,
				order: nextIndex,
				width: pendingCaptureSize.w,
				height: pendingCaptureSize.h,
				isMain: false,
			};
			const updated = [...screenshots, newShot];
			await saveImageUrls(thumbnailUrl, fullpageUrl, updated);
			setScreenshots(updated);
		} catch {
			// silently fail
		} finally {
			setCapturing(false);
			setPendingCaptureDataUrl(null);
			setCaptureDialogOpen(false);
		}
	}, [pendingCaptureDataUrl, pendingCaptureSize, screenshots, thumbnailUrl, fullpageUrl, uploadScreenshot, saveImageUrls]);

	const handleCapture = useCallback(async () => {
		const iframe = document.querySelector("iframe.sp-preview-iframe") as HTMLIFrameElement | null;
		if (!iframe?.contentWindow) {
			alert("Preview not loaded yet. Please visit the Preview tab first, then try again.");
			return;
		}
		setCapturing(true);

		// The Sandpack preview container is hidden (display:none) when Dashboard tab is active.
		// html2canvas crashes on hidden elements (0-size causes non-finite gradient values).
		// Temporarily make it visible off-screen for the capture, then re-hide.
		const previewContainer = iframe.closest("[style*='display']") as HTMLElement | null;
		const wasHidden = previewContainer && previewContainer.style.display === "none";
		if (wasHidden && previewContainer) {
			previewContainer.style.display = "flex";
			previewContainer.style.position = "fixed";
			previewContainer.style.left = "-9999px";
			previewContainer.style.top = "0";
			previewContainer.style.width = "1280px";
			previewContainer.style.height = "auto";
			previewContainer.style.minHeight = "720px";
		}

		// Wait a tick for the layout to recalculate
		await new Promise((r) => setTimeout(r, 500));

		const restoreVisibility = () => {
			if (wasHidden && previewContainer) {
				previewContainer.style.display = "none";
				previewContainer.style.position = "";
				previewContainer.style.left = "";
				previewContainer.style.top = "";
				previewContainer.style.width = "";
				previewContainer.style.height = "";
				previewContainer.style.minHeight = "";
			}
		};
		const cleanup = () => {
			restoreVisibility();
			setCapturing(false);
		};

		const handler = async (e: MessageEvent) => {
			if (e.data?.type === "vibexe-capture-result") {
				window.removeEventListener("message", handler);
				restoreVisibility();
				// Store the raw capture and show crop dialog
				setPendingCaptureDataUrl(e.data.dataUrl);
				setPendingCaptureSize({ w: e.data.fullWidth || 1280, h: e.data.fullHeight || 720 });
				setCapturing(false);
				setShowCropDialog(true);
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
	}, []);

	// Crop dialog callbacks
	const handleCropConfirm = useCallback(
		(blob: Blob) => {
			setShowCropDialog(false);
			setPendingThumbnailBlob(blob);
			// If no screenshots exist yet, go straight to setting as main
			if (screenshots.length === 0) {
				finishCaptureAsMain(blob);
			} else {
				setCaptureDialogOpen(true);
			}
		},
		[screenshots.length, finishCaptureAsMain],
	);

	const handleCropSkip = useCallback(async () => {
		setShowCropDialog(false);
		if (!pendingCaptureDataUrl) return;
		try {
			const blob = await resizeToThumbnail(pendingCaptureDataUrl);
			setPendingThumbnailBlob(blob);
			if (screenshots.length === 0) {
				finishCaptureAsMain(blob);
			} else {
				setCaptureDialogOpen(true);
			}
		} catch {
			setPendingCaptureDataUrl(null);
		}
	}, [pendingCaptureDataUrl, resizeToThumbnail, screenshots.length, finishCaptureAsMain]);

	const handleCropCancel = useCallback(() => {
		setShowCropDialog(false);
		setPendingCaptureDataUrl(null);
	}, []);

	// Capture dialog: Set as Main
	const handleCaptureSetMain = useCallback(() => {
		setCaptureDialogOpen(false);
		if (pendingThumbnailBlob) {
			finishCaptureAsMain(pendingThumbnailBlob);
		}
	}, [pendingThumbnailBlob, finishCaptureAsMain]);

	// Capture dialog: Add as Screenshot
	const handleCaptureAddScreenshot = useCallback(() => {
		setCaptureDialogOpen(false);
		finishCaptureAsScreenshot();
	}, [finishCaptureAsScreenshot]);

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
				const thumbUrl = await uploadThumbnail(blob);
				await saveImageUrls(thumbUrl, fullpageUrl);
				setThumbnailUrl(thumbUrl);
			} catch {
				// silently fail
			} finally {
				setCapturing(false);
				e.target.value = "";
			}
		},
		[resizeToThumbnail, uploadThumbnail, saveImageUrls, fullpageUrl],
	);

	const handleRemoveThumbnail = useCallback(async () => {
		try {
			await saveImageUrls(null, null);
			setThumbnailUrl(null);
			setFullpageUrl(null);
		} catch {
			// silently fail
		}
	}, [saveImageUrls]);

	// Screenshot management
	const handleSetScreenshotAsMain = useCallback(
		async (idx: number) => {
			const shot = screenshots[idx];
			if (!shot) return;
			setCapturing(true);
			try {
				// The screenshot URL becomes the new fullpage, crop from top for thumbnail
				const blob = await resizeToThumbnail(shot.url);
				const thumbUrl = await uploadThumbnail(blob);
				const updated = screenshots.map((s, i) => ({ ...s, isMain: i === idx }));
				await saveImageUrls(thumbUrl, shot.url, updated);
				setThumbnailUrl(thumbUrl);
				setFullpageUrl(shot.url);
				setScreenshots(updated);
			} catch {
				// silently fail
			} finally {
				setCapturing(false);
			}
		},
		[screenshots, resizeToThumbnail, uploadThumbnail, saveImageUrls],
	);

	const handleRemoveScreenshot = useCallback(
		async (idx: number) => {
			const updated = screenshots
				.filter((_, i) => i !== idx)
				.map((s, i) => ({ ...s, order: i }));
			await saveImageUrls(thumbnailUrl, fullpageUrl, updated);
			setScreenshots(updated);
		},
		[screenshots, thumbnailUrl, fullpageUrl, saveImageUrls],
	);

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
							{fullpageUrl && (
								<p className="text-[11px] text-emerald-400/60 flex items-center gap-1.5">
									<Images className="h-3 w-3" />
									Full-page preview captured
								</p>
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

						{/* Screenshots Gallery */}
						<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 space-y-4">
							<div className="flex items-center justify-between">
								<h2 className="text-sm font-semibold text-white/70">
									Screenshots ({screenshots.length})
								</h2>
								<button
									type="button"
									onClick={handleCapture}
									disabled={capturing}
									className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 text-[11px] font-medium hover:bg-white/[0.1] transition-colors disabled:opacity-50 flex items-center gap-1"
								>
									<Plus className="h-3 w-3" />
									Add
								</button>
							</div>
							{screenshots.length === 0 ? (
								<div className="py-6 text-center">
									<Images className="h-6 w-6 text-white/10 mx-auto mb-2" />
									<p className="text-xs text-white/25">
										No additional screenshots yet. Capture or set as main above.
									</p>
								</div>
							) : (
								<div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
									{screenshots.map((shot, idx) => (
										<div
											key={shot.url}
											className="relative flex-shrink-0 w-48 rounded-xl overflow-hidden border border-white/[0.08] group/shot"
										>
											<img
												src={shot.url}
												alt={`Screenshot ${idx + 1}`}
												className="w-full aspect-video object-cover"
											/>
											{shot.isMain && (
												<div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-violet-500/80 backdrop-blur-sm text-[9px] font-semibold text-white flex items-center gap-0.5">
													<Star className="h-2.5 w-2.5 fill-current" />
													Main
												</div>
											)}
											<div className="absolute inset-0 bg-black/0 group-hover/shot:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover/shot:opacity-100">
												{!shot.isMain && (
													<button
														type="button"
														onClick={() => handleSetScreenshotAsMain(idx)}
														className="px-2 py-1 rounded-md bg-white/20 backdrop-blur-sm text-[10px] font-medium text-white hover:bg-white/30 transition-colors"
													>
														Set Main
													</button>
												)}
												<button
													type="button"
													onClick={() => handleRemoveScreenshot(idx)}
													className="p-1 rounded-md bg-red-500/30 backdrop-blur-sm text-white hover:bg-red-500/50 transition-colors"
												>
													<Trash2 className="h-3 w-3" />
												</button>
											</div>
										</div>
									))}
								</div>
							)}
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

						{/* Capture Choice Dialog (Main vs Screenshot) */}
						<Dialog open={captureDialogOpen} onOpenChange={setCaptureDialogOpen}>
							<DialogContent>
								<DialogHeader>
									<DialogTitle className="font-sans text-[18px] font-medium tracking-tight text-white/90">
										Save Capture As
									</DialogTitle>
									<DialogDescription className="font-geist mt-1 text-[13px] text-white/40">
										Choose how to use this captured image.
									</DialogDescription>
								</DialogHeader>
								<DialogBody>
									<div className="flex gap-3 mt-4">
										<button
											type="button"
											onClick={handleCaptureSetMain}
											className="flex-1 px-4 py-4 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] transition-colors text-center"
										>
											<ImageIcon className="h-6 w-6 text-violet-400 mx-auto mb-2" />
											<p className="text-sm font-medium text-white/80">Set as Main Thumbnail</p>
											<p className="text-[11px] text-white/30 mt-1">Replaces current thumbnail + full-page</p>
										</button>
										<button
											type="button"
											onClick={handleCaptureAddScreenshot}
											className="flex-1 px-4 py-4 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] transition-colors text-center"
										>
											<Plus className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
											<p className="text-sm font-medium text-white/80">Add as Screenshot</p>
											<p className="text-[11px] text-white/30 mt-1">Adds to the screenshot gallery</p>
										</button>
									</div>
								</DialogBody>
								<DialogFooter>
									<button
										type="button"
										onClick={() => {
											setCaptureDialogOpen(false);
											setPendingCaptureDataUrl(null);
										}}
										className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/70 transition-colors"
									>
										Cancel
									</button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</>
				)}
			</div>

			{/* Crop Dialog (fullscreen overlay) */}
			{showCropDialog && pendingCaptureDataUrl && (
				<ThumbnailCropDialog
					imageDataUrl={pendingCaptureDataUrl}
					onCrop={handleCropConfirm}
					onSkip={handleCropSkip}
					onCancel={handleCropCancel}
				/>
			)}
		</div>
	);
}
