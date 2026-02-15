"use client";

import { getCatalogEntry } from "@giselles-ai/activepieces-adapter";
import { XIcon, AlertTriangleIcon, ChevronDownIcon, ChevronUpIcon, CheckCircle2Icon, CircleAlertIcon, ArrowRightIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAppDesignerStore } from "../../../app-designer";

interface CredentialNodeInfo {
	nodeId: string;
	nodeName: string;
	n8nCredentialType: string;
	suggestedPiece: string | null;
	hasCredential: boolean;
}

/**
 * Import warning banner with expandable credential setup panel.
 * Shows after N8N import with a list of nodes needing credential configuration.
 * Clicking "Set up" on a row selects the node and opens the properties panel.
 */
export function ImportWarningBanner() {
	const [dismissed, setDismissed] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const nodes = useAppDesignerStore((s) => s.nodes);

	// Build credential info list
	const credentialNodes = useMemo<CredentialNodeInfo[]>(() => {
		const result: CredentialNodeInfo[] = [];
		for (const n of nodes) {
			if (n.type !== "operation") continue;
			const hint = (n as { credentialHint?: { n8nCredentialType: string; suggestedPiece: string | null } }).credentialHint;
			if (!hint) continue;
			const content = n.content as { credentialId?: string };
			result.push({
				nodeId: n.id,
				nodeName: n.name ?? "Untitled",
				n8nCredentialType: hint.n8nCredentialType,
				suggestedPiece: hint.suggestedPiece,
				hasCredential: !!content.credentialId,
			});
		}
		return result;
	}, [nodes]);

	// Count disabled nodes
	const disabledNodes = useMemo(
		() => nodes.filter((n) => n.type === "operation" && (n as { disabled?: boolean }).disabled).length,
		[nodes],
	);

	const configuredCount = credentialNodes.filter((n) => n.hasCredential).length;
	const totalCount = credentialNodes.length;

	const handleSetup = useCallback((nodeId: string) => {
		window.dispatchEvent(
			new CustomEvent("open-properties-panel", {
				detail: { nodeId },
			}),
		);
	}, []);

	// Only show if there's something to report
	const hasIssues = totalCount > 0 || disabledNodes > 0;

	if (dismissed || !hasIssues) {
		return null;
	}

	return (
		<div className="bg-amber-600/15 border-b border-amber-500/30 z-50">
			{/* Header row */}
			<div className="flex items-center gap-2 px-4 py-2">
				<AlertTriangleIcon className="size-4 text-amber-400 shrink-0" />
				<span className="text-[11px] text-amber-300 font-medium flex-1">
					Imported from N8N
					{totalCount > 0 && (
						<>
							{" \u2014 "}
							<span className="text-amber-200">{configuredCount} of {totalCount}</span> credentials configured
						</>
					)}
					{disabledNodes > 0 && (
						<>
							{totalCount > 0 ? ", " : " \u2014 "}
							{disabledNodes} node{disabledNodes > 1 ? "s" : ""} disabled
						</>
					)}
				</span>
				{totalCount > 0 && (
					<button
						type="button"
						onClick={() => setExpanded(!expanded)}
						className="text-amber-400 hover:text-amber-200 transition-colors flex items-center gap-1 text-[10px]"
					>
						{expanded ? "Hide" : "Show"}
						{expanded ? (
							<ChevronUpIcon className="size-3" />
						) : (
							<ChevronDownIcon className="size-3" />
						)}
					</button>
				)}
				<button
					type="button"
					onClick={() => setDismissed(true)}
					className="text-amber-400 hover:text-amber-200 transition-colors ml-1"
				>
					<XIcon className="size-3.5" />
				</button>
			</div>

			{/* Expandable credential list */}
			{expanded && totalCount > 0 && (
				<div className="px-4 pb-3 space-y-1">
					{credentialNodes.map((node) => {
						const pieceEntry = node.suggestedPiece ? getCatalogEntry(node.suggestedPiece) : null;
						const displayName = pieceEntry?.displayName ?? node.suggestedPiece ?? node.n8nCredentialType;
						return (
							<div
								key={node.nodeId}
								className="flex items-center gap-2 py-1.5 px-3 rounded bg-black/20 text-[11px]"
							>
								{node.hasCredential ? (
									<CheckCircle2Icon className="size-3.5 text-emerald-400 shrink-0" />
								) : (
									<CircleAlertIcon className="size-3.5 text-amber-400 shrink-0" />
								)}
								<span className="text-inverse/70 flex-1 truncate">
									<span className="font-medium text-inverse/90">{node.nodeName}</span>
									{" \u2014 "}
									{displayName}
								</span>
								<span className={`text-[10px] px-1.5 py-0.5 rounded-full ${node.hasCredential ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
									{node.hasCredential ? "Connected" : "Not configured"}
								</span>
								{!node.hasCredential && (
									<button
										type="button"
										onClick={() => handleSetup(node.nodeId)}
										className="text-[10px] text-amber-300 hover:text-amber-100 transition-colors flex items-center gap-0.5"
									>
										Set up
										<ArrowRightIcon className="size-3" />
									</button>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
