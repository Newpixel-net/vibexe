"use client";

/**
 * StoragePanel Component
 *
 * Dashboard panel for managing per-app file storage.
 * Features: file browser, upload zone, storage usage bar, settings.
 */

import {
	Cloud,
	Download,
	File,
	FileImage,
	FileText,
	HardDrive,
	Link2,
	Loader2,
	RefreshCw,
	Settings,
	Trash2,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface FileInfo {
	path: string;
	size: number;
	contentType: string;
	lastModified: string;
	url: string;
}

interface StorageSettings {
	accessLevel: string;
	maxFileSizeMb: number;
	storageQuotaMb: number;
	usedStorageBytes: string;
	allowedTypes: string[];
}

interface StoragePanelProps {
	appId: string;
}

const SETTINGS_DEFAULTS: StorageSettings = {
	accessLevel: "authenticated",
	maxFileSizeMb: 10,
	storageQuotaMb: 500,
	usedStorageBytes: "0",
	allowedTypes: ["image/*", "application/pdf", "text/*"],
};

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(path: string) {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"];
	const docExts = ["pdf", "doc", "docx", "txt", "md"];

	if (imageExts.includes(ext)) return FileImage;
	if (docExts.includes(ext)) return FileText;
	return File;
}

function isImageFile(path: string): boolean {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	return ["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext);
}

export function StoragePanel({ appId }: StoragePanelProps) {
	const [files, setFiles] = useState<FileInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [settings, setSettings] = useState<StorageSettings>(SETTINGS_DEFAULTS);
	const [showSettings, setShowSettings] = useState(false);
	const [savingSettings, setSavingSettings] = useState(false);
	const [prefix, setPrefix] = useState("");
	const [hasMore, setHasMore] = useState(false);
	const [cursor, setCursor] = useState<string | undefined>();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [dragOver, setDragOver] = useState(false);

	// Fetch files
	const fetchFiles = useCallback(async (pfx?: string, cur?: string) => {
		try {
			setLoading(true);
			const params = new URLSearchParams();
			if (pfx) params.set("prefix", pfx);
			if (cur) params.set("cursor", cur);
			params.set("limit", "50");

			const res = await fetch(`/api/apps/${appId}/storage?${params}`);
			if (res.ok) {
				const data = await res.json();
				setFiles(data.files ?? []);
				setHasMore(data.hasMore ?? false);
				setCursor(data.cursor);
			}
		} catch {
			// Ignore
		} finally {
			setLoading(false);
		}
	}, [appId]);

	// Fetch settings
	const fetchSettings = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/storage/settings`);
			if (res.ok) {
				const data = await res.json();
				setSettings(data);
			}
		} catch {
			// Ignore
		}
	}, [appId]);

	useEffect(() => {
		fetchFiles(prefix);
		fetchSettings();
	}, [fetchFiles, fetchSettings, prefix]);

	// Upload handler
	const uploadFiles = async (fileList: FileList | File[]) => {
		setUploading(true);
		try {
			for (const file of fileList) {
				const formData = new FormData();
				formData.append("file", file);
				if (prefix) {
					formData.append("path", prefix + file.name);
				}

				await fetch(`/api/apps/${appId}/storage`, {
					method: "POST",
					body: formData,
				});
			}
			// Refresh file list
			fetchFiles(prefix);
			fetchSettings(); // Refresh usage
		} catch (err) {
			console.error("Upload failed:", err);
		} finally {
			setUploading(false);
		}
	};

	// Delete handler
	const deleteFile = async (path: string) => {
		if (!confirm(`Delete ${path}?`)) return;
		try {
			const res = await fetch(`/api/apps/${appId}/storage/${path}`, { method: "DELETE" });
			if (res.ok) {
				setFiles((prev) => prev.filter((f) => f.path !== path));
				fetchSettings(); // Refresh usage
			}
		} catch {
			// Ignore
		}
	};

	// Copy URL
	const copyUrl = (path: string) => {
		const url = `${window.location.origin}/api/apps/${appId}/storage/${path}`;
		navigator.clipboard.writeText(url);
	};

	// Save settings
	const saveSettings = async () => {
		setSavingSettings(true);
		try {
			await fetch(`/api/apps/${appId}/storage/settings`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(settings),
			});
		} catch {
			// Ignore
		} finally {
			setSavingSettings(false);
		}
	};

	// Drag-and-drop handlers
	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(true);
	};
	const handleDragLeave = () => setDragOver(false);
	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(false);
		if (e.dataTransfer.files.length > 0) {
			uploadFiles(e.dataTransfer.files);
		}
	};

	const usedBytes = Number.parseInt(settings.usedStorageBytes ?? "0", 10);
	const quotaBytes = (settings.storageQuotaMb ?? 500) * 1024 * 1024;
	const usagePercent = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<HardDrive className="h-5 w-5 text-violet-400" />
					<h2 className="text-lg font-semibold text-white/90">Storage</h2>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => fetchFiles(prefix)}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
					>
						<RefreshCw className="h-3.5 w-3.5" />
						Refresh
					</button>
					<button
						type="button"
						onClick={() => setShowSettings(!showSettings)}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
					>
						<Settings className="h-3.5 w-3.5" />
						Settings
					</button>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						disabled={uploading}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
					>
						{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
						Upload
					</button>
					<input
						ref={fileInputRef}
						type="file"
						multiple
						className="hidden"
						onChange={(e) => {
							if (e.target.files?.length) uploadFiles(e.target.files);
							e.target.value = "";
						}}
					/>
				</div>
			</div>

			{/* Storage Usage Bar */}
			<div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-4">
				<div className="flex items-center justify-between mb-2">
					<span className="text-xs text-white/50">Storage Used</span>
					<span className="text-xs text-white/70">
						{formatBytes(usedBytes)} / {formatBytes(quotaBytes)}
					</span>
				</div>
				<div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
					<div
						className="h-full rounded-full transition-all duration-500"
						style={{
							width: `${usagePercent}%`,
							backgroundColor: usagePercent > 90 ? "#ef4444" : usagePercent > 70 ? "#f59e0b" : "#8b5cf6",
						}}
					/>
				</div>
			</div>

			{/* Settings Panel (collapsible) */}
			{showSettings && (
				<div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-4 space-y-4">
					<h3 className="text-sm font-medium text-white/80">Storage Settings</h3>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-xs text-white/50 mb-1">Access Level</label>
							<select
								value={settings.accessLevel}
								onChange={(e) => setSettings({ ...settings, accessLevel: e.target.value })}
								className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/50"
							>
								<option value="public">Public (anyone)</option>
								<option value="authenticated">Authenticated (logged-in users)</option>
								<option value="owner">Owner Only (uploader)</option>
							</select>
						</div>

						<div>
							<label className="block text-xs text-white/50 mb-1">Max File Size (MB)</label>
							<input
								type="number"
								min={1}
								max={100}
								value={settings.maxFileSizeMb}
								onChange={(e) => setSettings({ ...settings, maxFileSizeMb: Number(e.target.value) })}
								className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/50"
							/>
						</div>

						<div>
							<label className="block text-xs text-white/50 mb-1">Storage Quota (MB)</label>
							<input
								type="number"
								min={10}
								max={10000}
								value={settings.storageQuotaMb}
								onChange={(e) => setSettings({ ...settings, storageQuotaMb: Number(e.target.value) })}
								className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/50"
							/>
						</div>

						<div>
							<label className="block text-xs text-white/50 mb-1">Allowed Types</label>
							<input
								type="text"
								value={(settings.allowedTypes ?? []).join(", ")}
								onChange={(e) => setSettings({ ...settings, allowedTypes: e.target.value.split(",").map((s) => s.trim()) })}
								className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/50"
								placeholder="image/*, application/pdf, text/*"
							/>
						</div>
					</div>

					<button
						type="button"
						onClick={saveSettings}
						disabled={savingSettings}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
					>
						{savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
						Save Settings
					</button>
				</div>
			)}

			{/* Drop Zone / File Grid */}
			<div
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				className={`min-h-[200px] rounded-lg border-2 border-dashed transition-colors ${
					dragOver
						? "border-violet-400 bg-violet-500/[0.08]"
						: "border-white/[0.08] bg-white/[0.02]"
				}`}
			>
				{loading ? (
					<div className="flex items-center justify-center h-[200px]">
						<Loader2 className="h-6 w-6 animate-spin text-white/30" />
					</div>
				) : files.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-[200px] text-center">
						<Cloud className="h-10 w-10 text-white/20 mb-3" />
						<p className="text-sm text-white/40 mb-1">No files uploaded yet</p>
						<p className="text-xs text-white/30">Drag & drop files here or click Upload</p>
					</div>
				) : (
					<div className="p-4">
						<div className="grid grid-cols-1 gap-2">
							{files.map((file) => {
								const Icon = getFileIcon(file.path);
								const isImage = isImageFile(file.path);
								return (
									<div
										key={file.path}
										className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] transition-colors group"
									>
										{/* Thumbnail or icon */}
										{isImage ? (
											<div className="w-10 h-10 rounded bg-white/[0.06] overflow-hidden flex-shrink-0">
												<img
													src={`/api/apps/${appId}/storage/${file.path}?width=80&height=80&format=webp`}
													alt={file.path}
													className="w-full h-full object-cover"
													loading="lazy"
												/>
											</div>
										) : (
											<div className="w-10 h-10 rounded bg-white/[0.06] flex items-center justify-center flex-shrink-0">
												<Icon className="h-5 w-5 text-white/30" />
											</div>
										)}

										{/* File info */}
										<div className="flex-1 min-w-0">
											<p className="text-sm text-white/80 truncate">{file.path}</p>
											<p className="text-xs text-white/30">
												{formatBytes(file.size)}
												{file.lastModified ? ` \u00B7 ${new Date(file.lastModified).toLocaleDateString()}` : ""}
											</p>
										</div>

										{/* Actions */}
										<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<button
												type="button"
												onClick={() => copyUrl(file.path)}
												title="Copy URL"
												className="p-1.5 rounded hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
											>
												<Link2 className="h-3.5 w-3.5" />
											</button>
											<a
												href={`/api/apps/${appId}/storage/${file.path}`}
												download
												title="Download"
												className="p-1.5 rounded hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
											>
												<Download className="h-3.5 w-3.5" />
											</a>
											<button
												type="button"
												onClick={() => deleteFile(file.path)}
												title="Delete"
												className="p-1.5 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
											>
												<Trash2 className="h-3.5 w-3.5" />
											</button>
										</div>
									</div>
								);
							})}
						</div>

						{hasMore && (
							<button
								type="button"
								onClick={() => fetchFiles(prefix, cursor)}
								className="mt-3 w-full py-2 text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.04] rounded-lg transition-colors"
							>
								Load more...
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
