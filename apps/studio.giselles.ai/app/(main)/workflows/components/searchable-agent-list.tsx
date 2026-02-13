"use client";

import { ChevronRightIcon, File, FolderIcon, FolderOpenIcon, FolderPlusIcon, PencilIcon, TagIcon, Trash2Icon, XIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { agents as dbAgents } from "@/db";
import { GitHubIcon } from "../../../../../../internal-packages/workflow-designer-ui/src/icons";
import { Card } from "../../settings/components/card";
import { createFolder, deleteFolder, moveAgentToFolder, renameFolder } from "../actions";
import { AgentCard } from "./agent-card";
import { AppListItem } from "./app-list-item";
import { LLMProviderIcon } from "./llm-provider-icon";
import { SearchHeader } from "./search-header";

type SortOption = "name-asc" | "name-desc" | "date-desc" | "date-asc";
type ViewMode = "grid" | "list";
type PublishFilter = "all" | "published" | "draft";

type FolderData = { id: string; name: string; parentId: string | null };

type AgentWithMetadata = typeof dbAgents.$inferSelect & {
	executionCount: number;
	creator: {
		displayName: string | null;
		avatarUrl: string | null;
	} | null;
	githubRepositories: string[];
	documentVectorStoreFiles: string[];
	llmProviders: string[];
	hasGithubIntegration: boolean;
	tags: string[];
	isPublished: boolean;
};

export function SearchableAgentList({
	agents,
	folders: initialFolders = [],
}: {
	agents: AgentWithMetadata[];
	folders?: FolderData[];
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const [sortOption, setSortOption] = useState<SortOption>("date-desc");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [publishFilter, setPublishFilter] = useState<PublishFilter>("all");
	const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
	const [folders, setFolders] = useState<FolderData[]>(initialFolders);
	const [creatingFolder, setCreatingFolder] = useState(false);
	const [folderDraft, setFolderDraft] = useState("");
	const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
	const [renameDraft, setRenameDraft] = useState("");

	const handleCreateFolder = useCallback(async () => {
		const trimmed = folderDraft.trim();
		if (!trimmed) { setCreatingFolder(false); return; }
		const res = await createFolder(trimmed);
		if (res.result === "success") {
			setFolders((prev) => [...prev, { id: res.folder.id, name: res.folder.name, parentId: null }]);
		}
		setFolderDraft("");
		setCreatingFolder(false);
	}, [folderDraft]);

	const handleRenameFolder = useCallback(async (fId: string) => {
		const trimmed = renameDraft.trim();
		if (!trimmed) { setRenamingFolderId(null); return; }
		await renameFolder(fId, trimmed);
		setFolders((prev) => prev.map((f) => f.id === fId ? { ...f, name: trimmed } : f));
		setRenamingFolderId(null);
		setRenameDraft("");
	}, [renameDraft]);

	const handleDeleteFolder = useCallback(async (fId: string) => {
		await deleteFolder(fId);
		setFolders((prev) => prev.filter((f) => f.id !== fId));
		if (selectedFolderId === fId) setSelectedFolderId(null);
	}, [selectedFolderId]);

	const handleMoveToFolder = useCallback(async (agentId: string, fId: string | null) => {
		await moveAgentToFolder(agentId, fId);
	}, []);

	// Gather all unique tags across all agents
	const allTags = useMemo(() => {
		const tagSet = new Set<string>();
		for (const agent of agents) {
			for (const tag of agent.tags ?? []) {
				tagSet.add(tag);
			}
		}
		return [...tagSet].sort();
	}, [agents]);

	const toggleTag = (tag: string) => {
		setSelectedTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
		);
	};

	// Filter agents based on search query, tags, publish state, and folder
	const filteredAgents = useMemo(() => {
		return agents.filter((agent) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const agentName = agent.name?.toLowerCase() || "";
				const matchesTags = (agent.tags ?? []).some((t) => t.toLowerCase().includes(query));
				if (!agentName.includes(query) && !matchesTags) return false;
			}

			// Tag filter (agent must have ALL selected tags)
			if (selectedTags.length > 0) {
				const agentTags = agent.tags ?? [];
				if (!selectedTags.every((t) => agentTags.includes(t))) return false;
			}

			// Publish filter
			if (publishFilter === "published" && !agent.isPublished) return false;
			if (publishFilter === "draft" && agent.isPublished) return false;

			// Folder filter
			if (selectedFolderId !== null) {
				if ((agent as any).folderId !== selectedFolderId) return false;
			}

			return true;
		});
	}, [agents, searchQuery, selectedTags, publishFilter, selectedFolderId]);

	// Sort agents based on selected option
	const sortedAgents = useMemo(() => {
		return [...filteredAgents].sort((a, b) => {
			switch (sortOption) {
				case "name-asc":
					return (a.name || "").localeCompare(b.name || "");
				case "name-desc":
					return (b.name || "").localeCompare(a.name || "");
				case "date-desc":
					return b.updatedAt.getTime() - a.updatedAt.getTime();
				case "date-asc":
					return a.updatedAt.getTime() - b.updatedAt.getTime();
				default:
					return 0;
			}
		});
	}, [filteredAgents, sortOption]);

	return (
		<>
			<SearchHeader
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				searchPlaceholder="Search Workflows..."
				sortOption={sortOption}
				onSortChange={(value) => setSortOption(value as SortOption)}
				showViewToggle
				viewMode={viewMode}
				onViewModeChange={setViewMode}
			/>

			{/* Tag filter bar + Publish filter + Folder breadcrumb */}
			{(allTags.length > 0 || true) && (
				<div className="flex items-center gap-2 px-1 pb-3 flex-wrap">
					{/* Publish filter */}
					<div className="flex items-center rounded-md border border-border-muted overflow-hidden mr-2">
						{(["all", "published", "draft"] as PublishFilter[]).map((f) => (
							<button
								key={f}
								type="button"
								onClick={() => setPublishFilter(f)}
								className={`px-3 py-1 text-[11px] font-medium capitalize transition-colors ${
									publishFilter === f
										? "bg-primary/10 text-primary"
										: "text-text/50 hover:text-text/70"
								}`}
							>
								{f}
							</button>
						))}
					</div>

					{/* Tag chips */}
					{allTags.map((tag) => (
						<button
							key={tag}
							type="button"
							onClick={() => toggleTag(tag)}
							className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
								selectedTags.includes(tag)
									? "bg-primary/20 text-primary border border-primary/30"
									: "bg-surface-variant text-text/50 border border-border-muted hover:text-text/70"
							}`}
						>
							<TagIcon className="size-3" />
							{tag}
							{selectedTags.includes(tag) && (
								<XIcon className="size-3 ml-0.5" />
							)}
						</button>
					))}

					{selectedTags.length > 0 && (
						<button
							type="button"
							onClick={() => setSelectedTags([])}
							className="text-[10px] text-text/40 hover:text-text/60 underline"
						>
							Clear tags
						</button>
					)}
				</div>
			)}

			<div className="flex gap-4">
				{/* Folder sidebar */}
				{folders.length > 0 && (
					<div className="w-[180px] shrink-0 flex flex-col gap-1">
						<button
							type="button"
							onClick={() => setSelectedFolderId(null)}
							className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
								selectedFolderId === null
									? "bg-primary/10 text-primary"
									: "text-text/60 hover:text-text/80 hover:bg-surface-variant"
							}`}
						>
							<FolderOpenIcon className="size-3.5" />
							All Workflows
						</button>
						{folders.map((folder) => (
							<div key={folder.id} className="group flex items-center">
								{renamingFolderId === folder.id ? (
									<input
										type="text"
										value={renameDraft}
										onChange={(e) => setRenameDraft(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") handleRenameFolder(folder.id);
											if (e.key === "Escape") setRenamingFolderId(null);
										}}
										onBlur={() => handleRenameFolder(folder.id)}
										autoFocus
										className="flex-1 px-2 py-1 text-[12px] rounded bg-white/5 border border-white/10 text-inverse outline-none"
									/>
								) : (
									<button
										type="button"
										onClick={() => setSelectedFolderId(folder.id)}
										className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors text-left ${
											selectedFolderId === folder.id
												? "bg-primary/10 text-primary"
												: "text-text/60 hover:text-text/80 hover:bg-surface-variant"
										}`}
									>
										<FolderIcon className="size-3.5" />
										<span className="truncate">{folder.name}</span>
									</button>
								)}
								<div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
									<button
										type="button"
										onClick={() => { setRenamingFolderId(folder.id); setRenameDraft(folder.name); }}
										className="p-0.5 rounded hover:bg-white/10"
										title="Rename"
									>
										<PencilIcon className="size-2.5 text-text/40" />
									</button>
									<button
										type="button"
										onClick={() => handleDeleteFolder(folder.id)}
										className="p-0.5 rounded hover:bg-white/10"
										title="Delete folder"
									>
										<Trash2Icon className="size-2.5 text-red-400/60" />
									</button>
								</div>
							</div>
						))}
						{creatingFolder ? (
							<input
								type="text"
								value={folderDraft}
								onChange={(e) => setFolderDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleCreateFolder();
									if (e.key === "Escape") { setCreatingFolder(false); setFolderDraft(""); }
								}}
								onBlur={handleCreateFolder}
								placeholder="Folder name"
								autoFocus
								className="px-2 py-1 text-[12px] rounded bg-white/5 border border-white/10 text-inverse outline-none"
							/>
						) : (
							<button
								type="button"
								onClick={() => setCreatingFolder(true)}
								className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-text/40 hover:text-text/60 transition-colors"
							>
								<FolderPlusIcon className="size-3.5" />
								New Folder
							</button>
						)}
					</div>
				)}

				{/* If no folders exist, show "New Folder" button inline */}
				{folders.length === 0 && (
					<div className="w-[180px] shrink-0 flex flex-col gap-1">
						{creatingFolder ? (
							<input
								type="text"
								value={folderDraft}
								onChange={(e) => setFolderDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleCreateFolder();
									if (e.key === "Escape") { setCreatingFolder(false); setFolderDraft(""); }
								}}
								onBlur={handleCreateFolder}
								placeholder="Folder name"
								autoFocus
								className="px-2 py-1 text-[12px] rounded bg-white/5 border border-white/10 text-inverse outline-none"
							/>
						) : (
							<button
								type="button"
								onClick={() => setCreatingFolder(true)}
								className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-text/40 hover:text-text/60 transition-colors"
							>
								<FolderPlusIcon className="size-3.5" />
								New Folder
							</button>
						)}
					</div>
				)}

				{/* Main content */}
				<div className="flex-1 min-w-0">
			{sortedAgents.length === 0 ? (
				<div className="flex justify-center items-center h-full mt-12">
					<div className="grid gap-[8px] justify-center text-center">
						<h3 className="text-[18px] font-geist font-bold text-text/60">
							No workflows found.
						</h3>
						<p className="text-[12px] font-geist text-text/60">
							{searchQuery || selectedTags.length > 0 || publishFilter !== "all"
								? "Try adjusting your filters."
								: "Create a new workflow with the 'New Workflow +' button."}
						</p>
					</div>
				</div>
			) : viewMode === "grid" ? (
				<div className="relative grid h-full w-full grid-cols-[repeat(auto-fill,minmax(267px,1fr))] gap-4">
					{sortedAgents.map((agent) => (
						<AgentCard key={agent.id} agent={agent} />
					))}
				</div>
			) : (
				<Card className="!flex !flex-col gap-0 py-2">
					{/* Table Header */}
					<div className="grid grid-cols-[2fr_1fr_1.5fr_1fr_auto] items-center gap-4 px-2 py-2 border-b-[0.5px] border-border-muted">
						<p className="text-[12px] font-geist font-semibold text-text/60 uppercase tracking-wide">
							Name
						</p>
						<p className="text-[12px] font-geist font-semibold text-text/60 uppercase tracking-wide">
							Integration
						</p>
						<p className="text-[12px] font-geist font-semibold text-text/60 uppercase tracking-wide">
							Connected
						</p>
						<p className="text-[12px] font-geist font-semibold text-text/60 uppercase tracking-wide">
							Builder
						</p>
						<p className="text-[12px] font-geist font-semibold text-text/60 uppercase tracking-wide">
							Runs
						</p>
					</div>
					{sortedAgents.map((agent) => {
						if (!agent.workspaceId) return null;
						return (
							<AppListItem
								key={agent.id}
								href={`/workflows/${agent.workspaceId}`}
								title={agent.name || "Untitled"}
								subtitle={`Edited ${agent.updatedAt.toLocaleDateString()}`}
								creator={
									agent.metadata.sample
										? "Giselle Team"
										: agent.creator?.displayName || null
								}
								githubRepositories={agent.githubRepositories}
								documentVectorStoreFiles={agent.documentVectorStoreFiles}
								executionCount={agent.executionCount}
								agentId={agent.id}
								agentName={agent.name || "Untitled"}
								integrationIcons={
									<>
										{agent.llmProviders?.map((provider) => (
											<LLMProviderIcon
												key={provider}
												provider={provider}
												className="w-4 h-4"
											/>
										))}
										{agent.hasGithubIntegration && (
											<GitHubIcon className="w-4 h-4 text-text/60" />
										)}
										{agent.documentVectorStoreFiles &&
											agent.documentVectorStoreFiles.length > 0 && (
												<File className="w-4 h-4 text-text/60" />
											)}
									</>
								}
							/>
						);
					})}
				</Card>
			)}
				</div>
			</div>
		</>
	);
}
