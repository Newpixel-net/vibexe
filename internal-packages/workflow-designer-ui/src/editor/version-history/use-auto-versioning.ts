"use client";

import { useEffect, useRef } from "react";
import { useAppDesignerStore } from "../../app-designer";

const AUTO_VERSION_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Auto-creates version snapshots at a fixed interval while the workspace is being edited.
 * Uses the versions API with `auto: true` which deduplicates based on structural changes.
 */
export function useAutoVersioning() {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const nodeCountRef = useRef(0);
	const nodes = useAppDesignerStore((s) => s.nodes);

	// Track current node count for change detection
	useEffect(() => {
		nodeCountRef.current = nodes.length;
	}, [nodes.length]);

	useEffect(() => {
		if (!workspaceId) return;

		const interval = setInterval(async () => {
			try {
				await fetch(`/api/workspaces/${workspaceId}/versions`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ auto: true }),
				});
			} catch {
				// Silently fail — auto-versioning is best-effort
			}
		}, AUTO_VERSION_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [workspaceId]);
}
