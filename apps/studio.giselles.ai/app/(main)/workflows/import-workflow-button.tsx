"use client";

import { GlassButton } from "@/components/ui/glass-button";
import { UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

export function ImportWorkflowButton() {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isImporting, setIsImporting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleImport = useCallback(
		async (file: File) => {
			setIsImporting(true);
			setError(null);

			try {
				const text = await file.text();
				const n8nWorkflow = JSON.parse(text);

				const response = await fetch("/api/workspaces/import", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ n8nWorkflow }),
				});

				if (!response.ok) {
					const data = (await response.json()) as { error?: string };
					throw new Error(
						data.error ?? `Import failed: ${response.status}`,
					);
				}

				const data = (await response.json()) as {
					redirectPath?: string;
				};
				if (data.redirectPath) {
					router.push(data.redirectPath);
				}
			} catch (err) {
				console.error("Import error:", err);
				setError(
					err instanceof Error ? err.message : "Failed to import workflow",
				);
			} finally {
				setIsImporting(false);
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			}
		},
		[router],
	);

	return (
		<div className="flex flex-col items-start gap-2">
			<input
				ref={fileInputRef}
				type="file"
				accept=".json"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) {
						handleImport(file);
					}
				}}
			/>
			<GlassButton
				type="button"
				aria-label="Import N8N workflow"
				className="whitespace-nowrap"
				disabled={isImporting}
				onClick={() => fileInputRef.current?.click()}
			>
				<UploadIcon className="size-4 opacity-50" />
				{isImporting ? "Importing..." : "Import N8N"}
			</GlassButton>
			{error && (
				<p className="text-sm text-error-500" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
