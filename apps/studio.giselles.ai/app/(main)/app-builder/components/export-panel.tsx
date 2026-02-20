"use client";

/**
 * ExportPanel Component
 *
 * Export the app as a self-hosted package (ZIP).
 * Generates Vite + React + TypeScript project with Docker support.
 */

import {
	AlertCircle,
	Check,
	Download,
	FileArchive,
	FileCode,
	Loader2,
	Package,
	Server,
} from "lucide-react";
import { useCallback, useState } from "react";

interface ExportPanelProps {
	appId: string;
}

export function ExportPanel({ appId }: ExportPanelProps) {
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [stats, setStats] = useState<{
		fileCount: number;
		appName: string;
	} | null>(null);

	const handleExport = useCallback(async () => {
		setExporting(true);
		setError(null);
		setSuccess(false);

		try {
			const res = await fetch(`/api/apps/${appId}/export`, {
				method: "POST",
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(data.error || "Export failed");
				setExporting(false);
				return;
			}

			const data = await res.json();
			setStats({
				fileCount: data.fileCount,
				appName: data.appName,
			});

			// Generate ZIP client-side using JSZip-like approach
			// Since we can't import JSZip, we'll create a simple downloadable JSON
			// that users can unpack, OR we generate individual file downloads
			const blob = await generateZipBlob(data.files, data.appName);
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${data.appName}.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			setSuccess(true);
			setTimeout(() => setSuccess(false), 5000);
		} catch {
			setError("Network error. Please try again.");
		}

		setExporting(false);
	}, [appId]);

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				<div>
					<h1 className="text-2xl font-bold text-foreground">Export</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Download your app as a self-hosted package
					</p>
				</div>

				{error && (
					<div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20">
						<AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
						<p className="text-xs text-red-500">{error}</p>
					</div>
				)}

				{success && stats && (
					<div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
						<Check className="h-4 w-4 text-green-500 flex-shrink-0" />
						<p className="text-xs text-green-600">
							Exported {stats.fileCount} files as {stats.appName}.zip
						</p>
					</div>
				)}

				{/* Export Button */}
				<div className="rounded-lg border border-border bg-card p-6 space-y-4">
					<div className="flex items-center gap-3">
						<div className="h-10 w-10 rounded-lg bg-foreground/10 flex items-center justify-center">
							<FileArchive className="h-5 w-5 text-foreground" />
						</div>
						<div>
							<h3 className="text-sm font-semibold text-foreground">
								Self-Hosted Package
							</h3>
							<p className="text-xs text-muted-foreground">
								Complete Vite + React + TypeScript project with Docker support
							</p>
						</div>
					</div>

					<button
						type="button"
						onClick={handleExport}
						disabled={exporting}
						className="w-full px-4 py-3 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
					>
						{exporting ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Generating export...
							</>
						) : (
							<>
								<Download className="h-4 w-4" />
								Download ZIP
							</>
						)}
					</button>
				</div>

				{/* What's Included */}
				<div className="rounded-lg border border-border bg-card p-4 space-y-3">
					<h3 className="text-sm font-medium text-foreground">
						What&apos;s included
					</h3>
					<div className="grid grid-cols-2 gap-3">
						<div className="flex items-start gap-2">
							<FileCode className="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p className="text-xs font-medium text-foreground">
									Source Code
								</p>
								<p className="text-[11px] text-muted-foreground">
									All React components, hooks, utilities, and types
								</p>
							</div>
						</div>
						<div className="flex items-start gap-2">
							<Package className="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p className="text-xs font-medium text-foreground">
									Build Config
								</p>
								<p className="text-[11px] text-muted-foreground">
									Vite, TypeScript, Tailwind, PostCSS config
								</p>
							</div>
						</div>
						<div className="flex items-start gap-2">
							<Server className="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p className="text-xs font-medium text-foreground">
									Docker Setup
								</p>
								<p className="text-[11px] text-muted-foreground">
									Dockerfile + docker-compose.yml for production
								</p>
							</div>
						</div>
						<div className="flex items-start gap-2">
							<Download className="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p className="text-xs font-medium text-foreground">
									Database Schema
								</p>
								<p className="text-[11px] text-muted-foreground">
									SQL schema + auth tables (if app uses entities)
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Instructions */}
				<div className="rounded-lg border border-border bg-card p-4 space-y-3">
					<h3 className="text-sm font-medium text-foreground">
						Quick start after export
					</h3>
					<div className="space-y-2">
						<div className="flex items-start gap-2">
							<span className="h-5 w-5 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground flex-shrink-0">
								1
							</span>
							<p className="text-xs text-muted-foreground">
								Unzip and run{" "}
								<code className="px-1.5 py-0.5 rounded bg-muted text-foreground">
									npm install
								</code>
							</p>
						</div>
						<div className="flex items-start gap-2">
							<span className="h-5 w-5 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground flex-shrink-0">
								2
							</span>
							<p className="text-xs text-muted-foreground">
								Run{" "}
								<code className="px-1.5 py-0.5 rounded bg-muted text-foreground">
									npm run dev
								</code>{" "}
								for local development
							</p>
						</div>
						<div className="flex items-start gap-2">
							<span className="h-5 w-5 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground flex-shrink-0">
								3
							</span>
							<p className="text-xs text-muted-foreground">
								Or run{" "}
								<code className="px-1.5 py-0.5 rounded bg-muted text-foreground">
									docker-compose up
								</code>{" "}
								for production with PostgreSQL
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Generate a ZIP blob client-side without external dependencies.
 * Uses the simple PK-ZIP format with STORE (no compression) method.
 */
async function generateZipBlob(
	files: Record<string, string>,
	_appName: string,
): Promise<Blob> {
	const encoder = new TextEncoder();
	const entries: Array<{
		name: Uint8Array;
		data: Uint8Array;
		offset: number;
	}> = [];

	const parts: Uint8Array[] = [];
	let offset = 0;

	for (const [path, content] of Object.entries(files)) {
		const nameBytes = encoder.encode(path);
		const dataBytes = encoder.encode(content);
		const crc = crc32(dataBytes);

		// Local file header
		const header = new ArrayBuffer(30 + nameBytes.length);
		const view = new DataView(header);
		view.setUint32(0, 0x04034b50, true); // Local file header signature
		view.setUint16(4, 20, true); // Version needed
		view.setUint16(6, 0, true); // Flags
		view.setUint16(8, 0, true); // Compression method (STORE)
		view.setUint16(10, 0, true); // Mod time
		view.setUint16(12, 0, true); // Mod date
		view.setUint32(14, crc, true); // CRC-32
		view.setUint32(18, dataBytes.length, true); // Compressed size
		view.setUint32(22, dataBytes.length, true); // Uncompressed size
		view.setUint16(26, nameBytes.length, true); // File name length
		view.setUint16(28, 0, true); // Extra field length
		new Uint8Array(header).set(nameBytes, 30);

		const headerBytes = new Uint8Array(header);
		entries.push({ name: nameBytes, data: dataBytes, offset });
		parts.push(headerBytes);
		parts.push(dataBytes);
		offset += headerBytes.length + dataBytes.length;
	}

	// Central directory
	const centralStart = offset;
	for (const entry of entries) {
		const dataBytes = entry.data;
		const crc = crc32(dataBytes);
		const cdHeader = new ArrayBuffer(46 + entry.name.length);
		const view = new DataView(cdHeader);
		view.setUint32(0, 0x02014b50, true); // Central directory signature
		view.setUint16(4, 20, true); // Version made by
		view.setUint16(6, 20, true); // Version needed
		view.setUint16(8, 0, true); // Flags
		view.setUint16(10, 0, true); // Compression method
		view.setUint16(12, 0, true); // Mod time
		view.setUint16(14, 0, true); // Mod date
		view.setUint32(16, crc, true); // CRC-32
		view.setUint32(20, dataBytes.length, true); // Compressed size
		view.setUint32(24, dataBytes.length, true); // Uncompressed size
		view.setUint16(28, entry.name.length, true); // File name length
		view.setUint16(30, 0, true); // Extra field length
		view.setUint16(32, 0, true); // File comment length
		view.setUint16(34, 0, true); // Disk number start
		view.setUint16(36, 0, true); // Internal file attributes
		view.setUint32(38, 0, true); // External file attributes
		view.setUint32(42, entry.offset, true); // Local header offset
		new Uint8Array(cdHeader).set(entry.name, 46);

		const cdBytes = new Uint8Array(cdHeader);
		parts.push(cdBytes);
		offset += cdBytes.length;
	}

	const centralSize = offset - centralStart;

	// End of central directory
	const eocd = new ArrayBuffer(22);
	const eocdView = new DataView(eocd);
	eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
	eocdView.setUint16(4, 0, true); // Disk number
	eocdView.setUint16(6, 0, true); // Central directory disk
	eocdView.setUint16(8, entries.length, true); // Entries on this disk
	eocdView.setUint16(10, entries.length, true); // Total entries
	eocdView.setUint32(12, centralSize, true); // Central directory size
	eocdView.setUint32(16, centralStart, true); // Central directory offset
	eocdView.setUint16(20, 0, true); // Comment length
	parts.push(new Uint8Array(eocd));

	return new Blob(parts, { type: "application/zip" });
}

/** CRC-32 implementation for ZIP files */
function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (let i = 0; i < data.length; i++) {
		crc ^= data[i];
		for (let j = 0; j < 8; j++) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}
