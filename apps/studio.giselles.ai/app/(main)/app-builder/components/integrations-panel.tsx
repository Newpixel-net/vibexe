"use client";

/**
 * IntegrationsPanel Component
 *
 * Browse and connect real integrations from the Activepieces catalog.
 * Loads 600+ connectors from /api/integrations/pieces with search and category filtering.
 */

import {
	Check,
	ExternalLink,
	Link,
	Loader2,
	Puzzle,
	Search,
	Trash2,
	Webhook,
	X,
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

interface ConnectedIntegration {
	pieceName: string;
	displayName: string;
	status: string;
	connectedAt: string;
	hasCredentials: boolean;
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
	const [connected, setConnected] = useState<ConnectedIntegration[]>([]);
	const [connectedLoading, setConnectedLoading] = useState(true);
	const [connectingPiece, setConnectingPiece] = useState<string | null>(null);

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

	// Fetch connected integrations
	const fetchConnected = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/integrations`);
			if (res.ok) {
				const data = await res.json();
				setConnected(data.integrations || []);
			}
		} catch {
			// Ignore
		}
		setConnectedLoading(false);
	}, [appId]);

	useEffect(() => {
		fetchConnected();
	}, [fetchConnected]);

	const connectedSet = useMemo(
		() => new Set(connected.map((c) => c.pieceName)),
		[connected],
	);

	const handleConnect = useCallback(
		async (piece: PieceEntry) => {
			setConnectingPiece(piece.name);
			try {
				await fetch(`/api/apps/${appId}/integrations`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						pieceName: piece.name,
						displayName: piece.displayName,
					}),
				});
				fetchConnected();
			} catch {
				// Ignore
			}
			setConnectingPiece(null);
		},
		[appId, fetchConnected],
	);

	const handleDisconnect = useCallback(
		async (pieceName: string) => {
			if (!window.confirm("Disconnect this integration?")) return;
			try {
				await fetch(`/api/apps/${appId}/integrations`, {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ pieceName }),
				});
				fetchConnected();
			} catch {
				// Ignore
			}
		},
		[appId, fetchConnected],
	);

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
				<Loader2 className="h-6 w-6 animate-spin text-white/40" />
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-5xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-white/90">
							Integrations
						</h1>
						<p className="text-sm text-white/40 mt-1">
							{total} connectors available — connect services to
							your app
						</p>
					</div>
				</div>

				{/* Tabs */}
				<div className="flex gap-1 border-b border-white/[0.06]">
					<button
						type="button"
						onClick={() => setActiveTab("browse")}
						className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
							activeTab === "browse"
								? "border-violet-400 text-white/90"
								: "border-transparent text-white/40 hover:text-white/90"
						}`}
					>
						Browse
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("connected")}
						className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
							activeTab === "connected"
								? "border-violet-400 text-white/90"
								: "border-transparent text-white/40 hover:text-white/90"
						}`}
					>
						My Integrations
					</button>
				</div>

				{activeTab === "connected" ? (
					connectedLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-5 w-5 animate-spin text-white/40" />
						</div>
					) : connected.length === 0 ? (
						<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-8 text-center">
							<Link className="h-8 w-8 text-white/20 mx-auto mb-3" />
							<h3 className="text-sm font-medium text-white/90 mb-1">
								No integrations connected yet
							</h3>
							<p className="text-xs text-white/40 max-w-sm mx-auto">
								Browse available integrations and connect them to
								start using external services in your app.
							</p>
							<button
								type="button"
								onClick={() => setActiveTab("browse")}
								className="mt-4 px-4 py-2 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white hover:from-violet-500 hover:to-cyan-500 text-sm font-medium transition-colors"
							>
								Browse Integrations
							</button>
						</div>
					) : (
						<div className="space-y-2">
							{connected.map((integration) => {
								const piece = pieces.find((p) => p.name === integration.pieceName);
								return (
									<div
										key={integration.pieceName}
										className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3"
									>
										<div className="h-9 w-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
											{piece?.logoUrl ? (
												<img
													src={piece.logoUrl}
													alt=""
													className="h-5 w-5 object-contain"
												/>
											) : (
												<Puzzle className="h-4 w-4 text-white/40" />
											)}
										</div>
										<div className="min-w-0 flex-1">
											<h3 className="text-sm font-medium text-white/90">
												{integration.displayName}
											</h3>
											<p className="text-[11px] text-white/40">
												Connected {new Date(integration.connectedAt).toLocaleDateString()}
												{integration.hasCredentials && (
													<>
														{" "}&middot;{" "}
														<span className="text-green-600">Credentials saved</span>
													</>
												)}
											</p>
										</div>
										<span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
											{integration.status}
										</span>
										<button
											type="button"
											onClick={() => handleDisconnect(integration.pieceName)}
											className="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-500 transition-colors"
											title="Disconnect"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									</div>
								);
							})}
						</div>
					)
				) : (
					<>
						{/* Search + Category */}
						<div className="flex flex-col sm:flex-row gap-3">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
								<input
									type="text"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Search integrations..."
									className="w-full pl-9 pr-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
								/>
							</div>
							<select
								value={activeCategory}
								onChange={(e) =>
									setActiveCategory(e.target.value)
								}
								className="px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
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
						<p className="text-xs text-white/40">
							Showing {visiblePieces.length} of{" "}
							{filtered.length} integrations
							{search && ` matching "${search}"`}
						</p>

						{/* Grid */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{visiblePieces.map((piece) => (
								<div
									key={piece.name}
									className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3 hover:border-white/[0.12] transition-colors group"
								>
									<div className="h-9 w-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
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
														'<svg class="h-5 w-5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
												}}
											/>
										) : (
											<Puzzle className="h-4 w-4 text-white/40" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<h3 className="text-sm font-medium text-white/90 truncate">
											{piece.displayName}
										</h3>
										<p className="text-[11px] text-white/40 truncate">
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
									{connectedSet.has(piece.name) ? (
										<span className="px-2.5 py-1 rounded-md text-xs font-medium text-green-600 flex items-center gap-1 flex-shrink-0">
											<Check className="h-3 w-3" />
											Added
										</span>
									) : (
										<button
											type="button"
											onClick={() => handleConnect(piece)}
											disabled={connectingPiece === piece.name}
											className="px-2.5 py-1 rounded-md border border-white/[0.08] text-xs font-medium text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 disabled:opacity-50"
										>
											{connectingPiece === piece.name ? (
												<Loader2 className="h-3 w-3 animate-spin" />
											) : (
												"Add"
											)}
										</button>
									)}
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
									className="px-6 py-2 rounded-md border border-white/[0.08] text-sm font-medium text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
								>
									Load More ({filtered.length - visibleCount}{" "}
									remaining)
								</button>
							</div>
						)}

						{/* Empty state */}
						{filtered.length === 0 && (
							<div className="text-center py-8">
								<Puzzle className="h-8 w-8 text-white/20 mx-auto mb-2" />
								<p className="text-sm text-white/40">
									No integrations found
									{search && ` for "${search}"`}
								</p>
							</div>
						)}

						{/* Webhooks */}
						<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
							<div className="flex items-start gap-3">
								<Webhook className="h-5 w-5 text-white/40 flex-shrink-0 mt-0.5" />
								<div>
									<h3 className="text-sm font-medium text-white/90">
										Webhooks
									</h3>
									<p className="text-xs text-white/40 mt-1">
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
