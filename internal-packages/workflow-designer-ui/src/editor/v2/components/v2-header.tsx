"use client";

import { DropdownMenu } from "@vibexe-internal/ui/dropdown-menu";
import { useFeatureFlag } from "@vibexe-ai/react";
import Avatar from "boring-avatars";
import clsx from "clsx/lite";
import { CheckIcon, ChevronDownIcon, DownloadIcon, HistoryIcon, LoaderIcon, Redo2Icon, SaveIcon, Undo2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
	useAppDesignerStore,
	useUndoRedoActions,
	useUpdateWorkspaceName,
} from "../../../app-designer";
import { VibexeIcon } from "../../../icons";
import { EditableText, type EditableTextRef } from "../../properties-panel/ui";
import { PublishToggle } from "./publish-toggle";
import { RunButton } from "./run-button";
import { type EditorTab, V2HeaderTabs } from "./v2-header-tabs";

export function V2Header({
	teamName,
	teamAvatarUrl,
	onNameChange,
	activeTab,
	onTabChange,
	onVersionsToggle,
}: {
	teamName?: string;
	teamAvatarUrl?: string | null;
	onNameChange?: (name: string) => Promise<void>;
	activeTab?: EditorTab;
	onTabChange?: (tab: EditorTab) => void;
	onVersionsToggle?: () => void;
}) {
	const { workspaceId, name } = useAppDesignerStore((s) => ({
		workspaceId: s.workspaceId,
		name: s.name,
	}));
	const updateWorkspaceName = useUpdateWorkspaceName();
	const editableTextRef = useRef<EditableTextRef>(null);
	const { layoutV3 } = useFeatureFlag();
	const { undo, redo, canUndo, canRedo } = useUndoRedoActions((s) => ({
		undo: s.undo,
		redo: s.redo,
		canUndo: s.canUndo,
		canRedo: s.canRedo,
	}));

	// Save status from persistence controller
	const [saveStatus, setSaveStatus] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
	useEffect(() => {
		const handler = (e: Event) => {
			setSaveStatus((e as CustomEvent).detail);
		};
		window.addEventListener("save-status", handler);
		return () => window.removeEventListener("save-status", handler);
	}, []);

	const handleUpdateName = async (value?: string) => {
		if (!value) return;
		updateWorkspaceName(value);
		await onNameChange?.(value);
	};

	return (
		<div
			className={clsx(
				"relative h-[48px] flex items-center justify-between",
				"pl-[8px] pr-[8px] gap-[8px]",
				"border-b border-white/10",
				"shrink-0",
			)}
		>
			{/* Left section: Logo + Team/App names */}
			<div className="flex items-center gap-[3px] min-w-0">
				<Link
					href="/"
					className="flex items-center gap-[3px] group"
					aria-label="Go to home"
				>
					<VibexeIcon className="text-inverse w-[24px] h-[24px] group-hover:text-primary-100 transition-colors" />
					<span className="text-inverse text-[13px] font-semibold group-hover:text-primary-100 transition-colors">
						Vibexe
					</span>
				</Link>
				<span className="text-inverse/20 text-[18px] font-[250] leading-none ml-[4px]">
					/
				</span>

				{/* Team / App names */}
				<div className="flex items-center gap-[3px] min-w-0">
					{teamName && (
						<Link
							href="/workspaces"
							className="flex items-center gap-[6px] overflow-hidden text-ellipsis whitespace-nowrap max-w-[160px] !pt-[2px] !pr-[8px] !pb-[2px] !pl-[12px] hover:opacity-80 transition-opacity"
						>
							{teamAvatarUrl ? (
								<div
									className="relative rounded-full overflow-hidden shrink-0"
									style={{ width: 16, height: 16 }}
								>
									<Image
										src={teamAvatarUrl}
										alt={teamName}
										fill
										sizes="16px"
										className="object-cover"
										style={{ objectPosition: "center" }}
									/>
								</div>
							) : (
								<div className="shrink-0" style={{ width: 16, height: 16 }}>
									<Avatar
										name={teamName}
										variant="marble"
										width={16}
										height={16}
										colors={[
											"#2563eb",
											"#7c3aed",
											"#dc2626",
											"#ea580c",
											"#16a34a",
										]}
									/>
								</div>
							)}
							<span className="text-inverse text-[14px] font-medium overflow-hidden text-ellipsis whitespace-nowrap">
								{teamName}
							</span>
						</Link>
					)}
					{teamName && (
						<span className="text-inverse/20 text-[18px] font-[250] leading-none ml-[4px]">
							/
						</span>
					)}
					{/* app name editable */}
					<div className="max-w-[300px]">
						<EditableText
							key={workspaceId}
							ref={editableTextRef}
							fallbackValue="Untitled"
							onChange={handleUpdateName}
							value={name}
							className="text-[#6B8FF0] font-medium"
						/>
					</div>
					{/* dropdown menu */}
					{layoutV3 && (
						<DropdownMenu
							items={[
								{
									value: "rename",
									label: "Rename",
									action: () => editableTextRef.current?.triggerEdit(),
								},
								{
									value: "duplicate",
									label: "Duplicate",
									action: () => {
										// TODO: Implement app duplication functionality
										console.warn("Duplicate functionality not yet implemented");
									},
								},
								{
									value: "versions",
									label: "Version History",
									action: () => onVersionsToggle?.(),
								},
								{
									value: "export",
									label: "Export as JSON",
									action: () => {
										if (workspaceId) {
											window.location.href = `/api/workspaces/${workspaceId}/export`;
										}
									},
								},
								{
									value: "template",
									label: "Create a Template",
									disabled: true,
								},
								{
									value: "delete",
									label: "Delete",
									action: () => {
										// TODO: Implement app deletion functionality
										console.warn("Delete functionality not yet implemented");
									},
									destructive: true,
								},
							]}
							trigger={
								<button
									type="button"
									className="ml-[4px] p-0 border-none bg-transparent w-auto h-auto hover:bg-transparent focus:bg-transparent outline-none"
								>
									<ChevronDownIcon className="size-[16px] text-[#6B8FF0] hover:text-inverse" />
								</button>
							}
							renderItem={(item) =>
								item.value === "template" ? (
									<div className="flex items-center justify-between w-full opacity-50">
										<span>{item.label}</span>
										<span className="ml-2 text-[10px] leading-none text-inverse bg-bg/30 px-1.5 py-[1px] rounded-full">
											Coming&nbsp;soon
										</span>
									</div>
								) : (
									<span className={item.destructive ? "text-error-900" : ""}>
										{item.label}
									</span>
								)
							}
							onSelect={(_event, item) => {
								if (!item.disabled && item.action) {
									item.action();
								}
							}}
							sideOffset={12}
							align="start"
						/>
					)}
				</div>
			</div>

			{/* Center section: Tabs */}
			{activeTab && onTabChange && layoutV3 && (
				<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
					<V2HeaderTabs activeTab={activeTab} onTabChange={onTabChange} />
				</div>
			)}

			{/* Right section: Undo/Redo + Publish toggle + Run button */}
			<div className="flex items-center gap-2">
				<div className="flex items-center gap-0.5 mr-1">
					<button
						type="button"
						onClick={undo}
						disabled={!canUndo()}
						title="Undo (Ctrl+Z)"
						className={clsx(
							"p-1.5 rounded transition-colors",
							canUndo()
								? "text-inverse/60 hover:text-inverse hover:bg-white/10 cursor-pointer"
								: "text-inverse/20 cursor-not-allowed",
						)}
					>
						<Undo2Icon className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={redo}
						disabled={!canRedo()}
						title="Redo (Ctrl+Shift+Z)"
						className={clsx(
							"p-1.5 rounded transition-colors",
							canRedo()
								? "text-inverse/60 hover:text-inverse hover:bg-white/10 cursor-pointer"
								: "text-inverse/20 cursor-not-allowed",
						)}
					>
						<Redo2Icon className="w-4 h-4" />
					</button>
				</div>
				{saveStatus !== "idle" && (
					<div className="flex items-center gap-1 text-[11px] text-inverse/40 mr-1 transition-opacity">
						{saveStatus === "saving" && (
							<>
								<LoaderIcon className="w-3 h-3 animate-spin" />
								<span>Saving...</span>
							</>
						)}
						{saveStatus === "saved" && (
							<>
								<CheckIcon className="w-3 h-3 text-green-400" />
								<span className="text-green-400">Saved</span>
							</>
						)}
						{saveStatus === "dirty" && (
							<span className="text-amber-400/60">Unsaved</span>
						)}
					</div>
				)}
				<PublishToggle />
				<RunButton />
			</div>
		</div>
	);
}
