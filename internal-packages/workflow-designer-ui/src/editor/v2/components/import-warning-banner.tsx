"use client";

import { getCatalogEntry } from "@giselles-ai/activepieces-adapter";
import { XIcon, AlertTriangleIcon, ChevronDownIcon, ChevronUpIcon, CheckCircle2Icon, CircleAlertIcon, ArrowRightIcon, PackageXIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDesignerStore } from "../../../app-designer";

interface CredentialNodeInfo {
	nodeId: string;
	nodeName: string;
	n8nCredentialType: string;
	suggestedPiece: string | null;
	hasCredential: boolean;
}

interface UnsupportedNodeInfo {
	nodeId: string;
	nodeName: string;
}

interface CredentialGroup {
	key: string;
	displayName: string;
	nodes: CredentialNodeInfo[];
	allConfigured: boolean;
	configuredCount: number;
}

interface ImportSummary {
	nodeCount: number;
	connectionCount: number;
	credentialsNeeded: number;
	hasFlowControl: boolean;
	warningCount: number;
}

/**
 * Import warning banner with expandable credential setup panel.
 * Shows after N8N import with a list of nodes needing credential configuration
 * and unsupported/community nodes that were imported as disabled placeholders.
 * Clicking "Set up" on a row selects the node and opens the properties panel.
 */
export function ImportWarningBanner() {
	const [dismissed, setDismissed] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [autoExpanded, setAutoExpanded] = useState(false);
	const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
	const nodes = useAppDesignerStore((s) => s.nodes);
	const connections = useAppDesignerStore((s) => s.connections);

	// Read import summary from sessionStorage on mount
	useEffect(() => {
		try {
			const raw = sessionStorage.getItem("n8n-import-summary");
			if (raw) {
				sessionStorage.removeItem("n8n-import-summary");
				setImportSummary(JSON.parse(raw));
			}
		} catch {
			// Ignore parse errors
		}
	}, []);

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

	// Auto-expand on first render when there are unconfigured credentials
	useEffect(() => {
		if (!autoExpanded && credentialNodes.some(n => !n.hasCredential)) {
			setExpanded(true);
			setAutoExpanded(true);
		}
	}, [credentialNodes, autoExpanded]);

	// Group credentials by type
	const credentialGroups = useMemo<CredentialGroup[]>(() => {
		const map = new Map<string, CredentialNodeInfo[]>();
		for (const node of credentialNodes) {
			const key = node.suggestedPiece ?? node.n8nCredentialType;
			const list = map.get(key) ?? [];
			list.push(node);
			map.set(key, list);
		}
		return Array.from(map.entries()).map(([key, groupNodes]) => {
			const configuredCount = groupNodes.filter(n => n.hasCredential).length;
			const pieceEntry = groupNodes[0].suggestedPiece ? getCatalogEntry(groupNodes[0].suggestedPiece) : null;
			return {
				key,
				displayName: pieceEntry?.displayName ?? key,
				nodes: groupNodes,
				allConfigured: configuredCount === groupNodes.length,
				configuredCount,
			};
		});
	}, [credentialNodes]);

	// Detect unsupported/placeholder nodes (name ends with "(unsupported)" and disabled)
	const unsupportedNodes = useMemo<UnsupportedNodeInfo[]>(() => {
		const result: UnsupportedNodeInfo[] = [];
		for (const n of nodes) {
			if (n.type !== "operation") continue;
			const name = n.name ?? "";
			const isDisabled = (n as { disabled?: boolean }).disabled;
			if (isDisabled && name.endsWith("(unsupported)")) {
				result.push({
					nodeId: n.id,
					nodeName: name.replace(" (unsupported)", ""),
				});
			}
		}
		return result;
	}, [nodes]);

	// Count disabled nodes (excluding unsupported placeholders)
	const disabledNodes = useMemo(
		() => nodes.filter((n) => {
			if (n.type !== "operation") return false;
			const isDisabled = (n as { disabled?: boolean }).disabled;
			const name = n.name ?? "";
			return isDisabled && !name.endsWith("(unsupported)");
		}).length,
		[nodes],
	);

	const configuredCount = credentialNodes.filter((n) => n.hasCredential).length;
	const totalCredentials = credentialNodes.length;
	const totalUnsupported = unsupportedNodes.length;

	// Counts from store (always available)
	const operationNodeCount = nodes.filter(n => n.type === "operation").length;
	const connectionCount = connections?.length ?? 0;

	// Use import summary counts if available, otherwise fall back to store
	const displayNodeCount = importSummary?.nodeCount ?? operationNodeCount;
	const displayConnectionCount = importSummary?.connectionCount ?? connectionCount;

	const handleSetup = useCallback((nodeId: string) => {
		window.dispatchEvent(
			new CustomEvent("open-properties-panel", {
				detail: { nodeId },
			}),
		);
	}, []);

	const handleSetupGroup = useCallback((group: CredentialGroup) => {
		// Open properties panel for the first unconfigured node in the group
		const firstUnconfigured = group.nodes.find(n => !n.hasCredential);
		if (firstUnconfigured) {
			handleSetup(firstUnconfigured.nodeId);
		}
	}, [handleSetup]);

	// Only show if there's something to report
	const hasIssues = totalCredentials > 0 || disabledNodes > 0 || totalUnsupported > 0;

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
					{" \u2014 "}
					<span className="text-amber-200/70">{displayNodeCount} node{displayNodeCount !== 1 ? "s" : ""}, {displayConnectionCount} connection{displayConnectionCount !== 1 ? "s" : ""}</span>
					{totalUnsupported > 0 && (
						<>
							{" \u2014 "}
							<span className="text-orange-300">{totalUnsupported} node{totalUnsupported > 1 ? "s" : ""}</span> could not be fully imported
						</>
					)}
					{totalCredentials > 0 && (
						<>
							{totalUnsupported > 0 ? ", " : " \u2014 "}
							<span className="text-amber-200">{configuredCount} of {totalCredentials}</span> credentials configured
						</>
					)}
					{disabledNodes > 0 && (
						<>
							{(totalCredentials > 0 || totalUnsupported > 0) ? ", " : " \u2014 "}
							{disabledNodes} node{disabledNodes > 1 ? "s" : ""} disabled
						</>
					)}
				</span>
				{(totalCredentials > 0 || totalUnsupported > 0) && (
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

			{/* Expandable details */}
			{expanded && (
				<div className="px-4 pb-3 space-y-2">
					{/* Unsupported nodes section */}
					{totalUnsupported > 0 && (
						<div className="space-y-1">
							<div className="text-[10px] text-orange-400 font-medium uppercase tracking-wider">
								Unsupported Nodes ({totalUnsupported})
							</div>
							{unsupportedNodes.map((node) => (
								<div
									key={node.nodeId}
									className="flex items-center gap-2 py-1.5 px-3 rounded bg-orange-500/10 text-[11px]"
								>
									<PackageXIcon className="size-3.5 text-orange-400 shrink-0" />
									<span className="text-inverse/70 flex-1 truncate">
										<span className="font-medium text-inverse/90">{node.nodeName}</span>
									</span>
									<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
										Placeholder
									</span>
								</div>
							))}
						</div>
					)}

					{/* Credential groups section */}
					{totalCredentials > 0 && (
						<div className="space-y-1">
							{totalUnsupported > 0 && (
								<div className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">
									Credentials ({totalCredentials})
								</div>
							)}
							{credentialGroups.map((group) => (
								<CredentialGroupRow
									key={group.key}
									group={group}
									onSetup={handleSetup}
									onSetupGroup={handleSetupGroup}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function CredentialGroupRow({
	group,
	onSetup,
	onSetupGroup,
}: {
	group: CredentialGroup;
	onSetup: (nodeId: string) => void;
	onSetupGroup: (group: CredentialGroup) => void;
}) {
	const [groupExpanded, setGroupExpanded] = useState(false);
	const isSingleNode = group.nodes.length === 1;

	// Single-node groups render inline (no expand)
	if (isSingleNode) {
		const node = group.nodes[0];
		return (
			<div className="flex items-center gap-2 py-1.5 px-3 rounded bg-black/20 text-[11px]">
				{node.hasCredential ? (
					<CheckCircle2Icon className="size-3.5 text-emerald-400 shrink-0" />
				) : (
					<CircleAlertIcon className="size-3.5 text-amber-400 shrink-0" />
				)}
				<span className="text-inverse/70 flex-1 truncate">
					<span className="font-medium text-inverse/90">{group.displayName}</span>
					{" \u2014 "}
					{node.nodeName}
				</span>
				<span className={`text-[10px] px-1.5 py-0.5 rounded-full ${node.hasCredential ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
					{node.hasCredential ? "Connected" : "Not configured"}
				</span>
				{!node.hasCredential && (
					<button
						type="button"
						onClick={() => onSetup(node.nodeId)}
						className="text-[10px] text-amber-300 hover:text-amber-100 transition-colors flex items-center gap-0.5"
					>
						Set up
						<ArrowRightIcon className="size-3" />
					</button>
				)}
			</div>
		);
	}

	// Multi-node groups: collapsible with summary
	return (
		<div className="rounded bg-black/20">
			<div
				className="flex items-center gap-2 py-1.5 px-3 text-[11px] cursor-pointer hover:bg-white/5 transition-colors rounded"
				onClick={() => setGroupExpanded(!groupExpanded)}
				onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setGroupExpanded(!groupExpanded); }}
				tabIndex={0}
				role="button"
			>
				{group.allConfigured ? (
					<CheckCircle2Icon className="size-3.5 text-emerald-400 shrink-0" />
				) : (
					<CircleAlertIcon className="size-3.5 text-amber-400 shrink-0" />
				)}
				<span className="text-inverse/70 flex-1 truncate">
					<span className="font-medium text-inverse/90">{group.displayName}</span>
					{" \u2014 "}
					{group.nodes.length} node{group.nodes.length > 1 ? "s" : ""}
				</span>
				<span className={`text-[10px] px-1.5 py-0.5 rounded-full ${group.allConfigured ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
					{group.configuredCount} of {group.nodes.length}
				</span>
				{!group.allConfigured && (
					<button
						type="button"
						onClick={(e) => { e.stopPropagation(); onSetupGroup(group); }}
						className="text-[10px] text-amber-300 hover:text-amber-100 transition-colors flex items-center gap-0.5"
					>
						Set up first
						<ArrowRightIcon className="size-3" />
					</button>
				)}
				{groupExpanded ? (
					<ChevronUpIcon className="size-3 text-inverse/40 shrink-0" />
				) : (
					<ChevronDownIcon className="size-3 text-inverse/40 shrink-0" />
				)}
			</div>

			{/* Individual nodes within the group */}
			{groupExpanded && (
				<div className="px-3 pb-2 space-y-1">
					{group.nodes.map((node) => (
						<div
							key={node.nodeId}
							className="flex items-center gap-2 py-1 px-2 rounded bg-black/15 text-[10px]"
						>
							{node.hasCredential ? (
								<CheckCircle2Icon className="size-3 text-emerald-400 shrink-0" />
							) : (
								<CircleAlertIcon className="size-3 text-amber-400 shrink-0" />
							)}
							<span className="text-inverse/60 flex-1 truncate">{node.nodeName}</span>
							{!node.hasCredential && (
								<button
									type="button"
									onClick={() => onSetup(node.nodeId)}
									className="text-[10px] text-amber-300 hover:text-amber-100 transition-colors flex items-center gap-0.5"
								>
									Set up
									<ArrowRightIcon className="size-2.5" />
								</button>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
