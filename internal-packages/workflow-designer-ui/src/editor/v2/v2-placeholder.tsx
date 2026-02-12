"use client";

import { useFeatureFlag } from "@giselles-ai/react";
import { useCallback, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useAppDesignerStore } from "../../app-designer";
import { RunHistoryTable } from "../run-history/run-history-table";
import { ReadOnlyBanner } from "../../ui/read-only-banner";
import { FloatingChat } from "../chat";
import { CommandPalette } from "../command-palette";
import { VersionPanel } from "../version-history/version-panel";
import { tourSteps, WorkspaceTour } from "../workspace-tour";
import { V2Container, V2Footer, V2Header } from "./components";
import type { EditorTab } from "./components/v2-header-tabs";
import { RootProvider } from "./components/provider";
import type { LeftPanelValue, V2LayoutState } from "./state";

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
