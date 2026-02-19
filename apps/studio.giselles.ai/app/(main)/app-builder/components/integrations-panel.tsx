"use client";

/**
 * IntegrationsPanel Component
 *
 * Browse and connect real integrations from the Activepieces catalog.
 * Loads 600+ connectors from /api/integrations/pieces with search and category filtering.
 */

import {
	ExternalLink,
	Link,
	Loader2,
	Puzzle,
	Search,
	Webhook,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface IntegrationsPanelProps {
	appId: string;
}

interface PieceEntry {
	name: string;
	displayName: string;
	category: string;
	authType: string;
	description: string;
	pieceType: string;
	logoUrl?: string;
}

const ITEMS_PER_PAGE = 30;

export function IntegrationsPanel({ appId }: IntegrationsPanelProps) {
	const [pieces, setPieces] = useState<PieceEntry[]>([]);
	const [categories, setCategories] = useState<string[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [activeCategory, setActiveCategory] = useState("all");
	const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
	const [activeTab, setActiveTab] = useState<"browse" | "connected">(
		"browse",
	);

	// Fetch piece catalog
	useEffect(() => {
		async function fetchPieces() {
			try {
				const res = await fetch("/api/integrations/pieces");
				if (res.ok) {
					const data = await res.json();
					setPieces(data.pieces || []);
					setCategories(data.categories || []);
					setTotal(data.total || 0);
				}
			} catch {
				// Ignore
			}
			setLoading(false);
		}
		fetchPieces();
	}, []);

	// Filter pieces
	const filtered = useMemo(() => {
		let result = pieces;

		if (activeCategory !== "all") {
			result = result.filter((p) => p.category === activeCategory);
		}

		if (search.trim()) {
			const q = search.toLowerCase().trim();
			result = result.filter(
				(p) =>
					p.displayName.toLowerCase().includes(q) ||
					p.name.toLowerCase().includes(q) ||
					p.description.toLowerCase().includes(q),
			);
		}

		return result;
	}, [pieces, activeCategory, search]);

	// Reset visible count when filter changes
	useEffect(() => {
		setVisibleCount(ITEMS_PER_PAGE);
	}, [activeCategory, search]);

	const visiblePieces = filtered.slice(0, visibleCount);
	const hasMore = visibleCount < filtered.length;

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-5xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-foreground">
							Integrations
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							{total} connectors available — connect services to
							your app
						</p>
					</div>
				</div>

				{/* Tabs */}
				<div className="flex gap-1 border-b border-border">
					<button
						type="button"
						onClick={() => setActiveTab("browse")}
						className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
							activeTab === "browse"
								? "border-foreground text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
					>
						Browse
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("connected")}
						className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
							activeTab === "connected"
								? "border-foreground text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
					>
						My Integrations
					</button>
				</div>

				{activeTab === "connected" ? (
					<div className="rounded-lg border border-border bg-card p-8 text-center">
						<Link className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
						<h3 className="text-sm font-medium text-foreground mb-1">
							No integrations connected yet
						</h3>
						<p className="text-xs text-muted-foreground max-w-sm mx-auto">
							Browse available integrations and connect them to
							start using external services in your app.
						</p>
						<button
							type="button"
							onClick={() => setActiveTab("browse")}
							className="mt-4 px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
						>
							Browse Integrations
						</button>
					</div>
				) : (
					<>
						{/* Search + Category */}
						<div className="flex flex-col sm:flex-row gap-3">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<input
									type="text"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Search integrations..."
									className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<select
								value={activeCategory}
								onChange={(e) =>
									setActiveCategory(e.target.value)
								}
								className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="all">
									All Categories ({pieces.length})
								</option>
								{categories.map((cat) => (
									<option key={cat} value={cat}>
										{cat} (
										{
											pieces.filter(
												(p) => p.category === cat,
											).length
										}
										)
									</option>
								))}
							</select>
						</div>

						{/* Results count */}
						<p className="text-xs text-muted-foreground">
							Showing {visiblePieces.length} of{" "}
							{filtered.length} integrations
							{search && ` matching "${search}"`}
						</p>

						{/* Grid */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{visiblePieces.map((piece) => (
								<div
									key={piece.name}
									className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-muted-foreground/30 transition-colors group"
								>
									<div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
										{piece.logoUrl ? (
											<img
												src={piece.logoUrl}
												alt=""
												className="h-5 w-5 object-contain"
												onError={(e) => {
													(
														e.target as HTMLImageElement
													).style.display = "none";
													(
														e.target as HTMLImageElement
													).parentElement!.innerHTML =
														'<svg class="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
												}}
											/>
										) : (
											<Puzzle className="h-4 w-4 text-muted-foreground" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<h3 className="text-sm font-medium text-foreground truncate">
											{piece.displayName}
										</h3>
										<p className="text-[11px] text-muted-foreground truncate">
											{piece.category}
											{piece.authType !== "none" && (
												<>
													{" "}
													&middot;{" "}
													{piece.authType ===
													"oauth2"
														? "OAuth"
														: piece.authType ===
															  "api_key"
															? "API Key"
															: piece.authType}
												</>
											)}
										</p>
									</div>
									<button
										type="button"
										className="px-2.5 py-1 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
									>
										Add
									</button>
								</div>
							))}
						</div>

						{/* Load more */}
						{hasMore && (
							<div className="flex justify-center pt-2">
								<button
									type="button"
									onClick={() =>
										setVisibleCount(
											(v) => v + ITEMS_PER_PAGE,
										)
									}
									className="px-6 py-2 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
								>
									Load More ({filtered.length - visibleCount}{" "}
									remaining)
								</button>
							</div>
						)}

						{/* Empty state */}
						{filtered.length === 0 && (
							<div className="text-center py-8">
								<Puzzle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
								<p className="text-sm text-muted-foreground">
									No integrations found
									{search && ` for "${search}"`}
								</p>
							</div>
						)}

						{/* Webhooks */}
						<div className="rounded-lg border border-border bg-card p-4">
							<div className="flex items-start gap-3">
								<Webhook className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
								<div>
									<h3 className="text-sm font-medium text-foreground">
										Webhooks
									</h3>
									<p className="text-xs text-muted-foreground mt-1">
										Configure webhooks to receive real-time
										notifications when data changes in your
										app. Webhooks will be available once
										your app has entities defined.
									</p>
								</div>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
