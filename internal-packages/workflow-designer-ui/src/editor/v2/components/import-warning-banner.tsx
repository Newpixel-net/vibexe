"use client";

import { XIcon, AlertTriangleIcon } from "lucide-react";
import { useState } from "react";
import { useAppDesignerStore } from "../../../app-designer";

/**
 * Import warning banner shown at the top of the canvas for imported N8N workflows.
 * Displays credential setup needs, expression translation status, and disabled nodes.
 * Dismissible by the user.
 */
export function ImportWarningBanner() {
	const [dismissed, setDismissed] = useState(false);
	const nodes = useAppDesignerStore((s) => s.nodes);

	// Count nodes needing credentials (have credentialHint)
	const nodesNeedingCredentials = nodes.filter(
		(n) =>
			n.type === "operation" &&
			(n as { credentialHint?: unknown }).credentialHint != null,
	).length;

	// Count disabled nodes
	const disabledNodes = nodes.filter(
		(n) => n.type === "operation" && (n as { disabled?: boolean }).disabled,
	).length;

	// Only show if there's something to report
	const hasIssues = nodesNeedingCredentials > 0 || disabledNodes > 0;

	if (dismissed || !hasIssues) {
		return null;
	}

	const parts: string[] = [];
	if (nodesNeedingCredentials > 0) {
		parts.push(
			`${nodesNeedingCredentials} node${nodesNeedingCredentials > 1 ? "s" : ""} need${nodesNeedingCredentials === 1 ? "s" : ""} credential setup`,
		);
	}
	if (disabledNodes > 0) {
		parts.push(
			`${disabledNodes} node${disabledNodes > 1 ? "s" : ""} disabled`,
		);
	}

	return (
		<div className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 border-b border-amber-500/30 z-50">
			<AlertTriangleIcon className="size-4 text-amber-400 shrink-0" />
			<span className="text-[11px] text-amber-300 font-medium flex-1">
				Imported from N8N — {parts.join(", ")}
			</span>
			<button
				type="button"
				onClick={() => setDismissed(true)}
				className="text-amber-400 hover:text-amber-200 transition-colors"
			>
				<XIcon className="size-3.5" />
			</button>
		</div>
	);
}
