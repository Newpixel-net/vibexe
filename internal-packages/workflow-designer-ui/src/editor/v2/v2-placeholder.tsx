"use client";

import { useFeatureFlag } from "@giselles-ai/react";
import { AlertTriangleIcon, CheckIcon, InfoIcon, Loader2Icon, SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useAppDesignerStore } from "../../app-designer";
import { RunHistoryTable } from "../run-history/run-history-table";
import { ReadOnlyBanner } from "../../ui/read-only-banner";
import { FloatingChat } from "../chat";
import { CommandPalette } from "../command-palette";
import { useAutoVersioning } from "../version-history/use-auto-versioning";
import { VersionPanel } from "../version-history/version-panel";
import { tourSteps, WorkspaceTour } from "../workspace-tour";
import { V2Container, V2Footer, V2Header } from "./components";
import type { EditorTab } from "./components/v2-header-tabs";
import { RootProvider } from "./components/provider";
import type { LeftPanelValue, V2LayoutState } from "./state";

/** Workflow-level settings panel (error workflow, etc.) */
function WorkflowSettingsPanel() {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const [localErrorWorkflowId, setLocalErrorWorkflowId] = useState("");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	// Fetch current settings on mount
	useEffect(() => {
		fetch(`/api/workspaces/${workspaceId}/settings`)
			.then((r) => r.json())
			.then((data) => {
				if (data.errorWorkflowId) setLocalErrorWorkflowId(data.errorWorkflowId);
			})
			.catch(() => {});
	}, [workspaceId]);

	const handleSave = useCallback(async () => {
		setSaving(true);
		setSaved(false);
		try {
			await fetch(`/api/workspaces/${workspaceId}/settings`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ errorWorkflowId: localErrorWorkflowId || null }),
			});
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} catch {
			// silently fail
		} finally {
			setSaving(false);
		}
	}, [workspaceId, localErrorWorkflowId]);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2">
				<SettingsIcon className="size-5 text-inverse/60" />
				<h2 className="text-[16px] font-semibold text-inverse">Workflow Settings</h2>
			</div>

			{/* Error Workflow */}
			<div className="rounded-lg border border-inverse/10 bg-inverse/[0.03] p-4 space-y-3">
				<div className="flex items-center gap-2">
					<AlertTriangleIcon className="size-4 text-amber-400" />
					<h3 className="text-[13px] font-medium text-inverse">Error Workflow</h3>
				</div>
				<p className="text-[12px] text-inverse/50 leading-relaxed">
					When this workflow fails, the error workflow will be triggered automatically
					with the error context (error message, failed node, timestamp).
				</p>
				<div className="flex items-center gap-3">
					<input
						type="text"
						value={localErrorWorkflowId}
						onChange={(e) => setLocalErrorWorkflowId(e.target.value)}
						placeholder="Enter workspace ID of error workflow (e.g. wrks_...)"
						className="flex-1 px-3 py-2 text-[12px] rounded-md bg-inverse/5 border border-inverse/10 text-inverse placeholder:text-inverse/30 outline-none focus:border-primary/40"
					/>
					<button
						type="button"
						onClick={handleSave}
						disabled={saving}
						className="px-4 py-2 text-[12px] font-medium rounded-md bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50 transition-colors flex items-center gap-1.5"
					>
						{saving ? (
							<Loader2Icon className="size-3 animate-spin" />
						) : saved ? (
							<CheckIcon className="size-3" />
						) : null}
						{saved ? "Saved" : "Save"}
					</button>
				</div>
				<div className="flex items-start gap-2 text-[11px] text-inverse/40">
					<InfoIcon className="size-3 mt-0.5 shrink-0" />
					<span>
						The error workflow should have an Error Trigger node to receive error data.
						You can find the workspace ID in the URL when editing the workflow.
					</span>
				</div>
			</div>
		</div>
	);
}

export function V2Placeholder({
	isReadOnly = false,
	userRole = "viewer",
	onNameChange,
	teamName,
	teamAvatarUrl,
}: {
	isReadOnly?: boolean;
	userRole?: "viewer" | "guest" | "editor" | "owner";
	onNameChange?: (name: string) => Promise<void>;
	teamName?: string;
	teamAvatarUrl?: string | null;
}) {
	const defaultTour = useAppDesignerStore(
		useShallow((s) => s.nodes.length === 0),
	);
	const [showReadOnlyBanner, setShowReadOnlyBanner] = useState(isReadOnly);
	const [layoutState, setLayoutState] = useState<V2LayoutState>({
		leftPanel: null,
	});
	const [isTourOpen, setIsTourOpen] = useState(defaultTour);
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [isVersionPanelOpen, setIsVersionPanelOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<EditorTab>("editor");

	const handleDismissBanner = useCallback(() => {
		setShowReadOnlyBanner(false);
	}, []);

	const handleLeftPanelValueChange = useCallback(
		(newLeftPanelValue: LeftPanelValue) => {
			setLayoutState((prev) => ({
				...prev,
				leftPanel:
					prev.leftPanel === newLeftPanelValue ? null : newLeftPanelValue,
			}));
		},
		[],
	);

	const handleChatToggle = useCallback(() => {
		setIsChatOpen((prev) => !prev);
	}, []);

	const handleLeftPanelClose = useCallback(() => {
		setLayoutState((prev) => ({
			...prev,
			leftPanel: null,
		}));
	}, []);

	const handleChatClose = useCallback(() => {
		setIsChatOpen(false);
	}, []);

	const handleVersionsToggle = useCallback(() => {
		setIsVersionPanelOpen((prev) => !prev);
	}, []);

	// Auto-create version snapshots every 10 minutes while editing
	useAutoVersioning();

	const { layoutV3 } = useFeatureFlag();

	return (
		<div className="flex-1 overflow-hidden font-sans flex flex-col">
			{showReadOnlyBanner && isReadOnly && (
				<ReadOnlyBanner
					onDismiss={handleDismissBanner}
					userRole={userRole}
					className="z-50"
				/>
			)}

			<RootProvider>
				<V2Header
					onNameChange={onNameChange}
					teamName={teamName}
					teamAvatarUrl={teamAvatarUrl}
					activeTab={activeTab}
					onTabChange={setActiveTab}
					onVersionsToggle={handleVersionsToggle}
				/>
				{layoutV3 ? (
					<>
						{activeTab === "editor" && (
							<V2Container
								{...layoutState}
								onLeftPanelClose={handleLeftPanelClose}
							/>
						)}
						{activeTab === "executions" && (
							<main className="relative flex-1 bg-bg overflow-hidden">
								<div className="h-full overflow-y-auto p-4">
									<RunHistoryTable />
								</div>
							</main>
						)}
						{activeTab === "settings" && (
							<main className="relative flex-1 bg-bg overflow-hidden">
								<div className="h-full overflow-y-auto p-6 max-w-[600px]">
									<WorkflowSettingsPanel />
								</div>
							</main>
						)}
						{activeTab === "sharing" && (
							<main className="relative flex-1 bg-bg overflow-hidden">
								<div className="h-full flex items-center justify-center">
									<div className="text-center">
										<p className="text-inverse/60 text-[14px]">
											Sharing settings coming soon
										</p>
										<p className="text-inverse/30 text-[12px] mt-1">
											Manage team access and permissions
										</p>
									</div>
								</div>
							</main>
						)}
						{activeTab === "editor" && (
							<V2Footer
								onLeftPanelValueChange={handleLeftPanelValueChange}
								activePanel={layoutState.leftPanel}
								chat={{ onToggle: handleChatToggle, isOpen: isChatOpen }}
							/>
						)}
					</>
				) : (
					<V2Container
						{...layoutState}
						onLeftPanelClose={handleLeftPanelClose}
					/>
				)}
				{isVersionPanelOpen && (
					<div className="fixed inset-0 z-[999] flex justify-end">
						<div
							className="flex-1"
							onClick={() => setIsVersionPanelOpen(false)}
							onKeyDown={() => {}}
							role="button"
							tabIndex={-1}
						/>
						<VersionPanel onClose={() => setIsVersionPanelOpen(false)} />
					</div>
				)}
				<CommandPalette />
			</RootProvider>
			<WorkspaceTour
				steps={tourSteps}
				isOpen={isTourOpen}
				onOpenChange={setIsTourOpen}
			/>
			<FloatingChat isOpen={isChatOpen} onClose={handleChatClose} />
		</div>
	);
}
