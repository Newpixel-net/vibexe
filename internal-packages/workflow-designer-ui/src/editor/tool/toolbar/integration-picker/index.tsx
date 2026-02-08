"use client";

import {
	type PieceCatalogEntry,
	type PieceCategory,
	PIECE_CATALOG,
	getAllCategories,
	getPiecesByCategory,
	searchPieces,
} from "@giselles-ai/activepieces-adapter";
import {
	createActionNode,
	createIntegrationNode,
	createTriggerNode,
} from "@giselles-ai/node-registry";
import {
	ArrowLeftIcon,
	ChevronRightIcon,
	LoaderIcon,
	SearchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { GitHubIcon } from "../components";
import { addNodeTool, useToolbar } from "../state";
import { PieceIcon } from "./piece-icon";
import { usePieceActions, type PieceActionInfo } from "./use-piece-actions";

// Navigation state
type PickerView =
	| { level: "categories" }
	| { level: "pieces"; category: PieceCategory }
	| { level: "actions"; piece: PieceCatalogEntry };

export function IntegrationPicker() {
	const { setSelectedTool } = useToolbar();
	const [view, setView] = useState<PickerView>({ level: "categories" });
	const [searchQuery, setSearchQuery] = useState("");

	const categories = useMemo(() => getAllCategories(), []);

	const categoryCounts = useMemo(() => {
		const counts: Partial<Record<PieceCategory, number>> = {};
		for (const cat of categories) {
			counts[cat] = getPiecesByCategory(cat).length;
		}
		return counts;
	}, [categories]);

	const searchResults = useMemo(() => {
		if (!searchQuery.trim()) return null;
		return searchPieces(searchQuery);
	}, [searchQuery]);

	// Fetch actions when viewing a specific piece
	const activePieceName =
		view.level === "actions" ? view.piece.name : null;
	const {
		actions: pieceActions,
		version: pieceVersion,
		loading: actionsLoading,
	} = usePieceActions(activePieceName);

	const handleSelectPiece = (piece: PieceCatalogEntry) => {
		// Navigate to actions view to show available actions
		setView({ level: "actions", piece });
	};

	const handleSelectAction = (
		piece: PieceCatalogEntry,
		action: PieceActionInfo,
		version: string,
	) => {
		setSelectedTool(
			addNodeTool(
				createIntegrationNode({
					pieceName: piece.name,
					actionName: action.name,
					pieceVersion: version,
				}),
			),
		);
	};

	const handleSelectPieceDefault = (piece: PieceCatalogEntry) => {
		// Fallback: create with "default" action if actions can't be loaded
		setSelectedTool(
			addNodeTool(
				createIntegrationNode({
					pieceName: piece.name,
					actionName: "default",
					pieceVersion: pieceVersion ?? "0.0.1",
				}),
			),
		);
	};

	const handleBack = () => {
		setSearchQuery("");
		if (view.level === "actions") {
			const piece = view.piece;
			setView({ level: "pieces", category: piece.category });
		} else if (view.level === "pieces") {
			setView({ level: "categories" });
		}
	};

	// Render header
	const renderHeader = () => {
		const showBack = view.level !== "categories";
		const title =
			view.level === "categories"
				? "Integrations"
				: view.level === "pieces"
					? view.category
					: view.piece.displayName;

		return (
			<div className="flex flex-col gap-[8px] px-[8px] pb-[4px]">
				<div className="flex items-center gap-[8px]">
					{showBack && (
						<button
							type="button"
							onClick={handleBack}
							className="p-[2px] rounded-[4px] hover:bg-[rgba(222,233,242,0.10)] text-inverse"
						>
							<ArrowLeftIcon className="size-[16px]" />
						</button>
					)}
					<p className="text-[14px] font-medium text-inverse">{title}</p>
					<span className="text-[11px] text-[#505D7B] ml-auto">
						{PIECE_CATALOG.length}+ integrations
					</span>
				</div>
				{view.level !== "actions" && (
					<div className="flex h-[28px] p-[8px] items-center gap-[8px] self-stretch rounded-[8px] bg-[rgba(222,233,242,0.20)]">
						<SearchIcon className="size-[14px] text-[#505D7B] shrink-0" />
						<input
							type="text"
							placeholder="Search integrations..."
							className="w-full bg-transparent border-none text-inverse text-[12px] placeholder:text-link-muted focus:outline-none"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
				)}
			</div>
		);
	};

	// Render search results
	const renderSearchResults = () => {
		if (!searchResults) return null;
		if (searchResults.length === 0) {
			return (
				<p className="text-[12px] text-[#505D7B] text-center py-[16px] px-[8px]">
					No integrations found for &ldquo;{searchQuery}&rdquo;
				</p>
			);
		}
		return (
			<div className="flex flex-col gap-[2px]">
				{searchResults.slice(0, 20).map((piece) => (
					<PieceRow
						key={piece.name}
						piece={piece}
						showCategory
						onClick={() => handleSelectPiece(piece)}
					/>
				))}
				{searchResults.length > 20 && (
					<p className="text-[11px] text-[#505D7B] text-center py-[4px]">
						+{searchResults.length - 20} more results
					</p>
				)}
			</div>
		);
	};

	// Render categories (level 0)
	const renderCategories = () => (
		<div className="flex flex-col gap-[2px]">
			{/* Built-in: GitHub Trigger & Action */}
			<p className="text-[#505D7B] text-[11px] font-medium leading-[170%] px-[8px] mt-[4px]">
				Built-in
			</p>
			<button
				type="button"
				className="flex items-center gap-[8px] rounded-[6px] px-[8px] py-[6px] hover:bg-[rgba(222,233,242,0.10)] w-full text-left"
				onClick={() => {
					setSelectedTool(addNodeTool(createTriggerNode("github")));
				}}
			>
				<GitHubIcon className="size-[20px] shrink-0" />
				<div className="flex-1 min-w-0">
					<p className="text-[13px] text-inverse">GitHub Trigger</p>
					<p className="text-[11px] text-[#505D7B] truncate">
						Trigger workflow on GitHub events
					</p>
				</div>
			</button>
			<button
				type="button"
				className="flex items-center gap-[8px] rounded-[6px] px-[8px] py-[6px] hover:bg-[rgba(222,233,242,0.10)] w-full text-left"
				onClick={() => {
					setSelectedTool(addNodeTool(createActionNode("github")));
				}}
			>
				<GitHubIcon className="size-[20px] shrink-0" />
				<div className="flex-1 min-w-0">
					<p className="text-[13px] text-inverse">GitHub Action</p>
					<p className="text-[11px] text-[#505D7B] truncate">
						Perform GitHub actions (create issue, PR, etc.)
					</p>
				</div>
			</button>

			{/* Divider */}
			<div className="border-b border-[#505D7B]/20 my-[6px] mx-[8px]" />

			{/* Categories */}
			<p className="text-[#505D7B] text-[11px] font-medium leading-[170%] px-[8px]">
				Categories
			</p>
			{categories.map((cat) => (
				<button
					key={cat}
					type="button"
					className="flex items-center gap-[8px] rounded-[6px] px-[8px] py-[6px] hover:bg-[rgba(222,233,242,0.10)] w-full text-left group"
					onClick={() => {
						setSearchQuery("");
						setView({ level: "pieces", category: cat });
					}}
				>
					<div className="size-[20px] rounded-[4px] flex items-center justify-center bg-[rgba(222,233,242,0.10)] text-inverse shrink-0">
						<CategoryIcon category={cat} />
					</div>
					<div className="flex-1 min-w-0">
						<p className="text-[13px] text-inverse">{cat}</p>
					</div>
					<span className="text-[11px] text-[#505D7B]">
						{categoryCounts[cat] ?? 0}
					</span>
					<ChevronRightIcon className="size-[14px] text-[#505D7B] opacity-0 group-hover:opacity-100 transition-opacity" />
				</button>
			))}
		</div>
	);

	// Render pieces in category (level 1)
	const renderPieces = () => {
		if (view.level !== "pieces") return null;
		const pieces = getPiecesByCategory(view.category);
		return (
			<div className="flex flex-col gap-[2px]">
				{pieces.map((piece) => (
					<PieceRow
						key={piece.name}
						piece={piece}
						onClick={() => handleSelectPiece(piece)}
					/>
				))}
			</div>
		);
	};

	// Render actions for selected piece (level 2)
	const renderActions = () => {
		if (view.level !== "actions") return null;
		const piece = view.piece;

		if (actionsLoading) {
			return (
				<div className="flex items-center justify-center py-[16px] gap-[8px]">
					<LoaderIcon className="size-[14px] text-[#505D7B] animate-spin" />
					<span className="text-[12px] text-[#505D7B]">
						Loading actions...
					</span>
				</div>
			);
		}

		if (pieceActions.length === 0) {
			return (
				<div className="flex flex-col gap-[8px] py-[8px] px-[8px]">
					<p className="text-[12px] text-[#505D7B]">
						No actions found. Use default action.
					</p>
					<button
						type="button"
						className="flex items-center gap-[8px] rounded-[6px] px-[8px] py-[6px] hover:bg-[rgba(222,233,242,0.10)] w-full text-left"
						onClick={() => handleSelectPieceDefault(piece)}
					>
						<PieceIcon
							logoUrl={piece.logoUrl}
							displayName={piece.displayName}
							className="size-[20px] shrink-0"
						/>
						<div className="flex-1 min-w-0">
							<p className="text-[13px] text-inverse">Default Action</p>
							<p className="text-[11px] text-[#505D7B] truncate">
								Run the default action for {piece.displayName}
							</p>
						</div>
					</button>
				</div>
			);
		}

		return (
			<div className="flex flex-col gap-[2px]">
				<p className="text-[#505D7B] text-[11px] font-medium leading-[170%] px-[8px] mt-[4px]">
					Actions ({pieceActions.length})
				</p>
				{pieceActions.map((action) => (
					<button
						key={action.name}
						type="button"
						className="flex items-center gap-[8px] rounded-[6px] px-[8px] py-[6px] hover:bg-[rgba(222,233,242,0.10)] w-full text-left"
						onClick={() =>
							handleSelectAction(
								piece,
								action,
								pieceVersion ?? "0.0.1",
							)
						}
					>
						<PieceIcon
							logoUrl={piece.logoUrl}
							displayName={piece.displayName}
							className="size-[16px] shrink-0 opacity-60"
						/>
						<div className="flex-1 min-w-0">
							<p className="text-[13px] text-inverse truncate">
								{action.displayName}
							</p>
							{action.description && (
								<p className="text-[11px] text-[#505D7B] truncate">
									{action.description}
								</p>
							)}
						</div>
					</button>
				))}
			</div>
		);
	};

	return (
		<div className="flex flex-col gap-[4px] w-[280px]">
			{renderHeader()}
			<div className="max-h-[360px] overflow-y-auto px-[4px]">
				{searchResults
					? renderSearchResults()
					: view.level === "categories"
						? renderCategories()
						: view.level === "pieces"
							? renderPieces()
							: renderActions()}
			</div>
		</div>
	);
}

// PieceRow component
function PieceRow({
	piece,
	showCategory,
	onClick,
}: {
	piece: PieceCatalogEntry;
	showCategory?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className="flex items-center gap-[8px] rounded-[6px] px-[8px] py-[6px] hover:bg-[rgba(222,233,242,0.10)] w-full text-left"
			onClick={onClick}
		>
			<PieceIcon
				logoUrl={piece.logoUrl}
				displayName={piece.displayName}
				className="size-[20px] shrink-0"
			/>
			<div className="flex-1 min-w-0">
				<p className="text-[13px] text-inverse truncate">
					{piece.displayName}
				</p>
				<p className="text-[11px] text-[#505D7B] truncate">
					{showCategory ? piece.category : piece.description}
				</p>
			</div>
			<ChevronRightIcon className="size-[14px] text-[#505D7B] opacity-0 group-hover:opacity-100" />
		</button>
	);
}

// Category icon (simple letter-based)
function CategoryIcon({ category }: { category: PieceCategory }) {
	const letter = category.charAt(0).toUpperCase();
	return (
		<span className="text-[10px] font-bold">{letter}</span>
	);
}
