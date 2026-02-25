"use client";

import clsx from "clsx/lite";
import { CloudIcon, CloudOffIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAppDesignerStore } from "../../../app-designer";

export function PublishToggle() {
	const isTriggerFlowMode = useAppDesignerStore((s) => s.isTriggerFlowMode());
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const [isPublished, setIsPublished] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const apiUrl = `/api/agents/by-workspace/publish?workspaceId=${encodeURIComponent(workspaceId)}`;

	// Fetch current publish status
	useEffect(() => {
		if (!workspaceId) return;
		fetch(apiUrl)
			.then((res) => res.json())
			.then((data) => {
				if (data.isPublished !== undefined) {
					setIsPublished(data.isPublished);
				}
			})
			.catch(() => {
				// Silently ignore fetch errors
			});
	}, [workspaceId, apiUrl]);

	const handleToggle = useCallback(async () => {
		if (!workspaceId || isLoading) return;
		setIsLoading(true);
		try {
			const res = await fetch(apiUrl, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ published: !isPublished }),
			});
			const data = await res.json();
			if (data.isPublished !== undefined) {
				setIsPublished(data.isPublished);
			}
		} catch {
			// Silently ignore errors
		} finally {
			setIsLoading(false);
		}
	}, [workspaceId, apiUrl, isPublished, isLoading]);

	// Listen for Shift+P keyboard shortcut
	useEffect(() => {
		const handler = () => handleToggle();
		window.addEventListener("toggle-publish", handler);
		return () => window.removeEventListener("toggle-publish", handler);
	}, [handleToggle]);

	return (
		<button
			type="button"
			onClick={handleToggle}
			disabled={isLoading}
			className={clsx(
				"flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all",
				"border",
				isPublished
					? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
					: "bg-white/5 border-white/10 text-inverse/50 hover:bg-white/10 hover:text-inverse/70",
				isLoading && "opacity-50 cursor-wait",
			)}
		>
			{isPublished ? (
				<CloudIcon className="w-3.5 h-3.5" />
			) : (
				<CloudOffIcon className="w-3.5 h-3.5" />
			)}
			{isPublished ? "Published" : "Draft"}
		</button>
	);
}
